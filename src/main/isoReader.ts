import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

/**
 * Минимальный ISO 9660 reader — ищем файлы в образе Android-x86 для прямой
 * загрузки ядра в QEMU (минуя GRUB, что экономит 30-60 сек на каждой загрузке).
 *
 * Поддерживает только то, что нужно для Android-x86 9.0:
 *   - Rock Ridge (для длинных имён типа "isolinux/kernel" с правильным регистром)
 *   - Joliet (не поддерживаем — Android-x86 ISO его не использует)
 *   - Многосекторные файлы (kernel обычно 7+ МБ)
 *
 * ISO 9660 sector size = 2048 байт. Volume Descriptor Set начинается с сектора 16.
 * Primary Volume Descriptor (PVD) содержит:
 *   - byte 0: type (1 = PVD)
 *   - byte 1: "CD001"
 *   - byte 156-189: root directory record (34 байта)
 *   - byte 190-...: path table
 *
 * Directory record:
 *   - byte 0: length
 *   - byte 1: extended attribute length
 *   - byte 2-9: location (LE + BE 32-bit)
 *   - byte 10-17: data length
 *   - byte 25: flags (bit 1 = directory)
 *   - byte 32-33: name length
 *   - byte 33+: name (if byte 32 == 1, name is ".", ".." not stored)
 *
 * Rock Ridge extensions:
 *   - "NM" entry: alternative name (posix-style, with case)
 */

const SECTOR_SIZE = 2048;

interface DirRecord {
  name: string;
  isDir: boolean;
  location: number;     // sector
  length: number;       // bytes
  /** Rock Ridge: реальное имя с регистром (если есть) */
  realName?: string;
}

export class IsoReader {
  private buffer: Buffer;
  private dataBytes: number;
  private rootDirSector: number;
  private rootDirLen: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.dataBytes = buffer.length;
    if (this.dataBytes < 17 * SECTOR_SIZE) {
      throw new Error('ISO file too small to contain PVD');
    }
    // 1) Find Primary Volume Descriptor (type 1) at sector 16.
    const pvdOffset = 16 * SECTOR_SIZE;
    if (this.buffer.toString('ascii', pvdOffset + 1, pvdOffset + 6) !== 'CD001') {
      throw new Error('Invalid ISO 9660: missing CD001 signature at sector 16');
    }
    if (this.buffer[pvdOffset] !== 1) {
      throw new Error('Invalid ISO 9660: sector 16 is not a PVD');
    }
    // 2) Root directory record at PVD offset 156.
    const rootRec = this.buffer.slice(pvdOffset + 156, pvdOffset + 190);
    this.rootDirSector = rootRec.readUInt32LE(2);
    this.rootDirLen = rootRec.readUInt32BE(10);
  }

  /** Ищет файл по пути вроде '/isolinux/kernel' или 'kernel' (от корня). */
  async findFile(pathStr: string): Promise<Buffer | null> {
    const parts = pathStr.split('/').filter(Boolean);
    let dirSector = this.rootDirSector;
    let dirLen = this.rootDirLen;

    let fileRec: DirRecord | null = null;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const records = this.readDirectory(dirSector, dirLen);
      const target = parts[i].toLowerCase();
      const match = records.find((r) => (r.realName || r.name).toLowerCase() === target);
      if (!match) return null;
      if (isLast) {
        if (match.isDir) return null;
        fileRec = match;
        break;
      }
      if (!match.isDir) return null;
      dirSector = match.location;
      dirLen = match.length;
    }
    if (!fileRec) return null;
    return this.buffer.slice(fileRec.location * SECTOR_SIZE, fileRec.location * SECTOR_SIZE + fileRec.length);
  }

  private readDirectory(sector: number, length: number): DirRecord[] {
    const records: DirRecord[] = [];
    let offset = sector * SECTOR_SIZE;
    const end = offset + length;
    while (offset < end) {
      const recLen = this.buffer[offset];
      if (recLen === 0) {
        // Skip to next sector
        const next = Math.ceil((offset + 1) / SECTOR_SIZE) * SECTOR_SIZE;
        offset = next;
        continue;
      }
      const recEnd = offset + recLen;
      const dr = this.buffer.slice(offset, recEnd);
      const rec = this.parseDirRecord(dr);
      if (rec && rec.name !== '.' && rec.name !== '..') records.push(rec);
      offset = recEnd;
    }
    return records;
  }

  private parseDirRecord(dr: Buffer): DirRecord | null {
    if (dr.length < 34) return null;
    const dataLen = dr.readUInt32LE(10);
    const flags = dr[25];
    const nameLen = dr[32];
    if (nameLen === 0) return null;
    let name: string;
    if (nameLen === 1) {
      // Special: 0x00 = ".", 0x01 = ".."
      const c = dr[33];
      name = c === 0 ? '.' : '..';
    } else {
      // ISO 9660: name = "ID;VER" where ID is up to 30 chars. Strip ";VER" if present.
      let raw = dr.slice(33, 33 + nameLen).toString('ascii');
      const semi = raw.indexOf(';');
      if (semi >= 0) raw = raw.substring(0, semi);
      // Replace last '.' with '.' separator if it's the only one (file extension).
      // Rock Ridge: "FILE.TXT;1" → "FILE.TXT" (already stripped). We don't need more.
      name = raw;
    }
    if (!name || name === '.' || name === '..') {
      return { name, isDir: !!(flags & 0x02), location: dr.readUInt32LE(2), length: dataLen };
    }
    // Parse Rock Ridge System Use Extension (last part of record).
    let realName: string | undefined;
    if (dr.length > 33 + nameLen) {
      const sua = dr.slice(33 + nameLen);
      realName = this.parseRockRidgeName(sua);
    }
    return {
      name,
      realName: realName || name,
      isDir: !!(flags & 0x02),
      location: dr.readUInt32LE(2),
      length: dataLen,
    };
  }

  /**
   * Парсит Rock Ridge System Use Area: ищем запись 'NM' (alternative name).
   * 'NM' signature = 0x4E4D, version 1, len >= 5.
   * Flags: bit 0 = current, bit 1 = parent, bit 2 = root. Если есть — пропускаем.
   * Полное имя собираем последовательно из 'NM' (с 'CE' для продолжения).
   */
  private parseRockRidgeName(sua: Buffer): string | undefined {
    if (sua.length < 4) return undefined;
    // SUA starts with "RR" signature? It's optional in our case. We just search for 'NM'.
    let pos = 0;
    const parts: string[] = [];
    let flags: { current?: boolean; parent?: boolean; root?: boolean } = {};
    while (pos + 4 <= sua.length) {
      const sig = sua.toString('ascii', pos, pos + 2);
      const len = sua[pos + 2];
      const ver = sua[pos + 3];
      if (len === 0) break;
      if (sig === 'NM' && ver === 1 && len >= 5) {
        const nmFlags = sua[pos + 4];
        if (nmFlags & 0x01) flags.current = true;
        if (nmFlags & 0x02) flags.parent = true;
        if (nmFlags & 0x04) flags.root = true;
        // Concatenate name parts (if 'CE' continuation)
        const nameBytes = sua.slice(pos + 5, pos + len);
        parts.push(nameBytes.toString('utf-8'));
      } else if (sig === 'CE' && ver === 1 && len >= 28) {
        // Continuation of 'NM' in another record. We don't fully implement but
        // we extract the continuation block location (LE32 at pos+4, LE32 at pos+12 offset+len).
        // Skip — most Android-x86 filenames fit in one 'NM' record.
      } else if (sig === 'ST' && ver === 1) {
        break; // End of SUA
      }
      pos += len;
    }
    if (flags.current || flags.parent || flags.root) return undefined;
    if (parts.length === 0) return undefined;
    return parts.join('');
  }
}

// ── cpio (newc) helpers for initrd patching ─────────────
const CPIO_MAGIC = '070701';
const CPIO_HEADER_SIZE = 110;

function align4(n: number): number {
  return (n + 3) & ~3;
}

interface CpioEntry {
  name: string;
  mode: number;
  uid: number;
  gid: number;
  mtime: number;
  data: Buffer;
}

function parseCpio(data: Buffer): CpioEntry[] {
  const entries: CpioEntry[] = [];
  let pos = 0;
  while (pos + CPIO_HEADER_SIZE <= data.length) {
    const magic = data.toString('ascii', pos, pos + 6);
    if (magic !== CPIO_MAGIC) {
      // Search forward for next CPIO magic after misalignment or padding.
      const idx = data.indexOf(CPIO_MAGIC, pos + 1);
      if (idx === -1) break;
      pos = idx;
      continue;
    }
    const f = (off: number, len: number) => parseInt(data.toString('ascii', pos + off, pos + off + len), 16);
    const namesize = f(94, 8);
    const filesize = f(54, 8);
    if (isNaN(namesize) || isNaN(filesize) || namesize < 1 || namesize > 256 || filesize > 100_000_000) {
      pos++;
      continue;
    }
    const namePadded = align4(CPIO_HEADER_SIZE + namesize);
    const dataStart = pos + namePadded;
    if (dataStart + filesize > data.length) { pos++; continue; }
    const name = data.toString('utf-8', pos + CPIO_HEADER_SIZE, pos + CPIO_HEADER_SIZE + namesize - 1);
    if (name === 'TRAILER!!!') {
      pos = align4(dataStart + filesize);
      continue;
    }
    entries.push({
      name,
      mode: f(14, 8),
      uid: f(22, 8),
      gid: f(30, 8),
      mtime: f(46, 8),
      data: data.slice(dataStart, dataStart + filesize),
    });
    pos = align4(dataStart + filesize);
  }
  return entries;
}

function buildCpio(entries: CpioEntry[]): Buffer {
  const parts: Buffer[] = [];
  let ino = 1;
  const normalized = entries.filter((e) => e.name !== 'TRAILER!!!');
  normalized.push({
    name: 'TRAILER!!!',
    mode: 0,
    uid: 0,
    gid: 0,
    mtime: Math.floor(Date.now() / 1000),
    data: Buffer.alloc(0),
  });
  for (const e of normalized) {
    const nameBuf = Buffer.from(e.name + '\0', 'utf-8');
    const namesize = nameBuf.length;
    const filesize = e.data.length;
    const fmt = (n: number, w: number) => n.toString(16).padStart(w, '0');
    const h = fmt(0x070701, 6)  // magic
      + fmt(ino++, 8)  // ino
      + fmt(e.mode, 8)
      + fmt(e.uid, 8)
      + fmt(e.gid, 8)
      + fmt(1, 8)  // nlink
      + fmt(e.mtime, 8)
      + fmt(filesize, 8)
      + fmt(0, 8)  // devmajor
      + fmt(0, 8)  // devminor
      + fmt(0, 8)  // rdevmajor
      + fmt(0, 8)  // rdevminor
      + fmt(namesize, 8)
      + fmt(0, 8); // check
    const hdr = Buffer.from(h, 'ascii');
    const namePad = Buffer.alloc(align4(CPIO_HEADER_SIZE + namesize) - CPIO_HEADER_SIZE);
    nameBuf.copy(namePad);
    const dataPad = Buffer.alloc(align4(filesize));
    e.data.copy(dataPad);
    parts.push(Buffer.concat([hdr, namePad, dataPad]));
  }
  return Buffer.concat(parts);
}

const ADB_TCP_SNIPPET = Buffer.from([
  'echo "=== SNIPPET_START ==="',
  '# TrelEmu: ADB over TCP patch',
  'ADB_TCP_PORT=$(cat /proc/cmdline | tr " " "\\n" | grep "androidboot.adb.tcp.port=" | cut -d= -f2)',
  'if [ -n "$ADB_TCP_PORT" ]; then',
  '  if grep -q "^ro\\.adb\\.secure=" default.prop; then',
  '    sed -i "s/^ro\\.adb\\.secure=.*/ro.adb.secure=0/" default.prop',
  '  else',
  '    echo "ro.adb.secure=0" >> default.prop',
  '  fi',
  '  if grep -q "^ro\\.debuggable=" default.prop; then',
  '    sed -i "s/^ro\\.debuggable=.*/ro.debuggable=1/" default.prop',
  '  else',
  '    echo "ro.debuggable=1" >> default.prop',
  '  fi',
  '  grep -q "^service.adb.tcp.port=" default.prop || echo "service.adb.tcp.port=$ADB_TCP_PORT" >> default.prop',
  'fi',
  '',
  '# Patch init.usb.rc to start socat relay after adbd creates /dev/socket/adbd',
  'if [ -n "$ADB_TCP_PORT" ] && [ -f init.usb.rc ]; then',
  "  cat >> init.usb.rc << 'EOF'",
  '',
  '# Patched by TrelEmu: ADB TCP relay to /dev/socket/adbd',
  'service adb_tcp_relay /system/bin/sh /sbin/adb_relay.sh',
  '    class core',
  '    disabled',
  '    user root',
  '    group root shell inet',
  '    seclabel u:r:init:s0',
  '',
  'on property:init.svc.adbd=running',
  '    start adb_tcp_relay',
  'EOF',
  'fi',
  'echo "=== Checking init ==="',
  'ls -la /android/init /sbin/adbd /sbin/socat /sbin/adb_relay.sh 2>&1',
  'echo "=== installing patched adbd and adb relay into Android root ==="',
  'mkdir -p /android/sbin',
  'cp /sbin/adbd /android/sbin/adbd',
  'cp /sbin/socat /android/sbin/socat',
  'cp /sbin/adb_relay.sh /android/sbin/adb_relay.sh',
  'chmod 0755 /android/sbin/adbd /android/sbin/socat /android/sbin/adb_relay.sh',
  'sed -i "s#/system/bin/adbd#/sbin/adbd#g" /android/init.usb.rc 2>/dev/null || true',
  'echo "=== installing Trel network setup ==="',
  "cat > /android/sbin/trel_net_setup.sh << 'EOF'",
  '#!/system/bin/sh',
  'IF=wifi_eth',
  'IP=/system/bin/ip',
  '[ -x "$IP" ] || IP=ip',
  'i=0',
  'while [ ! -d /sys/class/net/$IF ] && [ $i -lt 30 ]; do sleep 1; i=$((i+1)); done',
  '$IP link set $IF up 2>/dev/null || true',
  '$IP addr add 10.0.2.15/24 dev $IF 2>/dev/null || true',
  '$IP route add 10.0.2.0/24 dev $IF 2>/dev/null || true',
  '$IP route add default via 10.0.2.2 dev $IF 2>/dev/null || true',
  'for T in 97 98 99; do',
  '  $IP route add 10.0.2.0/24 dev $IF table $T 2>/dev/null || true',
  '  $IP route add default via 10.0.2.2 dev $IF table $T 2>/dev/null || true',
  'done',
  '# Skip Android Setup Wizard. It can stay foreground forever and block',
  '# Bedrock from appearing on the QEMU screen.',
  'for N in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do',
  '  settings put global device_provisioned 1 >/dev/null 2>&1 && break',
  '  sleep 1',
  'done',
  'settings put global device_provisioned 1 2>/dev/null || true',
  'settings put secure user_setup_complete 1 2>/dev/null || true',
  'settings put secure tv_user_setup_complete 1 2>/dev/null || true',
  'settings put system accelerometer_rotation 0 2>/dev/null || true',
  'settings put system user_rotation 0 2>/dev/null || true',
  'setprop persist.sys.locale ru-RU 2>/dev/null || true',
  'pm disable-user --user 0 com.google.android.setupwizard 2>/dev/null || true',
  'pm disable com.google.android.setupwizard 2>/dev/null || true',
  'am force-stop com.google.android.setupwizard 2>/dev/null || true',
  '# Make Home deterministic. Android-x86 may have several HOME candidates,',
  '# and then ResolverActivity steals the screen and mouse. Keep Taskbar as',
  '# the only enabled HOME app before setting the preferred activity.',
  'pm enable com.farmerbb.taskbar.androidx86 2>/dev/null || true',
  'for P in com.android.launcher3 com.android.launcher com.google.android.apps.nexuslauncher com.google.android.tvlauncher com.google.android.leanbacklauncher org.android_x86.launcher; do',
  '  pm disable-user --user 0 $P 2>/dev/null || true',
  '  pm disable $P 2>/dev/null || true',
  'done',
  'cmd package set-home-activity --user 0 com.farmerbb.taskbar.androidx86/com.farmerbb.taskbar.activity.DashboardActivity 2>/dev/null || true',
  'cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME 2>/dev/null || true',
  'settings put secure immersive_mode_confirmations confirmed 2>/dev/null || true',
  'if [ -x /system/bin/enable_nativebridge ]; then /system/bin/enable_nativebridge 2>/dev/null || true; fi',
  '# Do not restart zygote here: doing it during early boot may drop ADB/QEMU.',
  '# Trel restarts zygote later, once Android is boot_completed and right before',
  '# launching an ARM-only Bedrock APK.',
  '# Do not press HOME here: if Android has multiple home apps it opens ResolverActivity. Start Taskbar explicitly instead.',
  'am start -n com.farmerbb.taskbar.androidx86/com.farmerbb.taskbar.activity.DashboardActivity 2>/dev/null || true',
  'EOF',
  'chmod 0755 /android/sbin/trel_net_setup.sh',
  'echo "=== installing writable /data for ADB/scrcpy ==="',
  'mkdir -p /android/data',
  'mount -t tmpfs -o mode=0771 tmpfs /android/data 2>/dev/null || true',
  'mkdir -p /android/data/local/tmp',
  'chmod 0771 /android/data /android/data/local 2>/dev/null || true',
  'chmod 1777 /android/data/local/tmp 2>/dev/null || true',
  'chown 1000:1000 /android/data /android/data/local 2>/dev/null || true',
  'chown 2000:2000 /android/data/local/tmp 2>/dev/null || true',
  'echo "=== installing Houdini ARM native bridge payload ==="',
  'mkdir -p /android/data/arm',
  'cp /sbin/houdini9_y.sfs /android/data/arm/houdini9_y.sfs 2>/dev/null || true',
  'chmod 0644 /android/data/arm/houdini9_y.sfs 2>/dev/null || true',
  "cat >> /android/init.usb.rc << 'EOF'",
  '',
  '# Patched by TrelEmu: static IPv4 for QEMU usernet hostfwd',
  'service trel_net_setup /system/bin/sh /sbin/trel_net_setup.sh',
  '    class core',
  '    disabled',
  '    user root',
  '    group root inet',
  '    oneshot',
  '    seclabel u:r:init:s0',
  '',
  'on boot',
  '    start trel_net_setup',
  'EOF',
  'echo "=== mount ==="',
  'mount 2>&1 | grep android',
  'echo "=== switching to Android root ==="',
  'exec ${SWITCH:-switch_root} /android /init',
  'echo "=== switch_root FAILED ==="',
  '',
].join('\n'));

/**
 * Патчит initrd (gzip-cpio initramfs), добавляя в скрипт `init`
 * shell-код, который перед switch_root дописывает в `init.usb.rc`
 * (извлечённый из ramdisk.img) триггер включения ADB по TCP.
 */
export function patchInitrdForAdbTcp(initrdBuf: Buffer, socatBuf?: Buffer, adbdBuf?: Buffer, houdiniBuf?: Buffer): Buffer {
  const raw = zlib.gunzipSync(initrdBuf);
  const entries = parseCpio(raw);
  let patchedInit = false;
  for (const e of entries) {
    if (e.name === 'init') {
      // Replace the `exec switch_root` line with our snippet
      const str = e.data.toString('utf-8');
      const marker = 'exec ${SWITCH:-switch_root} /android /init';
      const idx = str.lastIndexOf(marker);
      if (idx === -1) throw new Error('Cannot find switch_root line in init script');
      const before = str.substring(0, idx);
      const after = str.substring(idx + marker.length);
      e.data = Buffer.from(before + ADB_TCP_SNIPPET.toString('utf-8') + after, 'utf-8');
      patchedInit = true;
    }
  }
  if (!patchedInit) throw new Error('init script not found in initrd — cannot patch ADB TCP');

  const mtime = Math.floor(Date.now() / 1000);
  const upsert = (entry: CpioEntry) => {
    const idx = entries.findIndex((e) => e.name === entry.name);
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
  };

  if (!socatBuf || socatBuf.length < 1024 * 1024) {
    throw new Error('static socat binary is missing — cannot patch ADB TCP relay');
  }
  if (!adbdBuf || adbdBuf.length < 1024 * 1024) {
    throw new Error('patched adbd binary is missing — cannot patch ADB TCP');
  }
  if (!houdiniBuf || houdiniBuf.length < 40 * 1024 * 1024) {
    throw new Error('houdini9_y.sfs is missing — cannot enable ARM native bridge for Bedrock');
  }

  upsert({
    name: 'sbin/houdini9_y.sfs',
    mode: 0o100644,
    uid: 0,
    gid: 0,
    mtime,
    data: houdiniBuf,
  });

  upsert({
    name: 'sbin/adbd',
    mode: 0o100755,
    uid: 0,
    gid: 0,
    mtime,
    data: adbdBuf,
  });

  upsert({
    name: 'sbin/socat',
    mode: 0o100755,
    uid: 0,
    gid: 0,
    mtime,
    data: socatBuf,
  });

  upsert({
    name: 'sbin/adb_relay.sh',
    mode: 0o100755,
    uid: 0,
    gid: 0,
    mtime,
    data: Buffer.from([
      '#!/system/bin/sh',
      'PORT=$(getprop ro.boot.adb.tcp.port)',
      '[ -n "$PORT" ] || PORT=5555',
      'RELAY_PORT=$((PORT + 3))',
      'while [ ! -S /dev/socket/adbd ]; do sleep 1; done',
      'while true; do',
      '  /sbin/socat TCP-LISTEN:${RELAY_PORT},reuseaddr,fork UNIX-CONNECT:/dev/socket/adbd',
      '  sleep 1',
      'done',
      '',
    ].join('\n'), 'utf-8'),
  });

  return zlib.gzipSync(buildCpio(entries), { level: 1 });
}

/**
 * Извлекает из ISO файлы для direct kernel boot.
 * Android-x86 9.0 имеет типичную структуру:
 *   /isolinux/kernel       — сжатый Linux kernel (bzImage)
 *   /isolinux/initrd.img   — initrd с Android-хелперами
 *   /isolinux/isolinux.cfg — GRUB-конфиг (нам не нужен, мы передаём -append)
 *
 * Если kernel/initrd.img не найдены, fallback на /boot/ (UEFI-путь) и /android-X.X/.
 */
export async function extractBootFiles(isoPath: string, outDir: string): Promise<{ kernel: string; initrd: string }> {
  await fsp.mkdir(outDir, { recursive: true });
  const data = await fsp.readFile(isoPath);
  const iso = new IsoReader(data);

  // Поиск kernel по типичным путям Android-x86.
  const KERNEL_CANDIDATES = [
    'isolinux/kernel',       // Live CD kernel
    'boot/vmlinuz',          // Generic UEFI
    'kernel',                // Short
    'android-9.0-r2/kernel', // Версионный путь
  ];
  const INITRD_CANDIDATES = [
    'isolinux/initrd.img',
    'boot/initrd.img',
    'initrd.img',
    'android-9.0-r2/initrd.img',
  ];

  let kernelBuf: Buffer | null = null;
  for (const p of KERNEL_CANDIDATES) {
    kernelBuf = await iso.findFile(p);
    if (kernelBuf) break;
  }
  if (!kernelBuf) throw new Error('Не нашёл kernel в ISO. Попробуй другую версию Android-x86.');

  let initrdBuf: Buffer | null = null;
  for (const p of INITRD_CANDIDATES) {
    initrdBuf = await iso.findFile(p);
    if (initrdBuf) break;
  }
  if (!initrdBuf) throw new Error('Не нашёл initrd.img в ISO. Попробуй другую версию Android-x86.');

  const kernelOut = `${outDir}/kernel`;
  const initrdOut = `${outDir}/initrd.img`;
  let changed = false;
  if (!(await fileExists(kernelOut)) || (await fsp.readFile(kernelOut)).length !== kernelBuf.length) {
    await fsp.writeFile(kernelOut, kernelBuf);
    changed = true;
  }
  // Patch initrd: add ADB TCP relay so `androidboot.adb.tcp.port=5555` actually works.
  // Всегда перезаписываем — размер патча меняется между версиями Trel.
  const readBundledBin = async (name: string): Promise<Buffer> => {
    const localPath = path.join(outDir, '..', 'bin', name);
    try {
      return await fsp.readFile(localPath);
    } catch (localErr) {
      // Installed versions may already have an old %APPDATA%/Trel/trel-emu cache
      // without bin/adbd and bin/socat. Fall back to the bundled resources copy
      // and also seed the cache so the next run is self-contained.
      const bundledPath = path.join(process.resourcesPath || '', 'trel-emu', 'bin', name);
      const data = await fsp.readFile(bundledPath);
      await fsp.mkdir(path.dirname(localPath), { recursive: true });
      await fsp.writeFile(localPath, data);
      return data;
    }
  };
  const socatBuf = await readBundledBin('socat');
  const adbdBuf = await readBundledBin('adbd');
  const houdiniBuf = await readBundledBin('houdini9_y.sfs');
  const patchedInitrd = patchInitrdForAdbTcp(initrdBuf, socatBuf, adbdBuf, houdiniBuf);
  await fsp.writeFile(initrdOut, patchedInitrd);
  changed = true;
  if (changed) console.log(`[TrelEmu] Extracted kernel+initrd → ${outDir}`);
  return { kernel: kernelOut, initrd: initrdOut };
}

async function fileExists(p: string): Promise<boolean> {
  try { await fsp.access(p); return true; } catch { return false; }
}

#!/usr/bin/env node
/**
 * Builds trel-emu-pack.zip — a compact zip archive that Trel downloads from
 * GitHub Releases on first run. It contains:
 *   - qemu/qemu-system-x86_64.exe  (≈27 MB)
 *   - qemu/qemu-img.exe            (≈2 MB)
 *   - qemu/<all DLLs + utilities>   (≈110 MB, needed to run QEMU)
 *   - image/android-x86.iso        (≈965 MB)
 *   - config.json                  (default config: memory, cores, port)
 *
 * Why: instead of bundling 1 GB of emulator into the installer (NSIS ends up
 * at 1 GB, portable at 1 GB too), we keep a small installer (~80 MB) and
 * download TrelEmu separately. The user clicks a single "Download TrelEmu"
 * button — and 5-10 minutes later they have a ready emulator.
 *
 * Usage:
 *   1) Put qemu-system-x86_64.exe, qemu-img.exe, android-x86.iso, config.json
 *      into build-trel-emu-cache/source/
 *   2) Run `node scripts/build-trel-emu-pack.js`
 *   3) Get dist/trel-emu-pack.zip + .sha1
 *   4) Upload it to GitHub Releases in the Griln/Trel repository
 *      with the tag trel-emu-v0.3.0 and the name trel-emu-pack.zip
 *
 * The unpacked QEMU cache must live in build-trel-emu-cache/qemu/,
 * the Android-x86 ISO in build-trel-emu-cache/android-x86_64-9.0-r2.iso,
 * and config.json in resources/trel-emu/config.json.
 *
 * ⚠️ IMPORTANT: we bundle ALL DLLs and helper binaries from qemu/. QEMU will
 * not start without libstdc++-6.dll, libgcc_s_seh-1.dll, libwinpthread-1.dll,
 * SDL2.dll, libcrypto-3-x64.dll and ~100 more files. The pack grows from
 * 947 MB to ~1.1 GB, but without this TrelEmu simply will not start.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'build-trel-emu-cache');
const QEMU_DIR = path.join(CACHE, 'qemu');
const ISO_FILE = path.join(CACHE, 'android-x86_64-9.0-r2.iso');
const CONFIG_FILE = path.join(ROOT, 'resources', 'trel-emu', 'config.json');
// IMPORTANT: we write into `dist-trel-emu/`, NOT into `dist/`. Otherwise the
// glob `dist/**/*` in
// package.json `build.files` picks up the 1 GB zip file and packs it into the
// asar,
// turning the small installer into a 1 GB distribution. That was the bug.
const OUT_DIR = path.join(ROOT, 'dist-trel-emu');
const OUT_ZIP = path.join(OUT_DIR, 'trel-emu-pack.zip');
const OUT_SHA1 = path.join(OUT_DIR, 'trel-emu-pack.zip.sha1');

// What we do NOT bundle from qemu/: other architectures (aarch64, arm, mips,
// etc.) —
// they are not needed for TrelEmu (x86_64 only). Without them the pack loses
// ~700 MB.
// We also drop the other small stuff (NSIS installer leftovers).
const QEMU_EXCLUDE_PATTERNS = [
  /^qemu-system-(aarch64|alpha|arm|avr|hppa|i386|loongarch64|m68k|microblaze|mips|mipsel|or1k|ppc|ppc64|riscv32|riscv64|rx|s390x|sh4|sh4eb|sparc|sparc64|tricore|xtensa|xtensaeb).*\.exe$/,
  /^qemu-system-.*w\.exe$/,    // Windows-on-Windows variants
  /^\$PLUGINSDIR\//,           // NSIS installer leftovers
  // share/: keep only the x86_64 bios/firmware (needed for boot).
  // Drop the remaining architectures (aarch64, arm, loongarch, riscv, sparc, ppc,
// hppa, m68k, rx, s390x, etc.).
  /^share\/(?!bios-256k\.bin|bios-microvm\.bin|bios\.bin|kvmvapic\.bin|vgabios-|edk2-x86_64-|linuxboot_dma\.bin|multiboot_dma\.bin|pvh\.bin|efi-|pxe-|qboot\.rom)/,
  // Text files, licenses, translations, icons, keymaps, man pages, dtb — not needed
// to run.
  /^share\/dtb\//,
  /^share\/icons\//,
  /^share\/keymaps\//,
  /^share\/locale\//,
  /^share\/man\//,
  /^share\/doc\//,
  /^share\/applications\//,
  /^share\/firmware\//,         // EDK2 vars files
  /^share\/edk2-licenses\.txt$/,
];

// scrcpy/ — TrelEmu automatically launches scrcpy.exe once ADB
// connects, so that the Android screen becomes visible. We bundle everything
// except the junk
// files (batch files, icon, vbs).
const SCRCPY_EXCLUDE_PATTERNS = [
  /^open_a_terminal_here\.bat$/,
  /^scrcpy-console\.bat$/,
  /^scrcpy-noconsole\.vbs$/,
  /^icon\.png$/,
];

const SCRCPY_DIR = path.join(CACHE, 'scrcpy');

function log(msg) { console.log(`[trel-emu-pack] ${msg}`); }

if (!fs.existsSync(QEMU_DIR)) { console.error('Missing QEMU dir:', QEMU_DIR); process.exit(1); }
if (!fs.existsSync(ISO_FILE)) { console.error('Missing ISO:', ISO_FILE); process.exit(1); }
if (!fs.existsSync(CONFIG_FILE)) { console.error('Missing config.json:', CONFIG_FILE); process.exit(1); }
if (!fs.existsSync(SCRCPY_DIR)) { console.warn('WARNING: scrcpy/ not found at ' + SCRCPY_DIR + ' — TrelEmu won\'t auto-show Android screen'); }

fs.mkdirSync(OUT_DIR, { recursive: true });

// Collect the list of all files from qemu/ except the excluded ones.
const FILES = [];
function walkQemuDir(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relName = prefix + entry.name;
    if (QEMU_EXCLUDE_PATTERNS.some(re => re.test(relName))) continue;
    if (entry.isDirectory()) {
      // We do not recurse into $PLUGINSDIR, share, lib (lib is empty) — but
// $PLUGINSDIR
      // and share were already filtered out by the pattern above. We recurse into lib
// (there may be
      // something useful there, but in practice it is empty).
      if (entry.name === 'lib') continue;
      walkQemuDir(path.join(dir, entry.name), relName + '/');
    } else {
      FILES.push({ src: path.join(dir, entry.name), name: 'qemu/' + relName });
    }
  }
}
walkQemuDir(QEMU_DIR, '');

// scrcpy/ — to show the Android screen after TrelEmu starts.
if (fs.existsSync(SCRCPY_DIR)) {
  for (const entry of fs.readdirSync(SCRCPY_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (SCRCPY_EXCLUDE_PATTERNS.some(re => re.test(entry.name))) continue;
    FILES.push({ src: path.join(SCRCPY_DIR, entry.name), name: 'scrcpy/' + entry.name });
  }
}

// ISO + config
FILES.push({ src: ISO_FILE, name: 'image/android-x86.iso' });
FILES.push({ src: CONFIG_FILE, name: 'config.json' });

let totalSize = 0;
for (const f of FILES) {
  if (!fs.existsSync(f.src)) { console.error('Missing file:', f.src); process.exit(1); }
  const sz = fs.statSync(f.src).size;
  totalSize += sz;
  log(`  ${f.name}: ${(sz / 1024 / 1024).toFixed(1)} МБ`);
}
log(`Total: ${FILES.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} МБ uncompressed`);

/**
 * Minimal zip writer (STORE — no compression, the ISO is already compressed).
 * Supports STORE (method=0) and DEFLATE (method=8) only.
 *
 * Structure:
 *   [Local file header + filename + extra + data] * N
 *   [Central directory header] * N
 *   [End of central directory record] (EOCD)
 *
 * We use STORE for the ISO (it does not compress anyway) and for qemu (an
 * executable, it compresses poorly). That costs +30% in size compared to
 * DEFLATE, but it does not load the CPU during the build (compressing 1 GB of
 * ISO for 5-10 minutes makes no sense) and it is 1000 times faster to unpack
 * on the client side.
 */
function buildZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | (Math.floor(now.getSeconds() / 2) & 0x1f);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0xf) << 5) | (now.getDate() & 0x1f);

  for (const f of files) {
    const data = fs.readFileSync(f.src);
    const nameBuf = Buffer.from(f.name, 'utf-8');
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + name)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);     // signature
    lfh.writeUInt16LE(20, 4);              // version needed
    lfh.writeUInt16LE(0, 6);               // flags
    lfh.writeUInt16LE(0, 8);               // method: STORE
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);           // compressed size
    lfh.writeUInt32LE(size, 22);           // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);              // extra field length

    const lhBuf = Buffer.concat([lfh, nameBuf]);
    localHeaders.push({ header: lhBuf, data, offset });
    offset += lhBuf.length + data.length;
  }

  let centralOffset = offset;
  for (const entry of localHeaders) {
    const cfh = Buffer.alloc(46);
    cfh.writeUInt32LE(0x02014b50, 0);     // signature
    cfh.writeUInt16LE(20, 4);              // version made by
    cfh.writeUInt16LE(20, 6);              // version needed
    cfh.writeUInt16LE(0, 8);               // flags
    cfh.writeUInt16LE(0, 10);              // method
    cfh.writeUInt16LE(0, 12);              // last mod time
    cfh.writeUInt16LE(0, 14);              // last mod date
    cfh.writeUInt32LE(crc32(entry.data), 16);
    cfh.writeUInt32LE(entry.data.length, 20);
    cfh.writeUInt32LE(entry.data.length, 24);
    cfh.writeUInt16LE(entry.header.length - 30, 28);  // filename length (header already has name)
    cfh.writeUInt16LE(0, 30);              // extra field length
    cfh.writeUInt16LE(0, 32);              // file comment length
    cfh.writeUInt16LE(0, 34);              // disk number
    cfh.writeUInt16LE(0, 36);              // internal attrs
    cfh.writeUInt32LE(0, 38);              // external attrs
    cfh.writeUInt32LE(entry.offset, 42);   // local header offset
    centralHeaders.push(Buffer.concat([cfh, entry.header.slice(30)]));
    offset += centralHeaders[centralHeaders.length - 1].length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(localHeaders.length, 8);
  eocd.writeUInt16LE(localHeaders.length, 10);
  eocd.writeUInt32LE(offset - centralOffset, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localHeaders.flatMap((e) => [e.header, e.data]),
    ...centralHeaders,
    eocd,
  ]);
}

// CRC32 for zip
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

log('Building zip…');
const t0 = Date.now();
const zip = buildZip(FILES);
log(`zip size: ${(zip.length / 1024 / 1024).toFixed(1)} МБ (built in ${((Date.now() - t0) / 1000).toFixed(1)} sec)`);

fs.writeFileSync(OUT_ZIP, zip);

const sha1 = crypto.createHash('sha1').update(zip).digest('hex');
fs.writeFileSync(OUT_SHA1, sha1 + '  trel-emu-pack.zip\n');

log(`SHA1: ${sha1}`);
log(`Wrote ${OUT_ZIP}`);
log(`Wrote ${OUT_SHA1}`);
log('');
log('Next steps:');
log('  1) Upload dist/trel-emu-pack.zip to GitHub Releases of Griln/Trel');
log('  2) Use tag trel-emu-v0.3.0 (must match TrelEmuDownloader.DEFAULT_URL)');
log('  3) Upload dist/trel-emu-pack.zip.sha1 to the same release');
log('  4) Test: Trel.app → BrowsePage → click "Скачать"');

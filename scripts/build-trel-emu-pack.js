#!/usr/bin/env node
/**
 * Собирает trel-emu-pack.zip — компактный zip-архив, который Trel скачивает
 * из GitHub Releases при первом запуске. Содержит:
 *   - qemu/qemu-system-x86_64.exe  (≈27 МБ)
 *   - qemu/qemu-img.exe            (≈2 МБ)
 *   - qemu/<все DLLки + утилиты>   (≈110 МБ, нужны для запуска QEMU)
 *   - image/android-x86.iso        (≈965 МБ)
 *   - config.json                  (дефолтный конфиг: память, ядра, порт)
 *
 * Зачем: вместо того чтобы бандлить 1 ГБ эмулятора в инсталлятор (NSIS
 * получается 1 ГБ, portable тоже 1 ГБ), оставляем маленький инсталлятор
 * (~80 МБ) и качаем TrelEmu отдельно. Пользователь жмёт одну кнопку
 * "Скачать TrelEmu" — и через 5-10 минут у него готовый эмулятор.
 *
 * Использование:
 *   1) Положи qemu-system-x86_64.exe, qemu-img.exe, android-x86.iso, config.json
 *      в build-trel-emu-cache/source/
 *   2) Запусти `node scripts/build-trel-emu-pack.js`
 *   3) Получишь dist/trel-emu-pack.zip + .sha1
 *   4) Загрузи на GitHub Releases в репозиторий mkrlord1000-sketch/Trel
 *      с тегом trel-emu-v0.3.0 и именем trel-emu-pack.zip
 *
 * Кэш распакованного QEMU должен лежать в build-trel-emu-cache/qemu/,
 * Android-x86 ISO в build-trel-emu-cache/android-x86_64-9.0-r2.iso,
 * а config.json — в resources/trel-emu/config.json.
 *
 * ⚠️ ВАЖНО: бандлим ВСЕ DLL и вспомогательные бинари из qemu/. QEMU не
 * запустится без libstdc++-6.dll, libgcc_s_seh-1.dll, libwinpthread-1.dll,
 * SDL2.dll, libcrypto-3-x64.dll и ещё ~100 файлов. Размер pack'а
 * вырастает с 947 МБ до ~1.1 ГБ, но без этого TrelEmu вообще не стартует.
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
// ВАЖНО: пишем в `dist-trel-emu/`, НЕ в `dist/`. Иначе glob `dist/**/*` в
// package.json `build.files` подхватит 1 ГБ zip-файл и засунет его в asar,
// превратив маленький инсталлятор в 1 ГБ дистрибутив. Это и был баг.
const OUT_DIR = path.join(ROOT, 'dist-trel-emu');
const OUT_ZIP = path.join(OUT_DIR, 'trel-emu-pack.zip');
const OUT_SHA1 = path.join(OUT_DIR, 'trel-emu-pack.zip.sha1');

// Что НЕ бандлим из qemu/: другие архитектуры (aarch64, arm, mips, etc.) —
// они не нужны для TrelEmu (только x86_64). Без них pack теряет ~700 МБ.
// Также выкидываем прочую мелочь (NSIS installer leftovers).
const QEMU_EXCLUDE_PATTERNS = [
  /^qemu-system-(aarch64|alpha|arm|avr|hppa|i386|loongarch64|m68k|microblaze|mips|mipsel|or1k|ppc|ppc64|riscv32|riscv64|rx|s390x|sh4|sh4eb|sparc|sparc64|tricore|xtensa|xtensaeb).*\.exe$/,
  /^qemu-system-.*w\.exe$/,    // Windows-on-Windows варианты
  /^\$PLUGINSDIR\//,           // NSIS installer leftovers
  // share/: оставляем только x86_64 bios/firmware (нужны для boot).
  // Остальные архитектуры (aarch64, arm, loongarch, riscv, sparc, ppc, hppa, m68k, rx, s390x, etc.) выкидываем.
  /^share\/(?!bios-256k\.bin|bios-microvm\.bin|bios\.bin|kvmvapic\.bin|vgabios-|edk2-x86_64-|linuxboot_dma\.bin|multiboot_dma\.bin|pvh\.bin|efi-|pxe-|qboot\.rom)/,
  // Текстовые файлы, лицензии, переводы, иконки, keymaps, man-страницы, dtb — не нужны для запуска.
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

// scrcpy/ — TrelEmu автоматически запускает scrcpy.exe после того как ADB
// подключился, чтобы увидеть экран Android. Бандлим всё, кроме мусорных
// файлов (батники, иконка, vbs).
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

// Собираем список всех файлов из qemu/ кроме exclude.
const FILES = [];
function walkQemuDir(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relName = prefix + entry.name;
    if (QEMU_EXCLUDE_PATTERNS.some(re => re.test(relName))) continue;
    if (entry.isDirectory()) {
      // Не рекурсируем в $PLUGINSDIR, share, lib (lib пустая) — но $PLUGINSDIR
      // и share уже отсеяли паттерном выше. Рекурсируем в lib (может быть что-то
      // полезное, но на практике пустая).
      if (entry.name === 'lib') continue;
      walkQemuDir(path.join(dir, entry.name), relName + '/');
    } else {
      FILES.push({ src: path.join(dir, entry.name), name: 'qemu/' + relName });
    }
  }
}
walkQemuDir(QEMU_DIR, '');

// scrcpy/ — для показа экрана Android после старта TrelEmu.
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
 * Минимальный zip-писатель (STORE — без сжатия, ISO уже сжатый).
 * Поддерживает только STORE (method=0) и DEFLATE (method=8).
 *
 * Структура:
 *   [Local file header + filename + extra + data] * N
 *   [Central directory header] * N
 *   [End of central directory record] (EOCD)
 *
 * Используем STORE для ISO (он уже не сжимается) и qemu (executable, плохо
 * жмётся). Это даёт +30% к размеру по сравнению с DEFLATE, но не грузит CPU
 * при сборке (важно — 1 ГБ ISO жать 5-10 минут смысла нет) и в 1000 раз
 * быстрее на распаковке у клиента.
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

// CRC32 для zip
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
log('  1) Upload dist/trel-emu-pack.zip to GitHub Releases of mkrlord1000-sketch/Trel');
log('  2) Use tag trel-emu-v0.3.0 (must match TrelEmuDownloader.DEFAULT_URL)');
log('  3) Upload dist/trel-emu-pack.zip.sha1 to the same release');
log('  4) Test: Trel.app → BrowsePage → click "Скачать"');

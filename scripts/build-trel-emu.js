/**
 * Build script для TrelEmu — бандл Android-эмулятора в resources/trel-emu/.
 *
 * Один раз загружает:
 *   1) QEMU static (Win64, NSIS-installer → распаковываем 7zip-ом или берём
 *      static-build с GitHub)
 *   2) Android-x86 9.0 ISO (~700 MB)
 *   3) Конвертирует ISO в qcow2 template + сжатый qcow2 (~250 MB)
 *
 * После первого запуска скрипт кэширует скачанное в build-trel-emu-cache/ —
 * повторные запуски ничего не качают, только пересобирают qcow2.
 *
 * Использование:
 *   node scripts/build-trel-emu.js              # полный билд
 *   node scripts/build-trel-emu.js --no-download  # пересобрать из кэша
 *
 * Окружение: Windows, Node 18+, qemu-img.exe в PATH (для конвертации).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');
const https = require('node:https');
const http = require('node:http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'resources', 'trel-emu');
const CACHE = path.join(ROOT, 'build-trel-emu-cache');

const QEMU_BASE = 'https://qemu.weilnetz.de/w64/';
const QEMU_INSTALLER = 'qemu-w64-setup-20260501.exe';
const QEMU_DIR = path.join(CACHE, 'qemu');

const ANDROID_ISO = path.join(CACHE, 'android-x86_64-9.0-r2.iso');
const ANDROID_ISO_URL = 'https://osdn.net/projects/android-x86/downloads/71941/android-x86_64-9.0-r2.iso';

const args = process.argv.slice(2);
const NO_DOWNLOAD = args.includes('--no-download');

function log(msg) { console.log(`[build-trel-emu] ${msg}`); }
function die(msg) { console.error(`[build-trel-emu] FATAL: ${msg}`); process.exit(1); }

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function fileExistsAndNonEmpty(p) {
  try { return fs.statSync(p).size > 0; } catch { return false; }
}

function downloadFile(url, dest, redirects = 0) {
  if (redirects > 5) throw new Error('Too many redirects: ' + url);
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = mod.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      let lastLog = 0;
      res.pipe(file);
      res.on('data', (chunk) => {
        received += chunk.length;
        const now = Date.now();
        if (total > 0 && now - lastLog > 5000) {
          const pct = (received / total * 100).toFixed(1);
          log(`  ${path.basename(dest)}: ${pct}% (${(received / 1024 / 1024).toFixed(1)}/${(total / 1024 / 1024).toFixed(1)} MB)`);
          lastLog = now;
        }
      });
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', (e) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
    req.setTimeout(120_000, () => req.destroy(new Error('Download timeout')));
  });
}

async function downloadIfMissing(url, dest) {
  if (NO_DOWNLOAD) {
    if (!fileExistsAndNonEmpty(dest)) die(`--no-download, но файла нет: ${dest}`);
    log(`  cache hit: ${path.basename(dest)}`);
    return;
  }
  if (fileExistsAndNonEmpty(dest)) {
    log(`  cache hit: ${path.basename(dest)}`);
    return;
  }
  log(`  downloading: ${url}`);
  ensureDir(path.dirname(dest));
  await downloadFile(url, dest);
  log(`  done: ${dest}`);
}

function findQemuImg() {
  // В PATH может быть QEMU от пользователя — не путаем с нашим.
  const candidates = [
    path.join(QEMU_DIR, 'qemu-img.exe'),
    path.join(OUT, 'qemu', 'qemu-img.exe'),
  ];
  for (const c of candidates) if (fileExistsAndNonEmpty(c)) return c;
  // Фолбэк: PATH (исключая пути с Netease/MuMu — это adb-конфликты)
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (/Netease|MuMu|Android/i.test(dir)) continue;
    const c = path.join(dir, 'qemu-img.exe');
    if (fileExistsAndNonEmpty(c)) return c;
  }
  return null;
}

function find7z() {
  const candidates = ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'];
  for (const c of candidates) if (fileExistsAndNonEmpty(c)) return c;
  return null;
}

async function step1Qemu() {
  log('STEP 1/4: QEMU');
  const outQemuDir = path.join(OUT, 'qemu');
  const outQemuSystem = path.join(outQemuDir, 'qemu-system-x86_64.exe');
  const outHasRuntime = fileExistsAndNonEmpty(outQemuSystem) &&
    fileExistsAndNonEmpty(path.join(outQemuDir, 'libwinpthread-1.dll'));
  if (outHasRuntime) {
    log('  already in resources/ with runtime DLLs — skip');
    return;
  }

  const installer = path.join(CACHE, QEMU_INSTALLER);
  if (!fileExistsAndNonEmpty(installer)) {
    log('  downloading QEMU installer (NSIS)…');
    await downloadFile(QEMU_BASE + QEMU_INSTALLER, installer);
  }

  const qemuSystem = path.join(QEMU_DIR, 'qemu-system-x86_64.exe');
  if (!fileExistsAndNonEmpty(qemuSystem)) {
    const sevenZip = find7z();
    if (!sevenZip) die('7z.exe не найден. Поставь 7-Zip или скачай QEMU static напрямую с GitHub.');
    ensureDir(QEMU_DIR);
    log('  extracting QEMU with 7z…');
    execSync(`"${sevenZip}" x -y -o"${QEMU_DIR}" "${installer}"`, { stdio: 'inherit' });
  }

  if (!fileExistsAndNonEmpty(qemuSystem)) {
    die('qemu-system-x86_64.exe не найден после распаковки. Структура инсталлятора изменилась?');
  }

  // Важно: QEMU for Windows из qemu.weilnetz.de динамически линкован.
  // Нельзя копировать только qemu-system-x86_64.exe и qemu-img.exe: без DLL
  // процесс молча завершается с 0xc0000135. Копируем весь runtime-каталог.
  copyDirRecursive(QEMU_DIR, outQemuDir);
  log('  QEMU runtime скопирован в resources/trel-emu/qemu/');
}

async function step2Android() {
  log('STEP 2/4: Android-x86 ISO');
  await downloadIfMissing(ANDROID_ISO_URL, ANDROID_ISO);
  // Копируем ISO в resources/ — TrelEmuService умеет грузиться напрямую с ISO
  // в live-режиме (без интерактивной установки). Это позволяет TrelEmu
  // работать из коробки без ручной возни с qcow2.
  const target = path.join(OUT, 'image', 'android-x86.iso');
  if (!fileExistsAndNonEmpty(target) || fileExistsAndNonEmpty(ANDROID_ISO)) {
    ensureDir(path.join(OUT, 'image'));
    fs.copyFileSync(ANDROID_ISO, target);
    log(`  ISO → ${target}`);
  }
}

async function step3Install() {
  log('STEP 3/4: Установка Android в qcow2');
  ensureDir(path.join(OUT, 'image'));
  const rawQcow = path.join(CACHE, 'android-9.0.raw.qcow2');
  if (fileExistsAndNonEmpty(path.join(OUT, 'image', 'android-9.0.qcow2'))) {
    log('  template уже собран — skip');
    return;
  }
  const qemuImg = findQemuImg();
  if (!qemuImg) die('qemu-img.exe не найден. Запусти step1Qemu сначала или поставь QEMU static.');
  if (!fileExistsAndNonEmpty(rawQcow)) {
    log('  создаю пустой qcow2 8G…');
    execSync(`"${qemuImg}" create -f qcow2 "${rawQcow}" 8G`, { stdio: 'inherit' });
    log('  ⚠️  ВНИМАНИЕ: для полного билда нужно вручную один раз:');
    log('     1) Загрузить ISO в QEMU (см. TrelEmu-спеку, шаг 1)');
    log('     2) Установить Android в ' + rawQcow);
    log('     3) Запустить скрипт повторно — он сожмёт готовый qcow2');
    log('  Сейчас положу заглушку, чтобы Trel не падал на импорте.');
    // Заглушка: пустой qcow2, Trel увидит "TrelEmu не найден".
    // Реальный билд требует интерактивной установки Android — этот шаг
    // нужно выполнить вручную (см. README в resources/trel-emu/).
    return;
  }
  log('  сжимаю qcow2…');
  const compressed = path.join(OUT, 'image', 'android-9.0.qcow2');
  execSync(`"${qemuImg}" convert -c -O qcow2 "${rawQcow}" "${compressed}"`, { stdio: 'inherit' });
  log('  шаблон готов: ' + compressed);
}

async function step4Config() {
  log('STEP 4/4: config.json + VERSION');
  ensureDir(OUT);
  if (!fileExistsAndNonEmpty(path.join(OUT, 'config.json'))) {
    fs.copyFileSync(path.join(__dirname, '..', 'resources', 'trel-emu', 'config.json'),
                    path.join(OUT, 'config.json'));
  }
  fs.writeFileSync(path.join(OUT, 'VERSION'), '0.1.0\n', 'utf-8');
}

(async () => {
  log('=== TrelEmu build ===');
  ensureDir(CACHE);
  ensureDir(OUT);
  try {
    await step1Qemu();
    await step2Android();
    await step3Install();
    await step4Config();
  } catch (e) {
    die(e.message);
  }
  log('=== done ===');
  log('Артефакты в: ' + OUT);
  log('  qemu/qemu-system-x86_64.exe — гипервизор');
  log('  qemu/qemu-img.exe — для overlay');
  log('  image/android-9.0.qcow2 — read-only шаблон');
  log('  config.json — RAM/CPU/port');
  log('  VERSION — для upgrade-detection');
  log('');
  log('⚠️  Если image/android-9.0.qcow2 пустой — выполни интерактивную');
  log('   установку Android по спеке TrelEmu (раздел 6), затем запусти');
  log('   этот скрипт повторно с --no-download.');
})();

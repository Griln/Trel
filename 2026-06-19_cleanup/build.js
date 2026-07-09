const { execSync } = require('child_process');

console.log('=== Останавливаем мешающие процессы ===');

const processes = [
  'Trel.exe',
  'qemu-system-x86_64.exe',
  'qemu-img.exe',
  'scrcpy.exe',
  'adb.exe',
  'electron.exe',
];

for (const proc of processes) {
  try {
    execSync(`taskkill /F /IM ${proc}`, { stdio: 'ignore', timeout: 5000 });
    console.log(`  ✓ ${proc} остановлен`);
  } catch {
    console.log(`  · ${proc} не запущен (ок)`);
  }
}

console.log('\n=== Запускаем сборку: npm run dist ===');
try {
  const out = execSync('npm run dist', {
    encoding: 'utf-8',
    stdio: 'inherit',
    timeout: 600_000,
    shell: true,
  });
} catch (e) {
  console.error('Сборка завершилась с ошибкой:', e.message);
  process.exit(e.status || 1);
}

console.log('\n=== Сборка завершена! ===');

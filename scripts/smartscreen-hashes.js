const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * SmartScreen Reputation Helper
 * 
 * Microsoft Defender SmartScreen блокирует неподписанные .exe.
 * Чтобы ускорить накопление репутации, можно отправить файл
 * в Microsoft через форму: https://www.microsoft.com/en-us/wdsi/filesubmission
 * 
 * Этот скрипт выводит SHA256 хеши релизных файлов — вставь их в форму.
 */

const RELEASE_DIR = path.resolve(__dirname, '..', 'release');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function main() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('release/ directory not found. Run npm run dist first.');
    process.exit(1);
  }

  const files = fs.readdirSync(RELEASE_DIR).filter(f => f.endsWith('.exe'));
  if (files.length === 0) {
    console.error('No .exe files found in release/');
    process.exit(1);
  }

  console.log('\n=== Microsoft SmartScreen Submission ===\n');
  console.log('Form URL: https://www.microsoft.com/en-us/wdsi/filesubmission');
  console.log('\nSelect: "Software developer" → "I am a software developer"');
  console.log('Select: "Category: Developer / Programming tools"');
  console.log('Enter SHA256 hashes below or attach files directly.\n');

  for (const file of files) {
    const filePath = path.join(RELEASE_DIR, file);
    const hash = sha256(filePath);
    const size = fs.statSync(filePath).size;
    console.log(`File:  ${file}`);
    console.log(`Size:  ${size.toLocaleString()} bytes`);
    console.log(`SHA256: ${hash}`);
    console.log('---');
  }

  console.log('\n=== VirusTotal Scan (optional but recommended) ===\n');
  console.log('Upload to: https://www.virustotal.com/gui/home/upload');
  console.log('This helps other antivirus engines whitelist your file.\n');
}

main();

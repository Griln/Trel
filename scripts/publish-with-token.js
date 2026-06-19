const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const tokenPath = path.join(__dirname, '..', 'chat_history', 'токен.txt');
if (!fs.existsSync(tokenPath)) {
  console.error(`[publish] GitHub token file not found: ${tokenPath}`);
  process.exit(1);
}
const token = fs.readFileSync(tokenPath, 'utf8').trim();
if (!/^(ghp_|github_pat_|gho_|ghu_)[A-Za-z0-9_]+$/.test(token)) {
  console.error('[publish] GitHub token file exists, but token format is not recognized.');
  process.exit(1);
}

console.log('[publish] GitHub token loaded from chat_history/токен.txt');
console.log('[publish] Token is not printed for safety.');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(cmd, ['electron-builder', '--win', '--publish', 'always'], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
  },
});

process.exit(result.status ?? 1);

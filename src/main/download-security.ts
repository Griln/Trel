import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const TRUSTED_EXACT_HOSTS = new Set([
  'launchermeta.mojang.com',
  'piston-meta.mojang.com',
  'piston-data.mojang.com',
  'launcher.mojang.com',
  'launchercontent.mojang.com',
  'resources.download.minecraft.net',
  'libraries.minecraft.net',
  's3.amazonaws.com',
  'files.minecraftforge.net',
  'maven.neoforged.net',
  'meta.fabricmc.net',
  'meta.quiltmc.org',
  'bmclapi2.bangbang93.com',
  'mcpehub.org',
]);

const TRUSTED_HOST_SUFFIXES = [
  '.mojang.com',
  '.minecraft.net',
  '.minecraftservices.com',
  '.microsoft.com',
  '.live.com',
  '.xboxlive.com',
  '.azureedge.net',
  '.akamaized.net',
];

const HIGH_RISK_EXTENSIONS = new Set([
  '.apk', '.appx', '.bat', '.cmd', '.com', '.dll', '.dylib', '.exe', '.jar', '.js',
  '.msi', '.ps1', '.scr', '.so', '.vbs', '.zip', '.7z', '.rar', '.tar', '.gz',
]);

export interface DownloadSourceTrust {
  allowed: boolean;
  reason: string;
  host?: string;
}

export function verifyDownloadSource(url: string): DownloadSourceTrust {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return { allowed: false, host: u.hostname, reason: 'Источник не подтверждён: разрешены только HTTPS-ссылки.' };
    }

    const host = u.hostname.toLowerCase();
    if (TRUSTED_EXACT_HOSTS.has(host) || TRUSTED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      return { allowed: true, host, reason: `Источник автоматически подтверждён: ${host}` };
    }

    return { allowed: false, host, reason: `Источник не подтверждён: ${host}` };
  } catch {
    return { allowed: false, reason: 'Источник не подтверждён: некорректная ссылка.' };
  }
}

export function isUrlAllowed(url: string): boolean {
  return verifyDownloadSource(url).allowed;
}

export function shouldVirusScan(filePath: string): boolean {
  return HIGH_RISK_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function defenderCandidates(): string[] {
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const candidates = [
    path.join(programData, 'Microsoft', 'Windows Defender', 'Platform'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Defender'),
  ];
  const out: string[] = [];

  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue;
      const stat = fs.statSync(c);
      if (stat.isDirectory()) {
        const direct = path.join(c, 'MpCmdRun.exe');
        if (fs.existsSync(direct)) out.push(direct);
        for (const entry of fs.readdirSync(c)) {
          const exe = path.join(c, entry, 'MpCmdRun.exe');
          if (fs.existsSync(exe)) out.push(exe);
        }
      } else if (path.basename(c).toLowerCase() === 'mpcmdrun.exe') {
        out.push(c);
      }
    } catch {}
  }

  return Array.from(new Set(out)).sort().reverse();
}

export function findWindowsDefenderScanner(): string | null {
  if (process.platform !== 'win32') return null;
  return defenderCandidates()[0] ?? null;
}

export function scanDownloadedFile(filePath: string): { scanned: boolean; scanner?: string; skippedReason?: string } {
  if (!shouldVirusScan(filePath)) return { scanned: false, skippedReason: 'low-risk extension' };
  if (!fs.existsSync(filePath)) throw new Error(`Virus scan failed: file not found: ${filePath}`);

  const scanner = findWindowsDefenderScanner();
  if (!scanner) return { scanned: false, skippedReason: 'Windows Defender scanner not found' };

  // Synchronous fallback kept only for tests/legacy callers. Runtime download
  // paths must use scanDownloadedFileAsync so Electron does not freeze.
  throw new Error('scanDownloadedFile is synchronous and disabled for runtime. Use scanDownloadedFileAsync instead.');
}

export async function scanDownloadedFileAsync(filePath: string): Promise<{ scanned: boolean; scanner?: string; skippedReason?: string }> {
  if (!shouldVirusScan(filePath)) return { scanned: false, skippedReason: 'low-risk extension' };
  if (!fs.existsSync(filePath)) throw new Error(`Virus scan failed: file not found: ${filePath}`);

  const scanner = findWindowsDefenderScanner();
  if (!scanner) return { scanned: false, skippedReason: 'Windows Defender scanner not found' };

  await new Promise<void>((resolve, reject) => {
    const child = spawn(scanner, ['-Scan', '-ScanType', '3', '-File', filePath, '-DisableRemediation'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(`Windows Defender scan timed out for ${path.basename(filePath)}`));
    }, 120_000);

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Windows Defender scan failed with code ${code}: ${stderr || stdout}`));
    });
  }).catch((e) => {
    try { fs.unlinkSync(filePath); } catch {}
    const msg = (e as Error).message || String(e);
    throw new Error(`Windows Defender заблокировал или не смог проверить файл: ${path.basename(filePath)}. ${msg}`);
  });

  return { scanned: true, scanner };
}

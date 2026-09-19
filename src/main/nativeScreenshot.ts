
import { execFileSync } from 'node:child_process';
import { BrowserWindow, Notification, globalShortcut, screen, desktopCapturer, nativeImage } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Trel's OWN screenshot capturer — captures ONLY the Minecraft window's client
 * area (no OS title bar / borders, never beyond the game bounds). Uses a Win32
 * helper (via PowerShell) to resolve the foreground game window's client rect
 * in physical screen pixels, then crops the display capture to it.
 */

const PS_SCRIPT = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TrelWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
}
"@
[TrelWin]::SetProcessDPIAware() | Out-Null

function Get-Title([IntPtr]$h) {
  $len = [TrelWin]::GetWindowTextLength($h)
  if ($len -le 0) { return "" }
  $sb = New-Object System.Text.StringBuilder ($len + 1)
  [void][TrelWin]::GetWindowText($h, $sb, $sb.Capacity)
  return $sb.ToString()
}
function Get-Proc([IntPtr]$h) {
  [uint32]$pid = 0
  [void][TrelWin]::GetWindowThreadProcessId($h, [ref]$pid)
  try { return (Get-Process -Id $pid -ErrorAction Stop).ProcessName.ToLower() } catch { return "" }
}
function Is-Minecraft([IntPtr]$h) {
  $p = Get-Proc $h
  $t = Get-Title $h
  if ($p -eq "javaw" -or $p -eq "java") { return $true }
  if ($t -like "Minecraft*") { return $true }
  return $false
}

# 1) Prefer the foreground window if it is the game.
$target = [IntPtr]::Zero
$fg = [TrelWin]::GetForegroundWindow()
if ($fg -ne [IntPtr]::Zero -and (Is-Minecraft $fg)) { $target = $fg }

# 2) Otherwise scan all visible windows for the largest Minecraft one.
if ($target -eq [IntPtr]::Zero) {
  $best = [IntPtr]::Zero; $bestArea = 0
  $cb = [TrelWin+EnumProc]{
    param([IntPtr]$h, [IntPtr]$l)
    if ([TrelWin]::IsWindowVisible($h) -and (Is-Minecraft $h)) {
      $r = New-Object TrelWin+RECT
      [void][TrelWin]::GetClientRect($h, [ref]$r)
      $area = ($r.right - $r.left) * ($r.bottom - $r.top)
      if ($area -gt $script:bestArea) { $script:bestArea = $area; $script:best = $h }
    }
    return $true
  }
  $script:best = [IntPtr]::Zero; $script:bestArea = 0
  [void][TrelWin]::EnumWindows($cb, [IntPtr]::Zero)
  $target = $script:best
}

if ($target -eq [IntPtr]::Zero) { Write-Output '{"ok":false}'; exit 0 }

$rc = New-Object TrelWin+RECT
[void][TrelWin]::GetClientRect($target, [ref]$rc)
$pt = New-Object TrelWin+POINT
$pt.x = 0; $pt.y = 0
[void][TrelWin]::ClientToScreen($target, [ref]$pt)
$w = $rc.right - $rc.left
$h = $rc.bottom - $rc.top
if ($w -le 0 -or $h -le 0) { Write-Output '{"ok":false}'; exit 0 }
$title = (Get-Title $target) -replace '"','\"'
$proc = Get-Proc $target
Write-Output ('{"ok":true,"x":' + $pt.x + ',"y":' + $pt.y + ',"w":' + $w + ',"h":' + $h + ',"title":"' + $title + '","proc":"' + $proc + '"}')
`;

export class NativeScreenshotService {
  private hotkey = 'F2';
  private getDir: () => string;
  private getWin: () => BrowserWindow | null;
  private isGameRunning?: () => boolean;
  private busy = false;
  private psFile: string | null = null;

  constructor(getDir: () => string, getWin: () => BrowserWindow | null, isGameRunning?: () => boolean) {
    this.getDir = getDir;
    this.getWin = getWin;
    this.isGameRunning = isGameRunning;
  }

  private toAccelerator(key: string): string | null {
    const k = (key || '').trim().toUpperCase();
    if (!k) return null;
    if (k === 'SPACE') return 'Space';
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(k)) return k;
    if (/^[A-Z0-9]$/.test(k)) return k;
    return null;
  }

  setHotkey(key: string): { ok: boolean; reason?: string } {
    globalShortcut.unregister(this.toAccelerator(this.hotkey) || this.hotkey);
    const accel = this.toAccelerator(key);
    if (!accel) return { ok: false, reason: 'unsupported-key' };
    this.hotkey = key;
    try {
      const ok = globalShortcut.register(accel, () => { void this.capture(); });
      return ok ? { ok: true } : { ok: false, reason: 'register-failed' };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  /** Resolve the Minecraft window client rect (physical px) via Win32 helper. */
  private resolveGameRect(): { x: number; y: number; w: number; h: number; title: string } | null {
    // Win32-only: точные границы клиентской области окна Minecraft через
    // PowerShell + Win32 API. На Linux/macOS вернуть их надёжно нельзя
    // (Wayland, нет xdotool/wmctrl), поэтому возвращаем null — capture()
    // в этом случае снимает весь экран под курсором вместо кропа по окну.
    if (process.platform !== 'win32') return null;
    try {
      if (!this.psFile) {
        this.psFile = path.join(os.tmpdir(), 'trel-winrect.ps1');
        fs.writeFileSync(this.psFile, PS_SCRIPT, 'utf8');
      }
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.psFile],
        { timeout: 4000, windowsHide: true },
      ).toString().trim();
      const line = out.split(/\r?\n/).filter(Boolean).pop() || '';
      const data = JSON.parse(line);
      if (!data.ok) return null;
      return { x: data.x, y: data.y, w: data.w, h: data.h, title: data.title || 'Minecraft' };
    } catch (e) {
      console.error('[native-screenshot] resolveGameRect failed:', e);
      return null;
    }
  }

  /** Capture ONLY the Minecraft window's client area and save it as PNG. */
  async capture(): Promise<string | null> {
    // Если игра не запущена через Trel — снимать нечего: не дёргаем захват
    // экрана (на Linux это дорогой запрос к порталу скриншотов/доступу).
    if (this.isGameRunning && !this.isGameRunning()) return null;
    if (this.busy) return null;
    this.busy = true;
    try {
      const rect = this.resolveGameRect();

      // Windows без окна Minecraft — молча выходим (снимать нечего).
      // На Linux/macOS rect всегда null — это нормально: снимаем весь экран,
      // где сейчас курсор (как правило там и игра, раз пользователь играет).
      if (process.platform === 'win32' && !rect) return null;

      let display: Electron.Display;
      if (rect) {
        // Windows: дисплей, содержащий окно игры (rect в физических px).
        const scaleGuessPoint = { x: rect.x + 2, y: rect.y + 2 };
        display =
          screen.getAllDisplays().find((d) => {
            const b = d.bounds; const s = d.scaleFactor || 1;
            const left = b.x * s, top = b.y * s, right = (b.x + b.width) * s, bottom = (b.y + b.height) * s;
            return scaleGuessPoint.x >= left && scaleGuessPoint.x < right && scaleGuessPoint.y >= top && scaleGuessPoint.y < bottom;
          }) || screen.getPrimaryDisplay();
      } else {
        // Linux/macOS: дисплей под курсором (DIP-координаты).
        const cur = screen.getCursorScreenPoint();
        display =
          screen.getAllDisplays().find((d) => {
            const b = d.bounds;
            return cur.x >= b.x && cur.x < b.x + b.width && cur.y >= b.y && cur.y < b.y + b.height;
          }) || screen.getPrimaryDisplay();
      }
      const scale = display.scaleFactor || 1;
      const physW = Math.round(display.size.width * scale);
      const physH = Math.round(display.size.height * scale);

      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: physW, height: physH } });
      const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
      if (!src) { this.busy = false; return null; }
      const img = src.thumbnail;

      // Windows: кроп до клиентской области окна игры. Linux/macOS: весь экран.
      let out = img;
      if (rect) {
        const tsize = img.getSize();
        const ratioX = tsize.width / physW;
        const ratioY = tsize.height / physH;
        const originX = display.bounds.x * scale;
        const originY = display.bounds.y * scale;
        let cx = Math.round((rect.x - originX) * ratioX);
        let cy = Math.round((rect.y - originY) * ratioY);
        let cw = Math.round(rect.w * ratioX);
        let ch = Math.round(rect.h * ratioY);
        cx = Math.max(0, Math.min(cx, tsize.width - 1));
        cy = Math.max(0, Math.min(cy, tsize.height - 1));
        cw = Math.max(1, Math.min(cw, tsize.width - cx));
        ch = Math.max(1, Math.min(ch, tsize.height - cy));
        out = img.crop({ x: cx, y: cy, width: cw, height: ch });
      }
      const png = out.toPNG();

      const dir = path.join(this.getDir(), 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const name =
        `Trel_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
        `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}.png`;
      const file = path.join(dir, name);
      fs.writeFileSync(file, png);

      const win = this.getWin();
      if (win && !win.isDestroyed()) win.webContents.send('screenshots:captured', { path: file, name });
      this.notify(name, file);
      return file;
    } catch (e) {
      console.error('[native-screenshot] capture failed:', e);
      return null;
    } finally {
      this.busy = false;
    }
  }

  private notify(name: string, file: string) {
    try {
      if (!Notification.isSupported()) return;
      // Превью скриншота как иконка уведомления — выглядит аккуратнее.
      let icon: Electron.NativeImage | undefined;
      try {
        const thumb = nativeImage.createFromPath(file);
        icon = thumb.isEmpty() ? undefined : thumb.resize({ width: 96, height: 54 });
      } catch { icon = undefined; }
      const n = new Notification({
        title: '📸 Скриншот готов',
        body: 'Сохранён в галерею Trel · ' + name,
        silent: false,
        icon,
      });
      // Клик по уведомлению — открыть окно лаунчера.
      n.on('click', () => {
        try {
          const win = this.getWin();
          if (win && !win.isDestroyed()) { win.show(); win.focus(); }
        } catch { /* ignore */ }
      });
      n.show();
    } catch { /* ignore */ }
  }

  dispose() {
    const accel = this.toAccelerator(this.hotkey);
    if (accel) globalShortcut.unregister(accel);
  }
}
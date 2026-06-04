# Systems Analysis for New Settings Wiring

## 1. Launch Flow

### Entry Point
The game is launched via `@xmcl/core`'s `launch()` function — NOT a raw `child_process.spawn`.

**File: `src/main/minecraft.ts`**

#### Call chain:
1. **IPC handler** (`src/main/ipc.ts:293`):
   ```ts
   ipcMain.handle('minecraft:launch', async (_e, opts: LaunchOptions) => {
     const s = store.loadSettings();
     return mc.launch(opts, win, s.javaPath);
   });
   ```
2. **`MinecraftService.launch()`** (`src/main/minecraft.ts:544`) — double-click guard
3. **`MinecraftService.doLaunch()`** (`src/main/minecraft.ts:559`) — actual logic

#### Where JVM args are assembled (`minecraft.ts:650-666`):
```ts
const launchOption: LaunchOption = {
  version: opts.versionId,
  gamePath: this.gameDir,
  javaPath,
  nativeRoot: path.join(...),
  gameProfile: { name: opts.account.name, id: opts.account.uuid },
  accessToken: '0'.repeat(32),
  userType: 'legacy',
  launcherName: 'Trel',
  launcherBrand: 'Trel',
  minMemory: Math.floor(opts.memoryMb / 2),
  maxMemory: opts.memoryMb,
  extraJVMArgs: [
    `-Duser.home=${this.gameDir}`,
    `-Duser.dir=${this.gameDir}`,
    ...authlibArgs,
  ],
  extraExecOption: {
    env: childEnv,
    cwd: this.gameDir,
  },
};
const proc = await launch(launchOption);
```

#### Where window width/height/fullscreen could be passed:
The `@xmcl/core` `LaunchOption` type supports `resolution` field:
```ts
resolution?: { width: number; height: number; fullscreen?: boolean }
```
Currently **NOT used**. Would be added to `launchOption` at line ~650 in `doLaunch()`.

#### Where pre/post launch commands could be added:
- **Pre-launch**: Just before `const proc = await launch(launchOption)` at line **668**
- **Post-launch**: After `proc.on('exit', ...)` handler at lines **678-680**, or inside the exit handler itself

#### Where "close launcher on launch" could be implemented:
After `const proc = await launch(launchOption)` at line **668**, before the stdout/stderr listeners. Use `win.hide()` or `app.quit()`. The exit handler (line 678) would need to restore/re-show the window.

#### Process event handling (`minecraft.ts:670-681`):
```ts
proc.stdout?.on('data', (d) => win.webContents.send('minecraft:log', d.toString()));
proc.stderr?.on('data', (d) => win.webContents.send('minecraft:log', d.toString()));
proc.on('exit', (code) => win.webContents.send('minecraft:exit', code ?? -1));
```
Logs go to renderer via IPC channel `minecraft:log`. Exit code via `minecraft:exit`.

---

## 2. Version Filtering in BrowsePage.tsx

**File: `src/renderer/pages/BrowsePage.tsx` (629 lines)**

### How versions are listed:
- Fetched from `window.api.minecraft.versions()` on mount (line 85)
- Returns `VersionInfo[]` with `type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'`

### Filter system (already exists!):
```ts
type Filter = 'all' | 'release' | 'snapshot' | 'old_beta' | 'old_alpha';  // line 44
```

State: `const [filter, setFilter] = useState<Filter>('release');` — defaults to **release only** (line 67)

### Filtering logic (`BrowsePage.tsx:157-163`):
```ts
const filtered = useMemo(() => {
  return versions.filter((v) => {
    if (query && !v.id.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'all') return true;
    return v.type === filter;
  });
}, [versions, query, filter]);
```

### Filter tabs UI (`BrowsePage.tsx:277-286`):
Shows tabs: Релизы, Снапшоты, Beta, Alpha, Все — with counts per type.

### Where `showSnapshots`/`showOldVersions` settings would be checked:
There is **NO settings-based filtering** currently — user manually clicks filter tabs. A `showSnapshots` setting could:
- Option A: Remove snapshot/old_beta/old_alpha tabs and entries when disabled
- Option B: Change the initial filter and hide tabs

Best approach: modify `filterTabs` array (line 277) and `filtered` memo (line 157) to respect settings like `settings.showSnapshots` and `settings.showOldVersions`.

---

## 3. Console/Log Display

### There is NO dedicated LogConsole component.

Log display is **inline in `HomePage.tsx`** (lines 298-316):

```tsx
{logLines.length > 0 && statusType === 'error' && (
  <div className="card">
    <div className="card-head">
      <h2>Лог последнего запуска</h2>
      <span className="chip danger">{logLines.length} строк</span>
      <button onClick={() => setShowLog((v) => !v)}>
        {showLog ? 'Скрыть' : 'Показать'}
      </button>
      <button onClick={() => setLogLines([])}>Очистить</button>
    </div>
    {showLog && <div className="log" ref={logRef}>{logLines.join('')}</div>}
  </div>
)}
```

Key facts:
- **Only shown on error** (`statusType === 'error'`), collapsed by default
- Log lines stored in state: `const [logLines, setLogLines] = useState<string[]>([])` (line 38)
- Capped at 500 lines: `[...p.slice(-500), line]` (line 50)
- Subscribed via `window.api.minecraft.onLog()` (preload line 345)
- Auto-scrolls via `logRef` + useEffect (lines 64-66)

### For a "show game console" setting:
- Currently log only shows after error. A setting could make it always visible or auto-expand.
- Alternatively, a new dedicated `GameConsole` component could be created.

---

## 4. Settings Store

**File: `src/main/settings.ts` (64 lines)** — FULL CONTENTS:

```ts
export class SettingsStore {
  constructor(private launcherDir: string) {
    this.settingsFile = path.join(launcherDir, 'settings.json');
    this.accountsFile = path.join(launcherDir, 'accounts.json');
  }

  loadSettings(): LauncherSettings {
    const defaults: LauncherSettings = {
      gameDir: path.join(this.launcherDir, 'minecraft'),
      memoryMb: 2048,
    };
    // Reads settings.json, validates field types, merges with defaults
    // Each field is individually validated (type-checked)
  }

  saveSettings(s: LauncherSettings): void {
    fs.writeFileSync(this.settingsFile, JSON.stringify(s, null, 2), 'utf-8');
  }
}
```

### How defaults work:
- `defaults` object has only required fields: `gameDir` and `memoryMb`
- Each optional field (`javaPath`, `lastVersionId`, `theme`) is checked with `typeof` guard
- Unknown/corrupt values silently fall back to defaults
- **To add new settings**: 
  1. Add to `LauncherSettings` interface in `src/shared/types.ts`
  2. Add `typeof` validation in `loadSettings()` for each new field
  3. No need to add to `defaults` if optional (undefined is fine)

### Validation pattern (line 26-32):
```ts
if (typeof raw.gameDir === 'string' && raw.gameDir.length > 0) out.gameDir = raw.gameDir;
if (typeof raw.memoryMb === 'number' && raw.memoryMb >= 256) out.memoryMb = raw.memoryMb;
if (typeof raw.javaPath === 'string') out.javaPath = raw.javaPath;
if (typeof raw.lastVersionId === 'string') out.lastVersionId = raw.lastVersionId;
if (typeof raw.theme === 'string' && THEME_IDS.includes(raw.theme)) out.theme = raw.theme;
```

---

## 5. LaunchOptions Type

**File: `src/shared/types.ts:23-27`**

```ts
export interface LaunchOptions {
  versionId: string;
  account: MinecraftAccount;
  memoryMb: number;
}
```

Currently has only 3 fields. Window resolution, extra JVM args, etc. are NOT passed through this interface — they'd need to be added or handled via settings.

---

## 6. LauncherSettings Type

**File: `src/shared/types.ts:29-36`**

```ts
export interface LauncherSettings {
  gameDir: string;
  memoryMb: number;
  javaPath?: string;
  lastVersionId?: string;
  theme?: ThemeId;
}
```

---

## Summary: Where to Wire New Settings

| Setting | Type Definition | Backend Hook | Frontend Hook |
|---------|----------------|-------------|--------------|
| `jvmArgs` (extra) | `LauncherSettings` or `LaunchOptions` | `minecraft.ts:660` → add to `extraJVMArgs` | SettingsPage.tsx |
| `windowWidth/Height` | `LauncherSettings` | `minecraft.ts:650` → add `resolution` to `launchOption` | SettingsPage.tsx |
| `fullscreen` | `LauncherSettings` | `minecraft.ts:650` → `resolution.fullscreen` | SettingsPage.tsx |
| `showSnapshots` | `LauncherSettings` | N/A (renderer-only) | `BrowsePage.tsx:157` filter logic |
| `showOldVersions` | `LauncherSettings` | N/A (renderer-only) | `BrowsePage.tsx:157` filter logic |
| `preLaunchCommand` | `LauncherSettings` | `minecraft.ts:668` → exec before `launch()` | SettingsPage.tsx |
| `postExitCommand` | `LauncherSettings` | `minecraft.ts:678` → exec in exit handler | SettingsPage.tsx |
| `closeLauncherOnLaunch` | `LauncherSettings` | `minecraft.ts:670` → `win.hide()` after launch | SettingsPage.tsx |
| `showGameLog` | `LauncherSettings` | N/A (renderer-only) | `HomePage.tsx:298` condition |

### Key files to modify:
1. **`src/shared/types.ts`** — Add fields to `LauncherSettings` (and possibly `LaunchOptions`)
2. **`src/main/settings.ts`** — Add validation in `loadSettings()` for each new field
3. **`src/main/minecraft.ts`** — Wire resolution, extra JVM args, pre/post commands, close-on-launch
4. **`src/main/ipc.ts:293`** — Pass additional settings to `mc.launch()` if needed
5. **`src/renderer/pages/BrowsePage.tsx`** — Wire showSnapshots/showOldVersions
6. **`src/renderer/pages/HomePage.tsx`** — Wire showGameLog
7. **`src/renderer/pages/SettingsPage.tsx`** — Add UI controls for all new settings

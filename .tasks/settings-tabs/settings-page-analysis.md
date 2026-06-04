# SettingsPage.tsx Full Analysis

## File: `src/renderer/pages/SettingsPage.tsx` (499 lines)

### Imports (lines 1–6)
```tsx
import React, { useEffect, useState } from 'react';
import type { LauncherSettings, ThemeId } from '../../shared/types';
import type { JavaInstallInfo, UpdaterState } from '../../preload/preload';
import { IconRefresh, IconFolder, IconCheck, IconAlert, IconTrash } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';
```

### Constants (lines 8–35)
- `ThemeOption` interface and `THEME_OPTIONS` array (mono, eclipse, voxel themes with swatches)

### Component Props (lines 37–40)
```tsx
interface Props {
  settings: LauncherSettings;
  onChange: (s: LauncherSettings) => void;
}
```

### State & Hooks (lines 42–55)
- `local` — local copy of settings
- `javaList` — detected Java installations
- `scanning` — java scan in progress
- `updater` — updater state
- `useEffect` loads java list + updater state on mount

### Helper Functions (lines 57–82)
- `apply(next)` — merges partial settings, handles empty javaPath
- `pickDir()` — opens directory picker for gameDir
- `rescan()` — re-scans for Java installations
- `gb` — computed memory display value

### Update Label (lines 84–96)
- `updateLabel(s)` — maps UpdaterState to localized string

### Dialog Handlers (lines 98–176)
- `onResetLauncher()` — 2-step danger dialog for launcher reset
- `onUninstallLauncher()` — 2-step danger dialog for launcher uninstall

### JSX Sections (lines 178–499) — CARD ORDER:

| # | Lines | Card / Section | Proposed Tab |
|---|-------|---------------|-------------|
| 1 | 178–183 | Page header (`page-head`) | Shared (always visible) |
| 2 | 185–215 | **Update** card (version, check update, progress bar) | **General** |
| 3 | 217–253 | **Theme** card (theme grid with swatches) | **General** |
| 4 | 255–269 | **Language** card (ru/en toggle) | **General** |
| 5 | 271–287 | **Memory** card (RAM slider 1-16 GB) | **Game** |
| 6 | 289–301 | **JVM Args** card (text input) | **Game** |
| 7 | 303–330 | **Window** card (width, height, fullscreen) | **Game** |
| 8 | 332–351 | **Behavior** card (closeOnLaunch, showConsole) | **General** |
| 9 | 353–365 | **Versions** card (showSnapshots toggle) | **Game** |
| 10 | 367–391 | **Commands** card (pre/post command inputs) | **Game** |
| 11 | 393–410 | **Game Directory** card (path + picker) | **General** |
| 12 | 412–464 | **Java** card (auto-detected list + custom path) | **Game** |
| 13 | 466–497 | **Danger Zone** card (reset + uninstall) | **Danger Zone** |

### Proposed Tab Split

**Tab 1: General** (cards 2, 3, 4, 8, 11)
- Update (theme, language, update check, behavior, game directory)

**Tab 2: Game** (cards 5, 6, 7, 9, 10, 12)
- Memory, JVM args, window size, versions visibility, commands, Java

**Tab 3: Danger Zone** (card 13)
- Reset launcher, Uninstall

---

## Existing Tab CSS Patterns in styles.css

### Pattern 1: `.content-tabs` / `.content-tab` (lines 2951–2997) — BEST MATCH for horizontal tabs

This is an **inline horizontal pill-style tab bar** used in ContentPage (mods/shaders/resourcepacks):

```css
.content-tabs {
    display: inline-flex;
    gap: 4px;
    padding: 5px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 14px;
    box-shadow: var(--shadow-inner);
}
.content-tab {
    background: transparent;
    border: 1px solid transparent;
    color: var(--fg-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 7px 12px;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition:
        background var(--t-fast),
        color var(--t-fast),
        border-color var(--t-fast);
}
.content-tab svg {
    width: 14px;
    height: 14px;
    stroke-width: 1.75;
}
.content-tab:hover {
    color: var(--fg);
    background: var(--surface-2);
}
.content-tab.active {
    color: var(--fg-bright);
    background: var(--surface-2);
    border-color: var(--border-strong);
    box-shadow: inset 0 0 0 1px var(--accent-border);
}
.content-tab.active svg {
    color: var(--accent-bright);
}
```

**Recommendation:** Reuse `.content-tabs` + `.content-tab` pattern directly for the settings tabs. Either reuse the exact classes, or create `.settings-tabs` / `.settings-tab` with identical styles. The pill-style horizontal tab bar fits perfectly under the page header.

### Pattern 2: `.lib-side-tabs` / `.side-tab` (lines 1178–1305) — vertical sidebar tabs

Used in BrowsePage as a 2-column grid sidebar filter. NOT suitable for settings page horizontal tabs, but shares the same `.active` state pattern.

```css
.lib-side-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
}
.side-tab { /* button style with grid layout, 3-column: dot | label | count */ }
.side-tab.active { /* highlighted state */ }
```

### Pattern 3: `.danger-zone` (lines 2643–2669) — already exists

The danger zone card styling already exists and is used in the current settings page:
```css
.card.danger-zone {
    border-color: rgba(var(--danger-rgb), 0.22);
    background: linear-gradient(180deg, rgba(var(--danger-rgb), 0.05), transparent 60%), var(--surface);
}
```

---

## Full SettingsPage.tsx Source Code

```tsx
import React, { useEffect, useState } from 'react';
import type { LauncherSettings, ThemeId } from '../../shared/types';
import type { JavaInstallInfo, UpdaterState } from '../../preload/preload';
import { IconRefresh, IconFolder, IconCheck, IconAlert, IconTrash } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

interface ThemeOption {
  id: ThemeId;
  name: string;
  descKey: string;
  swatches: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'mono',
    name: 'Mono',
    descKey: 'settings.monoDesc',
    swatches: ['#0a0a0a', '#131313', '#ffffff'],
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    descKey: 'settings.eclipseDesc',
    swatches: ['#f4f5f8', '#ffffff', '#1a1a1a'],
  },
  {
    id: 'voxel',
    name: 'Voxel',
    descKey: 'settings.voxelDesc',
    swatches: ['#0d1612', '#50c878', '#ffd93d'],
  },
];

interface Props {
  settings: LauncherSettings;
  onChange: (s: LauncherSettings) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onChange }) => {
  const dlg = useDialog();
  const t = useT();
  const [local, setLocal] = useState<LauncherSettings>(settings);
  const [javaList, setJavaList] = useState<JavaInstallInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [updater, setUpdater] = useState<UpdaterState | null>(null);

  useEffect(() => {
    window.api.java.list().then(setJavaList);
    window.api.updater.state().then(setUpdater);
    return window.api.updater.onState(setUpdater);
  }, []);

  const apply = (next: Partial<LauncherSettings>) => {
    const merged: LauncherSettings = { ...local, ...next };
    if (merged.javaPath === '' || merged.javaPath === undefined) {
      delete (merged as any).javaPath;
    }
    setLocal(merged);
    onChange(merged);
  };

  const pickDir = async () => {
    const dir = await window.api.settings.pickDir();
    if (dir) apply({ gameDir: dir });
  };

  const rescan = async () => {
    setScanning(true);
    try {
      const list = await window.api.java.scan();
      setJavaList(list);
    } finally {
      setScanning(false);
    }
  };

  const gb = (local.memoryMb / 1024).toFixed(1);

  const updateLabel = (s: UpdaterState): string => {
    switch (s.status) {
      case 'checking': return t('settings.checking');
      case 'available': return t('settings.available', { version: s.latest! });
      case 'downloading': return t('settings.downloading', { percent: s.percent ?? 0 });
      case 'downloaded': return t('settings.downloaded') + `: v${s.latest}`;
      case 'up-to-date': return t('settings.upToDate');
      case 'error': return t('settings.updateError') + ': ' + (s.error ?? '');
      case 'disabled': return t('settings.disabled');
      default: return '—';
    }
  };

  const onResetLauncher = async () => {
    const step1 = await dlg.show({
      title: t('settings.resetTitle'),
      tone: 'danger',
      message: t('settings.resetMessage'),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.resetKeep'), value: 'keep', variant: 'default' },
        { label: t('settings.resetWipe'), value: 'wipe', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step1 === 'cancel') return;

    const step2 = await dlg.show({
      title: step1 === 'wipe' ? t('settings.resetConfirmWipeTitle') : t('settings.resetConfirmTitle'),
      tone: 'danger',
      message: step1 === 'wipe'
        ? t('settings.resetConfirmWipeMsg')
        : t('settings.resetConfirmKeepMsg'),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: step1 === 'wipe' ? t('settings.resetConfirmWipeBtn') : t('settings.resetConfirmKeepBtn'),
          value: 'go', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step2 !== 'go') return;

    await window.api.reset.perform({ keepUserData: step1 === 'keep' });
  };

  const onUninstallLauncher = async () => {
    const step1 = await dlg.show({
      title: t('settings.uninstallTitle'),
      tone: 'danger',
      message: t('settings.uninstallMessage'),
      buttons: [
        { label: t('settings.uninstallCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.uninstallKeep'), value: 'keep', variant: 'default' },
        { label: t('settings.uninstallWipe'), value: 'wipe', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step1 === 'cancel') return;

    const step2 = await dlg.show({
      title: t('settings.uninstallConfirmTitle'),
      tone: 'danger',
      message: step1 === 'wipe'
        ? t('settings.uninstallConfirmWipeMsg')
        : t('settings.uninstallConfirmKeepMsg'),
      buttons: [
        { label: t('settings.uninstallCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.uninstallConfirmBtn'), value: 'go', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step2 !== 'go') return;

    const result = await window.api.reset.uninstallLauncher(step1 === 'keep');
    if (!result.ok) {
      await dlg.show({
        title: t('settings.uninstallErrorTitle'),
        tone: 'warn',
        message: result.reason || t('settings.uninstallErrorMsg'),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </div>

      {/* === CARD 1: Update === (proposed: General tab) */}
      <div className="card">
        <div className="card-head">
          <h2>{t('settings.updateTitle')}</h2>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip mono">v{updater?.current ?? '—'}</span>
            <button className="btn ghost sm" onClick={() => window.api.updater.check()}
              disabled={updater?.status === 'checking' || updater?.status === 'downloading'}>
              <IconRefresh /> {t('settings.checkUpdate')}
            </button>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {updater ? updateLabel(updater) : '—'}
          </div>
          {updater?.status === 'downloaded' && (
            <button className="btn primary sm" onClick={() => window.api.updater.install()}>
              {t('settings.installRestart')}
            </button>
          )}
        </div>
        {updater?.status === 'downloading' && (
          <div className="progress" style={{ marginTop: 10 }}>
            <div className="progress-bar"><div className="fill" style={{ width: (updater.percent ?? 0) + '%' }} /></div>
          </div>
        )}
        <div className="hint" style={{ marginTop: 10 }}>
          {t('settings.updateHint')}
        </div>
      </div>

      {/* === CARD 2: Theme === (proposed: General tab) */}
      <div className="card">
        <div className="card-head"><h2>{t('settings.themeTitle')}</h2></div>
        <div className="theme-grid">
          {THEME_OPTIONS.map((theme) => { /* ... theme cards ... */ })}
        </div>
      </div>

      {/* === CARD 3: Language === (proposed: General tab) */}
      <div className="card">
        <div className="card-head"><h2>{t('settings.languageTitle')}</h2></div>
        <div className="theme-grid">
          {(['ru', 'en'] as const).map((loc) => (/* ... locale buttons ... */))}
        </div>
      </div>

      {/* === CARD 4: Memory === (proposed: Game tab) */}
      <div className="card">
        <div className="card-head">
          <h2>{t('settings.memoryTitle')}</h2>
          <span className="chip mono">{gb} {t('size.gb')}</span>
        </div>
        <input type="range" min={1024} max={16384} step={256} value={local.memoryMb}
          onChange={(e) => apply({ memoryMb: parseInt(e.target.value) })} />
        {/* ... range labels ... */}
      </div>

      {/* === CARD 5: JVM Args === (proposed: Game tab) */}
      {/* === CARD 6: Window === (proposed: Game tab) */}
      {/* === CARD 7: Behavior === (proposed: General tab) */}
      {/* === CARD 8: Versions === (proposed: Game tab) */}
      {/* === CARD 9: Commands === (proposed: Game tab) */}
      {/* === CARD 10: Game Directory === (proposed: General tab) */}
      {/* === CARD 11: Java === (proposed: Game tab) */}

      {/* === CARD 12: Danger Zone === (proposed: Danger Zone tab) */}
      <div className="card danger-zone">
        {/* Reset launcher + Uninstall buttons */}
      </div>
    </div>
  );
};
```

---

## Implementation Plan

1. **Add tab state:** `const [tab, setTab] = useState<'general' | 'game' | 'danger'>('general');`

2. **Add tab bar** after `page-head`, using `.content-tabs` / `.content-tab` pattern (or new `.settings-tabs` / `.settings-tab` classes with identical styles):
   ```tsx
   <div className="content-tabs">
     <button className={`content-tab${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>
       General
     </button>
     <button className={`content-tab${tab === 'game' ? ' active' : ''}`} onClick={() => setTab('game')}>
       Game
     </button>
     <button className={`content-tab${tab === 'danger' ? ' active' : ''}`} onClick={() => setTab('danger')}>
       Danger Zone
     </button>
   </div>
   ```

3. **Conditionally render cards** based on `tab` value.

4. **No new CSS needed** if reusing `.content-tabs` / `.content-tab`. Optionally create `.settings-tabs` aliases for semantic clarity.

5. **i18n keys needed:** `settings.tabGeneral`, `settings.tabGame`, `settings.tabDanger`

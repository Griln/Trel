# Settings Expansion Plan

## New settings to add

### LauncherSettings type changes (src/shared/types.ts)
Add these fields:
```ts
export interface LauncherSettings {
  gameDir: string;
  memoryMb: number;
  javaPath?: string;
  lastVersionId?: string;
  theme?: ThemeId;
  // NEW:
  jvmArgs?: string;              // Custom JVM arguments string
  gameWidth?: number;            // Game window width (default 854)
  gameHeight?: number;           // Game window height (default 480)
  fullscreen?: boolean;          // Launch game in fullscreen (default false)
  showSnapshots?: boolean;       // Show snapshot/old versions in browse (default false)
  closeOnLaunch?: boolean;       // Close/hide launcher when game starts (default false)
  locale?: 'ru' | 'en';         // UI language (default 'ru')
  showConsole?: boolean;         // Show log console on launch (default false)
  preCommand?: string;           // Command to run before game launch
  postCommand?: string;          // Command to run after game exits
}
```

### Implementation phases:

**Phase 1: Type + Settings store + UI sections**
1. Extend LauncherSettings in types.ts
2. Add defaults in settings store (src/main/settings.ts)
3. Add all new UI sections to SettingsPage.tsx

**Phase 2: Wire up functionality**
1. jvmArgs → pass to launch command in minecraft launcher
2. gameWidth/gameHeight/fullscreen → pass as launch options
3. showSnapshots → filter versions in BrowsePage
4. closeOnLaunch → hide/close window on launch in main.ts
5. locale → i18n system (needs translation strings)
6. showConsole → toggle log panel visibility
7. preCommand/postCommand → exec in launch flow

### UI Layout for new sections (order in settings page):

1. Обновление лаунчера (existing)
2. Тема оформления (existing)
3. Язык / Language (NEW) — two-option selector like theme cards
4. Память JVM (existing)
5. JVM аргументы (NEW) — text input
6. Разрешение окна игры (NEW) — two number inputs + fullscreen toggle
7. Поведение лаунчера (NEW) — toggles: close on launch, show console
8. Фильтр версий (NEW) — toggle: show snapshots
9. Команды запуска (NEW) — two text inputs: pre/post
10. Папка игры (existing)
11. Java (existing)
12. Опасная зона (existing)

# TrelEmu Asset Distribution

## Что это

TrelEmu — это bundled QEMU + Android-x86 эмулятор для Bedrock. Сам лаунчер
(Trel) маленький (~84 МБ инсталлятор), но QEMU + Android-x86 ISO весят
~1 ГБ. Чтобы не превращать инсталлятор в 1 ГБ дистрибутив, эмулятор-пак
скачивается **отдельно** при первом запуске Trel.

## Что улучшено в v0.3.0

| Улучшение | Где | Эффект |
|-----------|-----|--------|
| Audio (AC97 + intel-hda) | `trelEmu.ts:qemuArgs` | Звук в Minecraft |
| `-cpu max` вместо `host` | `trelEmu.ts:qemuArgs` | TCG транслирует быстрее |
| `-accel tcg,thread=multi` | `trelEmu.ts:qemuArgs` | Параллельная трансляция |
| Memory default 4096 MB | `config.json` | Больше памяти для JIT-кэша TCG |
| **Direct kernel boot** | `isoReader.ts` + `qemuArgs` | Пропуск GRUB = **-30-60 сек** на каждой загрузке |
| Auto-install Bedrock APK | `tryAutoInstallBedrock` | Положи `image/bedrock.apk` → установится сам |
| Polling 1500ms → 800ms | `POLL_INTERVAL_MS` | Быстрее детектит поднятие ADB |
| Timeout 90s → 120s | `STARTUP_TIMEOUT_MS` | Меньше ложных ошибок на медленных CPU |
| Pack через GitHub Releases | `trelEmuDownloader.ts` | Инсталлятор = 84 МБ вместо 1 ГБ |

## Оставшиеся ограничения (TODO)

1. **TCG = медленно** (5-15 мин загрузка Android). С Hyper-V было бы 30 сек
   и 30-60 FPS. Юзер отказался от Hyper-V — не решаемо.
2. **ISO не сохраняет состояние между сессиями** — каждый запуск холодный.
   Решается pre-installed qcow2 template, но их нет в открытом доступе
   для Android-x86 9.0. Авто-установка через QEMU monitor — сложно и хрупко.
3. **Сетевой ADB иногда не поднимается** в android-x86 userdebug. Ручной
   `adb connect 127.0.0.1:5555` решает.

## Архитектура

```
┌─────────────────────┐
│  Trel-0.3.0-x64.exe │ 84 МБ NSIS installer (без TrelEmu assets)
│  Trel.exe           │ 84 МБ portable (без TrelEmu assets)
└─────────┬───────────┘
          │ запускается
          ▼
┌─────────────────────┐
│  Trel Launcher      │
│                     │
│  BrowsePage →       │
│   "TrelEmu не       │  ← первое посещение
│    установлен"      │
│                     │
│   [Скачать]         │  ← юзер жмёт
│   [Отмена]          │
│   0% → 100%         │
│                     │
│  после:             │
│   "TrelEmu (bundled)│  ← готово
│    ADB: 127.0.0.1"  │
└─────────┬───────────┘
          │ качает с
          ▼
┌─────────────────────────────────────┐
│  GitHub Releases:                   │
│  mkrlord1000-sketch/Trel            │
│  Tag: trel-emu-v0.3.0               │
│  Files:                             │
│   - trel-emu-pack.zip   (947 МБ)    │
│   - trel-emu-pack.zip.sha1 (40 байт)│
└─────────────────────────────────────┘
          │ скачали
          ▼
┌─────────────────────────────────────┐
│  Куда сохраняется:                  │
│                                     │
│  Installed:                         │
│   %APPDATA%\Trel\trel-emu\          │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   │   ├─ android-x86.iso            │
│   │   └─ android-9.0.overlay.qcow2  │  ← сюда QEMU пишет runtime state
│   ├─ boot/                          │  ← извлечённые kernel+initrd
│   │   ├─ kernel (7 МБ)              │
│   │   └─ initrd.img (1.3 МБ)        │
│   └─ config.json                    │
│                                     │
│  Portable:                          │
│   <папка Trel.exe>\trel-emu\        │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   ├─ boot/                          │
│   └─ config.json                    │
└─────────────────────────────────────┘
```

## Как опубликовать новую версию пака

### 1) Подготовка кэша

В `D:\lauin\build-trel-emu-cache\` должны лежать:

```
qemu\                              (распакованный QEMU 2026-05-01)
├── qemu-system-x86_64.exe         (≈27 МБ)
├── qemu-img.exe                   (≈2 МБ)
└── (остальные файлы QEMU не нужны для пака)

android-x86_64-9.0-r2.iso          (≈921 МБ; скачать с
                                   https://archive.org/download/sjarb_android_9.0r2/android-x86_64-9.0-r2.iso)
```

В `D:\lauin\resources\trel-emu\config.json` — дефолтный конфиг:

```json
{
  "memory_mb": 4096,
  "cpu_cores": 4,
  "adb_port": 5555,
  "enable_audio": true,
  "auto_install_bedrock": true,
  "disable_animations": true,
  "direct_kernel_boot": true,
  "use_snapshot": true
}
```

### 2) Сборка пака

```bash
npm run build:trel-emu-pack
```

Скрипт `scripts/build-trel-emu-pack.js` собирает STORE-zip
(без сжатия, ISO уже сжат) в `dist-trel-emu/trel-emu-pack.zip`
и пишет рядом `trel-emu-pack.zip.sha1`.

⚠️ **ВАЖНО:** не пиши в `dist/`! `dist/**/*` в `package.json` подхватывается
electron-builder'ом в asar. Получишь инсталлятор 1 ГБ.

### 3) Загрузка на GitHub

Создай релиз в репозитории `mkrlord1000-sketch/Trel`:

```
Tag: trel-emu-v0.3.0
Title: TrelEmu Pack v0.3.0

Files (drag-and-drop):
  - dist-trel-emu/trel-emu-pack.zip
  - dist-trel-emu/trel-emu-pack.zip.sha1
```

URL после публикации:
```
https://github.com/mkrlord1000-sketch/Trel/releases/download/trel-emu-v0.3.0/trel-emu-pack.zip
https://github.com/mkrlord1000-sketch/Trel/releases/download/trel-emu-v0.3.0/trel-emu-pack.zip.sha1
```

### 4) Проверка URL в коде

В `src/main/trelEmuDownloader.ts` константа `DEFAULT_URL`:
```typescript
const DEFAULT_URL = 'https://github.com/mkrlord1000-sketch/Trel/releases/download/trel-emu-v0.3.0/trel-emu-pack.zip';
```

Тег в URL **должен совпадать** с тегом релиза. Иначе 404.

### 5) Опционально — переопределение URL

Можно переопределить URL без пересборки Trel, через env-переменные:
- `TRELEMU_PACK_URL` — URL пака
- `TRELEMU_PACK_SHA1` — ожидаемый SHA1 (если не хочешь публиковать .sha1)

Это удобно для тестов с локального сервера или зеркала.

## Как установить Bedrock APK автоматически

1. Скачай Minecraft APK с mcpehub (любой рабочий билд)
2. Положи его в:
   - Installed: `%APPDATA%\Trel\trel-emu\image\bedrock.apk`
   - Portable: `<папка Trel.exe>\trel-emu\image\bedrock.apk`
3. Запусти TrelEmu → APK поставится автоматически при первом подключении ADB
4. **Snapshot overlay** запомнит установку — больше ставить не нужно
   (пока не удалишь `android-9.0.overlay.qcow2`)

## Что умеет downloader

- **Стрим-скачивание** — файл не буферизуется в RAM, читается по чанкам
- **Прогресс** — отдаётся через IPC каждые 200 мс
- **Отмена** — AbortController, можно прервать в любой момент
- **Верификация SHA1** — если .sha1 лежит рядом с .zip на сервере
- **ZIP-экстрактор** — собственный, поддерживает STORE (0) и DEFLATE (8)
- **Защита от zip-slip** — валидирует пути файлов (нет `..`, нет абсолютных)
- **Поиск в нескольких местах** — find() обходит portable dir → appdata → resources

## Лимиты

- ZIP64 не поддерживается (файлы < 4 ГБ, pack = 947 МБ — OK)
- Encrypted ZIP не поддерживается
- Размер pack лимитирован 2 ГБ (GitHub Releases лимит)
- Скорость скачивания зависит от CDN GitHub (50-200 МБ/с)

# Распространение эмулятора TrelEmu

## Что это такое

TrelEmu — встроенный эмулятор на базе QEMU и Android-x86, он нужен для запуска
Bedrock. Сам лаунчер (Trel) небольшой — инсталлятор около 84 МБ, — но образ QEMU
вместе с ISO Android-x86 весит около 1 ГБ. Чтобы не превращать инсталлятор
в гигабайтный дистрибутив, пак эмулятора скачивается **отдельно** при первом
запуске Trel.

## Что улучшено в версии 0.3.0

| Улучшение | Где | Эффект |
|-----------|-----|--------|
| Звук (AC97 и intel-hda) | `trelEmu.ts:qemuArgs` | Звук в Minecraft |
| `-cpu max` вместо `host` | `trelEmu.ts:qemuArgs` | Ускоренная трансляция TCG |
| `-accel tcg,thread=multi` | `trelEmu.ts:qemuArgs` | Параллельная трансляция |
| Память по умолчанию 4096 МБ | `config.json` | Больше памяти под JIT-кэш TCG |
| **Прямая загрузка ядра** | `isoReader.ts` и `qemuArgs` | Пропуск GRUB — **минус 30–60 секунд** при каждом старте |
| Автоустановка APK Bedrock | `tryAutoInstallBedrock` | Положи `image/bedrock.apk` — установится само |
| Опрос состояния 1500 → 800 мс | `POLL_INTERVAL_MS` | Быстрее замечаем поднятие ADB |
| Таймаут 90 → 120 секунд | `STARTUP_TIMEOUT_MS` | Меньше ложных ошибок на медленном процессоре |
| Пак на Codeberg Releases | `trelEmuDownloader.ts` | Инсталлятор 84 МБ вместо 1 ГБ |

## Оставшиеся ограничения

1. **TCG работает медленно** — загрузка Android занимает 5–15 минут. С Hyper-V
   было бы 30 секунд и 30–60 кадров в секунду. Пользователь отказался от Hyper-V,
   поэтому вопрос пока не решён.
2. **Образ не сохраняет состояние между запусками** — каждый старт холодный.
   Решается готовым образом qcow2, но таких образов для Android-x86 9.0 нет в
   открытом доступе. Автоустановка через монитор QEMU — сложно и хрупко.
3. **Сетевой ADB иногда не поднимается** в сборке android-x86 userdebug.
   Помогает ручной `adb connect 127.0.0.1:5555`.

## Архитектура

```
┌─────────────────────┐
│  Trel-0.5.0-x64.exe │ 84 МБ, инсталлятор NSIS (без ресурсов TrelEmu)
│  Trel.exe           │ 84 МБ, портативная сборка (без ресурсов TrelEmu)
└─────────┬───────────┘
          │ запускается
          ▼
┌─────────────────────┐
│  Trel Launcher      │
│                     │
│  Каталог →          │
│   "TrelEmu не       │  ← первое посещение
│    установлен"      │
│                     │
│   [Скачать]         │  ← пользователь нажимает
│   [Отмена]          │
│   0% → 100%         │
│                     │
│  после:             │
│   "TrelEmu (встроен)│  ← готово
│    ADB: 127.0.0.1"  │
└─────────┬───────────┘
          │ качает с
          ▼
┌─────────────────────────────────────┐
│  Хостинг паков:                     │
│  codeberg.org/derwerwer/Trel        │
│  Тег: trel-emu-v0.5.0               │
│  Файлы:                             │
│   - trel-emu-pack.zip   (1.1 ГБ)    │
│   - trel-emu-pack.zip.sha1 (60 байт)│
│                                     │
│  Зеркало: archive.org               │
│  trel-emu-pack-v0-5-0               │
└─────────┬───────────────────────────┘
          │ скачали
          ▼
┌─────────────────────────────────────┐
│  Куда сохраняется:                  │
│                                     │
│  Установленная версия:              │
│   %APPDATA%\Trel\trel-emu\          │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   │   ├─ android-x86.iso            │
│   │   └─ android-9.0.overlay.qcow2  │  ← сюда QEMU пишет состояние
│   ├─ boot/                          │  ← извлечённые ядро и initrd
│   │   ├─ kernel (7 МБ)              │
│   │   └─ initrd.img (1.3 МБ)        │
│   └─ config.json                    │
│                                     │
│  Портативная версия:                │
│   <папка Trel.exe>\trel-emu\        │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   ├─ boot/                          │
│   └─ config.json                    │
└─────────────────────────────────────┘
```

## Как выпустить новую версию пака

### 1) Подготовка кэша

В `build-trel-emu-cache/` должны лежать:

```
qemu\                              (распакованный QEMU 2026-05-01)
├── qemu-system-x86_64.exe         (≈27 МБ)
├── qemu-img.exe                   (≈2 МБ)
└── (остальные файлы QEMU не нужны для пакета)

android-x86_64-9.0-r2.iso          (≈921 МБ; скачать с
                                    https://archive.org/download/sjarb_android_9.0r2/android-x86_64-9.0-r2.iso)
```

Файл `resources/trel-emu/config.json` — конфигурация по умолчанию:

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

### 2) Сборка пакета

```bash
npm run build:trel-emu-pack
```

Скрипт `scripts/build-trel-emu-pack.js` собирает zip-архив без сжатия
(образ ISO уже сжат) в `dist-trel-emu/trel-emu-pack.zip`
и записывает рядом `trel-emu-pack.zip.sha1`.

⚠️ **ВАЖНО:** не пиши в `dist/`! Шаблон `dist/**/*` в `package.json` подхватывает
electron-builder и упаковывает его внутрь asar. В итоге получишь инсталлятор на 1 ГБ.

### 3) Загрузка на хостинг

Создай релиз в репозитории `derwerwer/Trel` на Codeberg:

```
Тег: trel-emu-v0.5.0
Название: TrelEmu, пак версии 0.5.0

Файлы (перетащить мышью):
  - dist-trel-emu/trel-emu-pack.zip
  - dist-trel-emu/trel-emu-pack.zip.sha1
```

Ссылки после публикации:

```
https://codeberg.org/derwerwer/Trel/releases/download/trel-emu-v0.5.0/trel-emu-pack.zip
https://codeberg.org/derwerwer/Trel/releases/download/trel-emu-v0.5.0/trel-emu-pack.zip.sha1
```

Зеркало на archive.org:

```
https://archive.org/download/trel-emu-pack-v0-5-0/trel-emu-pack.zip
```

### 4) Проверка ссылки в коде

В `src/main/trelEmuDownloader.ts` константа `defaultPackUrl`:

```typescript
function defaultPackUrl(p: NodeJS.Platform = process.platform): string {
  return `https://archive.org/download/trel-emu-pack-v0-5-0/${packAssetName(p)}`;
}
```

Тег в ссылке **должен совпадать** с тегом релиза, иначе будет 404.

### 5) Переопределение ссылки (необязательно)

Ссылку можно поменять без пересборки Trel, через переменные окружения:

- `TRELEMU_PACK_URL` — адрес пакета
- `TRELEMU_PACK_SHA1` — ожидаемый SHA1 (если не хочешь публиковать файл `.sha1`)

Это удобно для проверок через локальный сервер или зеркало.

## Как установить APK Bedrock автоматически

1. Скачай APK Minecraft (подойдёт любой рабочий билд)
2. Положи его в:
   - Установленная версия: `%APPDATA%\Trel\trel-emu\image\bedrock.apk`
   - Портативная версия: `<папка Trel.exe>\trel-emu\image\bedrock.apk`
3. Запусти TrelEmu — APK поставится сам при первом подключении ADB
4. **Снимок образа** запомнит установку, ставить больше не нужно
   (пока не удалишь `android-9.0.overlay.qcow2`)

## Что умеет загрузчик

- **Потоковое скачивание** — файл не буферизуется в памяти, читается частями
- **Прогресс** — передаётся через IPC каждые 200 мс
- **Отмена** — через AbortController, можно прервать в любой момент
- **Проверка SHA1** — если рядом с архивом лежит файл `.sha1`
- **Свой распаковщик zip** — поддерживает методы STORE (0) и DEFLATE (8)
- **Защита от обхода каталогов** — проверяет пути файлов (нет `..`, нет абсолютных)
- **Поиск в нескольких местах** — обход папки портативной сборки, затем AppData, затем ресурсов приложения

## Ограничения

- Формат ZIP64 не поддерживается (файлы меньше 4 ГБ, пак около 1.1 ГБ — норма)
- Зашифрованные zip не поддерживаются
- Размер пака ограничен 2 ГБ (предел хостинга)
- Скорость скачивания зависит от сети и хостинга

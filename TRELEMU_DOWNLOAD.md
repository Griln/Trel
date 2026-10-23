<p align="center">
  <strong>English</strong> | <a href="TRELEMU_DOWNLOAD.ru.md">Русский</a>
</p>

# Distributing the TrelEmu Emulator

## What it is

TrelEmu is a built-in emulator based on QEMU and Android-x86, used to run
Bedrock. The launcher itself (Trel) is small — the installer is about 84 MB —
but the QEMU image together with the Android-x86 ISO weighs about 1 GB. To
avoid turning the installer into a gigabyte-sized distribution, the emulator
pack is downloaded **separately** on the first Trel launch.

## What improved in version 0.3.0

| Improvement | Where | Effect |
|-----------|-----|--------|
| Audio (AC97 and intel-hda) | `trelEmu.ts:qemuArgs` | Sound in Minecraft |
| `-cpu max` instead of `host` | `trelEmu.ts:qemuArgs` | Faster TCG translation |
| `-accel tcg,thread=multi` | `trelEmu.ts:qemuArgs` | Parallel translation |
| Default memory 4096 MB | `config.json` | More room for the TCG JIT cache |
| **Direct kernel boot** | `isoReader.ts` and `qemuArgs` | Skips GRUB — **30–60 seconds saved** on every start |
| Automatic Bedrock APK install | `tryAutoInstallBedrock` | Drop `image/bedrock.apk` in place and it installs itself |
| Poll interval 1500 → 800 ms | `POLL_INTERVAL_MS` | ADB startup is detected faster |
| Timeout 90 → 120 seconds | `STARTUP_TIMEOUT_MS` | Fewer false errors on a slow CPU |
| Pack on Codeberg Releases | `trelEmuDownloader.ts` | 84 MB installer instead of 1 GB |

## Remaining limitations

1. **TCG is slow** — booting Android takes 5–15 minutes. With Hyper-V it
   would be 30 seconds and 30–60 frames per second. The user turned down
   Hyper-V, so the question is not settled yet.
2. **The image keeps no state between runs** — every start is cold. A
   ready-made qcow2 image would fix it, but no such image for Android-x86 9.0
   is publicly available. Automatic install through the QEMU monitor is
   complex and fragile.
3. **Networked ADB sometimes fails to come up** in the android-x86 userdebug
   build. Running `adb connect 127.0.0.1:5555` by hand helps.

## Architecture

```
┌─────────────────────┐
│  Trel-0.5.0-x64.exe │ 84 MB, NSIS installer (no TrelEmu assets)
│  Trel.exe           │ 84 MB, portable build (no TrelEmu assets)
└─────────┬───────────┘
          │ launches
          ▼
┌─────────────────────┐
│  Trel Launcher      │
│                     │
│  Catalog →          │
│   "TrelEmu not      │  ← first visit
│    installed"       │
│                     │
│   [Download]        │  ← user clicks
│   [Cancel]          │
│   0% → 100%         │
│                     │
│  after:             │
│   "TrelEmu (bundled)│  ← ready
│    ADB: 127.0.0.1"  │
└─────────┬───────────┘
          │ downloads from
          ▼
┌─────────────────────────────────────┐
│  Pack hosting:                      │
│  codeberg.org/derwerwer/Trel        │
│  Tag: trel-emu-v0.5.0               │
│  Files:                             │
│   - trel-emu-pack.zip   (1.1 GB)    │
│   - trel-emu-pack.zip.sha1 (60 B)   │
│                                     │
│  Mirror: archive.org                │
│  trel-emu-pack-v0-5-0               │
└─────────┬───────────────────────────┘
          │ downloaded
          ▼
┌─────────────────────────────────────┐
│  Where it is saved:                 │
│                                     │
│  Installed version:                 │
│   %APPDATA%\Trel\trel-emu\          │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   │   ├─ android-x86.iso            │
│   │   └─ android-9.0.overlay.qcow2  │  ← QEMU writes the state here
│   ├─ boot/                          │  ← extracted kernel and initrd
│   │   ├─ kernel (7 MB)              │
│   │   └─ initrd.img (1.3 MB)        │
│   └─ config.json                    │
│                                     │
│  Portable version:                  │
│   <Trel.exe folder>\trel-emu\       │
│   ├─ qemu/                          │
│   ├─ image/                         │
│   ├─ boot/                          │
│   └─ config.json                    │
└─────────────────────────────────────┘
```

## How to release a new pack version

### 1) Prepare the cache

The `build-trel-emu-cache/` directory must contain:

```
qemu\                              (unpacked QEMU 2026-05-01)
├── qemu-system-x86_64.exe         (≈27 MB)
├── qemu-img.exe                   (≈2 MB)
└── (the other QEMU files are not needed for the pack)

android-x86_64-9.0-r2.iso          (≈921 MB; download from
                                    https://archive.org/download/sjarb_android_9.0r2/android-x86_64-9.0-r2.iso)
```

The file `resources/trel-emu/config.json` is the default configuration:

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

### 2) Build the pack

```bash
npm run build:trel-emu-pack
```

The `scripts/build-trel-emu-pack.js` script builds a zip archive without
compression (the ISO image is already compressed) into
`dist-trel-emu/trel-emu-pack.zip` and writes `trel-emu-pack.zip.sha1` next to
it.

⚠️ **IMPORTANT:** do not write into `dist/`! The `dist/**/*` glob in
`package.json` is picked up by electron-builder and packed into the asar. You
will end up with a 1 GB installer.

### 3) Upload to the host

Create a release in the `derwerwer/Trel` repository on Codeberg:

```
Tag: trel-emu-v0.5.0
Title: TrelEmu, version 0.5.0 pack

Files (drag and drop):
  - dist-trel-emu/trel-emu-pack.zip
  - dist-trel-emu/trel-emu-pack.zip.sha1
```

Links after publishing:

```
https://codeberg.org/derwerwer/Trel/releases/download/trel-emu-v0.5.0/trel-emu-pack.zip
https://codeberg.org/derwerwer/Trel/releases/download/trel-emu-v0.5.0/trel-emu-pack.zip.sha1
```

Mirror on archive.org:

```
https://archive.org/download/trel-emu-pack-v0-5-0/trel-emu-pack.zip
```

### 4) Check the link in the code

In `src/main/trelEmuDownloader.ts`, the `defaultPackUrl` constant:

```typescript
function defaultPackUrl(p: NodeJS.Platform = process.platform): string {
  return `https://archive.org/download/trel-emu-pack-v0-5-0/${packAssetName(p)}`;
}
```

The tag in the URL **must match** the release tag, otherwise you get a 404.

### 5) Override the link (optional)

The link can be changed without rebuilding Trel, through environment
variables:

- `TRELEMU_PACK_URL` — the pack URL
- `TRELEMU_PACK_SHA1` — the expected SHA1 (if you do not want to publish the
  `.sha1` file)

This is handy for tests through a local server or a mirror.

## How to install the Bedrock APK automatically

1. Download the Minecraft APK (any working build will do)
2. Put it in:
   - Installed version: `%APPDATA%\Trel\trel-emu\image\bedrock.apk`
   - Portable version: `<Trel.exe folder>\trel-emu\image\bedrock.apk`
3. Launch TrelEmu — the APK installs itself on the first ADB connection
4. The **image snapshot** remembers the installation, so there is no need to
   install it again (until you delete `android-9.0.overlay.qcow2`)

## What the downloader supports

- **Streaming download** — the file is not buffered in memory, it is read in
  chunks
- **Progress** — reported through IPC every 200 ms
- **Cancellation** — via AbortController, it can be interrupted at any moment
- **SHA1 verification** — if a `.sha1` file sits next to the archive
- **Own zip extractor** — supports the STORE (0) and DEFLATE (8) methods
- **Path traversal protection** — checks file paths (no `..`, no absolute
  paths)
- **Search in several places** — walks the portable build folder, then AppData,
  then the application resources

## Limitations

- The ZIP64 format is not supported (files under 4 GB, the pack is about 1.1
  GB — that is fine)
- Encrypted zip files are not supported
- The pack size is limited to 2 GB (the hosting limit)
- The download speed depends on the network and the host

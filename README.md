<p align="center">
  <strong>English</strong> | <a href="README.ru.md">Русский</a>
</p>

# Trel

[![GitHub release](https://img.shields.io/github/v/release/Griln/Trel)](https://github.com/Griln/Trel/releases/latest)
[![CI](https://github.com/Griln/Trel/actions/workflows/ci.yml/badge.svg)](https://github.com/Griln/Trel/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue.svg)](https://github.com/Griln/Trel/releases/latest)

A Minecraft launcher for Windows and Linux. Browse Java and Bedrock versions, mod loaders, mods, modpacks, worlds, servers, skins, and import from other launchers. No ads, no registration: play as a guest or sign in with Microsoft.

## Screenshots

![Installed versions](docs/screenshots/app-shell.png)
![Version catalog](docs/screenshots/app-browse.png)

## Features

### Every Minecraft version in one click
From the very first rd-132211 to the latest snapshot. Releases, snapshots, betas and alphas all live in one catalog and install with a single click. The list updates itself — new versions show up without a restart.

### Mods without the headache
**Fabric**, **Quilt**, **Forge** and **NeoForge** are supported — the mod loaders that matter. Installation is automatic: pick the Minecraft version in the catalog and the loader is applied on top of it.

### Every version keeps its own mods
Install Fabric on 1.20.1 with one set of mods, then Forge on 1.18.2 with another — they never mix. Each installed version has its own folder for mods, shaders, resource packs and texture packs. Keep as many builds side by side as you like and switch between them at any time.

Changed your mind and want plain vanilla? The "Revert to vanilla" button removes the loader and restores the original state, and your mods are kept on disk.

### Shaders and resource packs
Drop a `.zip` into the Content section and the launcher puts it where it belongs. Mods can be toggled one by one without deleting anything.

### Java installs itself
There is no need to hunt for the right Java version by hand. The launcher checks what is already installed on your system and, if nothing suitable is found, downloads Eclipse Temurin for the version you need. Java 8 for older Minecraft, 17 for recent, 21 for the latest — it all works out on its own.

### Old saves are never lost
Worlds from Pre-Classic through the present day work correctly. Worlds stored in unusual places are supported too, including the old format where a save was a single `level.dat` file with no folder around it.

### Automatic updates
When a new launcher version is out, it downloads it in the background and offers to install it. Only the changed parts are fetched, not the whole file again.

### No forced registration
Create a guest profile on the fly: type a nickname and play. You can keep several profiles and switch between them. Signing in with Microsoft is supported as well — a guest profile is enough for singleplayer and for servers with license checks disabled, while Microsoft is needed for the official servers.

## Installation

Grab the [latest release](../../releases/latest).

Windows:
- **`Trel-x.y.z-x64.exe`** — the regular installer. It installs into `Program Files`, adds a Start Menu shortcut and updates itself.
- **`Trel.exe`** — the portable build. Nothing gets installed: it runs straight away, keeps its data next to the executable, and fits on a USB stick.

Windows system requirements: **Windows 10 or 11**.

Linux:
- **`Trel-x.y.z-x86_64.AppImage`** — run it without installing anything.
- **`Trel-x.y.z-amd64.deb`** — Debian/Ubuntu.
- **`Trel-x.y.z-x86_64.rpm`** — Fedora and RHEL-likes.

## First run

1. Start the launcher.
2. Create a guest profile or sign in with Microsoft.
3. Open the Catalog, pick a Minecraft version and hit Play.

That is all. The launcher downloads the game, the required libraries and Java on its own.

## Where the data lives

Windows: `%APPDATA%\Trel\` — settings, accounts, the downloaded Java, Minecraft versions and worlds.

Linux: the Electron user data directory, usually `~/.config/Trel`; portable builds and a few special cases may use a neighbouring directory.

The game folder path can be changed in the settings if you would rather keep versions and worlds on another drive.

## Development

For developers who want to build the launcher from source or contribute to it.

```bash
npm install
npm run dev          # in one console — Vite on localhost:5173
npm start            # in another — starts Electron
```

Building the release binaries:

```bash
npm run build        # checks that everything compiles, without packaging
npm run dist         # Windows: NSIS installer + portable build
npm run dist:linux   # Linux: AppImage + deb + rpm
```

The installers, packages and auto-update files end up in `release/`.

Stack: Electron 33, React 18, TypeScript, Vite, electron-builder and [@xmcl/core](https://github.com/Voxelum/minecraft-launcher-core-node) for talking to Minecraft.

## License

[MIT](LICENSE).

## Important

Minecraft is a trademark of Mojang/Microsoft. Trel does not provide the game and does not bypass its license: the client is downloaded only from the official Mojang servers. Running without a purchased account is limited to singleplayer and to servers that have license verification turned off (`online-mode=false`). Official servers require a Microsoft account, and signing in with one is supported.

## Contributing

- 🐛 [Found a bug](https://github.com/Griln/Trel/issues/new/choose) — attach the log from Settings → Diagnostics
- 💡 [Have an idea](https://github.com/Griln/Trel/issues/new/choose)
- 💬 [Questions and discussions](https://github.com/Griln/Trel/discussions)
- 🧑‍💻 [Want to contribute](CONTRIBUTING.md) — how to build and run the tests
- 🔒 [Security issue](SECURITY.md) — do not open a public issue, follow the instructions there
- 📜 [Code of conduct](CODE_OF_CONDUCT.md)

## Releases

Releases are built and published automatically: push a tag and CI produces the
Windows (NSIS installer and portable build) and Linux (AppImage, deb, rpm)
files and attaches them to the release.

```bash
# the version in the tag must match the version field in package.json
git tag vX.Y.Z
git push origin vX.Y.Z
```

Mirror of the releases and of the TrelEmu emulator:
[archive.org](https://archive.org/details/trel-emu-pack-v0-5-0).

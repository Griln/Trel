#!/usr/bin/env bash
#
# Сборка Trel .rpm вручную через rpmbuild.
#
# Зачем: electron-builder использует fpm 1.9.3, который генерирует spec-файлы
# под rpm 4.x. На rolling дистрах (Arch, Fedora 41+, rawhide) ставится rpmbuild 6,
# который в %install сам удаляет и пересоздаёт %{buildroot}, поэтому spec от fpm
# падает с "Файл не найден: .../BUILDROOT/opt/Trel/...". Чистого фикса в
# конфиге electron-builder нет, поэтому rpm собирается отдельно этим скриптом.
#
# Что делает:
#   1) Берёт готовое дерево из release/linux-unpacked/ (должно уже быть собрано).
#   2) Добавляет .desktop-файл и иконку.
#   3) Генерирует spec с правильным %install (cp -a rootfs -> buildroot).
#   4) Вызывает rpmbuild, копирует итоговый .rpm в release/ с именем из package.json.
#
# Использование:
#   ./scripts/build-rpm-manual.sh              # версия берётся из package.json
#   ./scripts/build-rpm-manual.sh 0.5.0        # версия явно
#   VERSION=0.5.0 ./scripts/build-rpm-manual.sh
#
# Окружение: Linux, rpmbuild, jq (опционально — иначе берём версию из package.json
# простым grep-ом).
#
# Скрипт идемпотентный: при повторном запуске пересоздаёт buildroot и spec.
set -euo pipefail

# --- Переход в корень репозитория (там, где package.json) ---------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Версия ------------------------------------------------------------------
if [[ -n "${1:-}" ]]; then
  VERSION="$1"
elif [[ -n "${VERSION:-}" ]]; then
  VERSION="$VERSION"
else
  VERSION=$(grep -m1 '"version"' package.json | sed -E 's/[^0-9]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
  if [[ -z "$VERSION" ]]; then
    echo "ERROR: не удалось определить версию из package.json" >&2
    exit 1
  fi
fi
echo "[rpm] версия: $VERSION"

# --- Проверка обязательных файлов --------------------------------------------
if [[ ! -d release/linux-unpacked ]]; then
  echo "ERROR: release/linux-unpacked/ не найден." >&2
  echo "       Сначала соберите: npm run dist:linux (AppImage + deb уже создадут linux-unpacked)." >&2
  exit 1
fi
if [[ ! -f build/icon.png ]]; then
  echo "ERROR: build/icon.png не найден. Запустите: npm run icon" >&2
  exit 1
fi
if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "ERROR: rpmbuild не установлен." >&2
  echo "       Arch:    sudo pacman -S rpm-tools" >&2
  echo "       Debian:  sudo apt-get install rpm" >&2
  echo "       Fedora:  уже в_deps core-tools" >&2
  exit 1
fi

# --- Рабочий каталог ---------------------------------------------------------
WORK="${TMPDIR:-/tmp}/build-trel-rpm-$$"
rm -rf "$WORK"
mkdir -p "$WORK"/{BUILD,RPMS,SOURCES,SPECS,BUILDROOT,tmp}

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# --- 1) Готовим дерево файловой системы --------------------------------------
echo "[rpm] копируем linux-unpacked -> rootfs/opt/Trel"
mkdir -p "$WORK/SOURCES/rootfs/opt/Trel"
cp -a release/linux-unpacked/. "$WORK/SOURCES/rootfs/opt/Trel/"

# Иконка
mkdir -p "$WORK/SOURCES/rootfs/usr/share/icons/hicolor/256x256/apps"
cp build/icon.png "$WORK/SOURCES/rootfs/usr/share/icons/hicolor/256x256/apps/trel-launcher.png"

# .desktop-файл
mkdir -p "$WORK/SOURCES/rootfs/usr/share/applications"
cat > "$WORK/SOURCES/rootfs/usr/share/applications/trel-launcher.desktop" <<'DESK'
[Desktop Entry]
Name=Trel
Comment=Trel Launcher
Exec=/opt/Trel/trel-launcher
Icon=trel-launcher
Type=Application
Categories=Game;
Terminal=false
DESK

# --- 2) Список файлов для %files (только обычные файлы — каталоги rpmbuild
#        включает автоматически) -----------------------------------------------
find "$WORK/SOURCES/rootfs" -type f -o -type l | sort \
  | sed "s|$WORK/SOURCES/rootfs||" > "$WORK/files.list"

# --- 3) Spec -----------------------------------------------------------------
cat > "$WORK/SPECS/trel-launcher.spec" <<EOF
Name: trel-launcher
Version: $VERSION
Release: 1
Summary: Trel
AutoReqProv: no
BuildArch: x86_64
Group: default
License: MIT
Vendor: Trel <trel@example.com>
URL: https://github.com/Griln/Trel
Packager: Trel <trel@example.com>
Requires: gtk3
Requires: libnotify
Requires: nss
Requires: libXScrnSaver
Requires: libXtst
Requires: xdg-utils
Requires: at-spi2-atk
Requires: libdrm
Requires: mesa-libgbm
Requires: alsa-lib
Requires: libappindicator-gtk3

%description
Trel Launcher

%prep
true

%build
true

%install
cp -a %{_sourcedir}/rootfs/. %{buildroot}/

%clean
true

%post
if [ -x /usr/bin/update-desktop-database ]; then update-desktop-database /usr/share/applications 2>/dev/null || true; fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null || true; fi
chmod +x /opt/Trel/trel-launcher 2>/dev/null || true

%postun
if [ -x /usr/bin/update-desktop-database ]; then update-desktop-database /usr/share/applications 2>/dev/null || true; fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then gtk-update-icon-cache /usr/share/icons/hicolor 2>/dev/null || true; fi

%files
%defattr(-,root,root,-)
$(cat "$WORK/files.list")
EOF

# --- 4) rpmbuild -------------------------------------------------------------
echo "[rpm] запускаю rpmbuild"
rpmbuild -bb \
  --target x86_64-unknown-linux \
  --define "_topdir $WORK" \
  --define "_rpmdir $WORK/RPMS" \
  --define "_sourcedir $WORK/SOURCES" \
  --define "_tmppath $WORK/tmp" \
  --define "buildroot $WORK/BUILDROOT" \
  "$WORK/SPECS/trel-launcher.spec"

# --- 5) Копируем результат в release/ с canonical-именем ----------------------
SRC_RPM=$(find "$WORK/RPMS" -name "trel-launcher-$VERSION-*.x86_64.rpm" | head -1)
if [[ -z "$SRC_RPM" ]]; then
  echo "ERROR: rpm не найден в $WORK/RPMS" >&2
  exit 1
fi
DEST_RPM="release/Trel-$VERSION-x86_64.rpm"
mkdir -p release
cp "$SRC_RPM" "$DEST_RPM"
chmod 644 "$DEST_RPM"
echo "[rpm] готово: $DEST_RPM ($(du -h "$DEST_RPM" | cut -f1))"

# --- 6) Перегенерируем latest-linux.yml --------------------------------------
# electron-builder НЕ создаёт latest-linux.yml автоматически (мы вынуждены собирать
# rpm вручную, см. шапку), поэтомугенерим его здесь, чтобы electron-updater на
# установленных deb/rpm мог находить апдейты. SHA512 — base64 (нужен electron-updater).
APPIMG="release/Trel-$VERSION-x86_64.AppImage"
DEB="release/Trel-$VERSION-amd64.deb"

# blockmap для AppImage electron-builder тоже не создаётся →干细胞ную не указываем.

sha512_b64() { sha512sum "$1" | awk '{print $1}' | xxd -r -p | base64 -w0; echo; }

if [[ -f "$APPIMG" && -f "$DEB" && -f "$DEST_RPM" ]]; then
  AI_SHA="$(sha512_b64 "$APPIMG")"
  AI_SIZE="$(stat -c%s "$APPIMG")"
  DEB_SHA="$(sha512_b64 "$DEB")"
  DEB_SIZE="$(stat -c%s "$DEB")"
  RPM_SHA="$(sha512_b64 "$DEST_RPM")"
  RPM_SIZE="$(stat -c%s "$DEST_RPM")"
  DATE="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"

  cat > release/latest-linux.yml <<YML
version: $VERSION
files:
  - url: Trel-$VERSION-x86_64.AppImage
    sha512: $AI_SHA
    size: $AI_SIZE
  - url: Trel-$VERSION-amd64.deb
    sha512: $DEB_SHA
    size: $DEB_SIZE
  - url: Trel-$VERSION-x86_64.rpm
    sha512: $RPM_SHA
    size: $RPM_SIZE
path: Trel-$VERSION-x86_64.AppImage
sha512: $AI_SHA
releaseDate: '$DATE'
YML
  echo "[yml] записан: release/latest-linux.yml"
else
  echo "[yml] пропускаем генерацию latest-linux.yml (нет всех артефактов)" >&2
fi


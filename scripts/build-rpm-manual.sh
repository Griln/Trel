#!/usr/bin/env bash
#
# Builds the Trel .rpm manually via rpmbuild.
#
# Why: electron-builder uses fpm 1.9.3, which generates spec files for rpm 4.x.
# On rolling distros (Arch, Fedora 41+, rawhide) rpmbuild 6 is installed, and it
# deletes and recreates %{buildroot} in %install, so the spec from fpm fails with
# "File not found: .../BUILDROOT/opt/Trel/...". There is no clean fix in the
# electron-builder config, so the rpm is built separately by this script.
#
# What it does:
#   1) Takes the ready-made tree from release/linux-unpacked/ (it must already be built).
#   2) Adds a .desktop file and the icon.
#   3) Generates a spec with the correct %install (cp -a rootfs -> buildroot).
#   4) Calls rpmbuild and copies the resulting .rpm to release/ under the name from package.json.
#
# Usage:
#   ./scripts/build-rpm-manual.sh              # the version is taken from package.json
#   ./scripts/build-rpm-manual.sh 0.5.0        # the version is given explicitly
#   VERSION=0.5.0 ./scripts/build-rpm-manual.sh
#
# Environment: Linux, rpmbuild, jq (optional — otherwise the version is taken from
# package.json with a simple grep).
#
# The script is idempotent: on a repeated run it recreates the buildroot and the spec.
set -euo pipefail

# --- Switch to the repository root (where package.json lives) -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Version ------------------------------------------------------------------
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

# --- Check the required files -------------------------------------------------
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

# --- Working directory --------------------------------------------------------
WORK="${TMPDIR:-/tmp}/build-trel-rpm-$$"
rm -rf "$WORK"
mkdir -p "$WORK"/{BUILD,RPMS,SOURCES,SPECS,BUILDROOT,tmp}

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# --- 1) Prepare the filesystem tree -------------------------------------------
echo "[rpm] копируем linux-unpacked -> rootfs/opt/Trel"
mkdir -p "$WORK/SOURCES/rootfs/opt/Trel"
cp -a release/linux-unpacked/. "$WORK/SOURCES/rootfs/opt/Trel/"

# Icon
mkdir -p "$WORK/SOURCES/rootfs/usr/share/icons/hicolor/256x256/apps"
cp build/icon.png "$WORK/SOURCES/rootfs/usr/share/icons/hicolor/256x256/apps/trel-launcher.png"

# .desktop file
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

# --- 2) File list for %files (only regular files — rpmbuild includes
#        directories automatically) -----------------------------------------------
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

# --- 5) Copy the result to release/ under a canonical name ---------------------
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

# --- 6) Regenerate latest-linux.yml --------------------------------------------
# electron-builder does NOT create latest-linux.yml automatically (we have to build
# the rpm manually, see the header), so we generate it here to let electron-updater
# find updates on installed deb/rpm packages. SHA512 — base64 (electron-updater needs it).
APPIMG="release/Trel-$VERSION-x86_64.AppImage"
DEB="release/Trel-$VERSION-amd64.deb"

# electron-builder does not create a blockmap for AppImage either → we do not reference one.

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


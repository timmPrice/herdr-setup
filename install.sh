#!/usr/bin/env bash
# Installs the neo-kyoto layout into Herdr's home. Touches only:
#   layouts/neo-kyoto.*, themes/neo-kyoto.json, mods/nk-*
# Runs ./check.sh first and refuses to install if it fails.
set -euo pipefail
cd "$(dirname "$0")"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
[ -d "$HOME_DIR" ] || { echo "no Herdr home at $HOME_DIR" >&2; exit 1; }

./check.sh

copy() { # src dest-relative-to-home
  local src=$1 rel=$2
  case "$rel" in
    layouts/neo-kyoto.*|themes/neo-kyoto.json|mods/nk-*) ;;
    *) echo "refusing to touch $rel" >&2; exit 1 ;;
  esac
  mkdir -p "$(dirname "$HOME_DIR/$rel")"
  if [ -d "$src" ]; then
    mkdir -p "$HOME_DIR/$rel"
    # mirror the folder, but leave files Herdr writes into mods alone
    rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'jsconfig.json' "$src/" "$HOME_DIR/$rel/"
  else
    cp "$src" "$HOME_DIR/$rel"
  fi
  echo "installed $rel"
}

for f in layouts/neo-kyoto.*; do copy "$f" "$f"; done
copy themes/neo-kyoto.json themes/neo-kyoto.json
for m in mods/nk-*/; do m=${m%/}; copy "$m" "$m"; done

#!/usr/bin/env bash
# Installs the neo-kyoto layout into Herdr's home. Touches only:
#   layouts/neo-kyoto.*, themes/neo-kyoto.json, mods/nk-*
# and adds one key to keys.json (ctrl-shift-y: show/hide the sakura tree) if ctrl-shift-y is free.
# Runs ./check.sh first and refuses to install if it fails.
set -euo pipefail
cd "$(dirname "$0")"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
[ -d "$HOME_DIR" ] || { echo "no Herdr home at $HOME_DIR" >&2; exit 1; }

./check.sh

guard() {
  case "$1" in
    layouts/neo-kyoto.*|themes/neo-kyoto.json|mods/nk-*) ;;
    *) echo "refusing to touch $1" >&2; exit 1 ;;
  esac
}

copy() { # src dest-relative-to-home
  local src=$1 rel=$2
  guard "$rel"
  mkdir -p "$(dirname "$HOME_DIR/$rel")"
  if [ -d "$src" ]; then
    mkdir -p "$HOME_DIR/$rel"
    # Mirror the folder (--delete: files added inside an installed nk-* folder are removed), but leave
    # the files Herdr writes into mods alone, and don't ship tools/ (tests, seal generator).
    rsync -a --delete --filter='H tools/' --exclude 'gpui-kit.d.ts' --exclude 'jsconfig.json' "$src/" "$HOME_DIR/$rel/"
  else
    cp "$src" "$HOME_DIR/$rel"
  fi
  echo "installed $rel"
}

# Keep the intensity the person chose with ./intensity.sh (the repo's layout says "full").
keep=""
[ -f "$HOME_DIR/layouts/neo-kyoto.json" ] && keep=$(./intensity.sh 2>/dev/null || true)

# Theme and mods first, the layout last, so Herdr never loads a layout whose pieces are missing.
copy themes/neo-kyoto.json themes/neo-kyoto.json
for m in mods/nk-*/; do m=${m%/}; copy "$m" "$m"; done
copy layouts/neo-kyoto.svg layouts/neo-kyoto.svg

# The layout: one atomic write (temp file + rename), with the kept intensity already applied.
guard layouts/neo-kyoto.json
mkdir -p "$HOME_DIR/layouts"
tmp=$(mktemp "$HOME_DIR/layouts/.neo-kyoto.json.XXXXXX")
cp layouts/neo-kyoto.json "$tmp"
chmod 644 "$tmp"
if [ "$keep" = "calm" ]; then NK_LAYOUT="$tmp" ./intensity.sh calm >/dev/null; fi
mv -f "$tmp" "$HOME_DIR/layouts/neo-kyoto.json"
echo "installed layouts/neo-kyoto.json${keep:+ (intensity: $keep)}"

# One key: ctrl-shift-y shows/hides the sakura tree while neo-kyoto is shown. Added only if
# ctrl-shift-y isn't bound anywhere in keys.json; nothing else in the file changes.
python3 -I - "$HOME_DIR/keys.json" <<'PY'
import json, os, sys, tempfile
path = sys.argv[1]
KEY, ACTION, SECTION = "ctrl-shift-y", "nk-sakura.toggle", "layout:neo-kyoto"
if not os.path.exists(path):
    print(f"keys.json not found: to get {KEY}, add \"{SECTION}\": {{\"{KEY}\": \"{ACTION}\"}} to it")
    sys.exit(0)
with open(path) as f:
    keys = json.load(f)
for sec, binds in keys.items():
    if isinstance(binds, dict) and KEY in binds:
        if sec == SECTION and binds[KEY] == ACTION:
            print(f"keys.json: {KEY} already toggles the sakura tree")
        else:
            print(f"keys.json: {KEY} is already bound in \"{sec}\" ({binds[KEY]!r}), left alone; "
                  f"bind another key to \"{ACTION}\" in \"{SECTION}\" to toggle the tree")
        sys.exit(0)
keys.setdefault(SECTION, {})[KEY] = ACTION
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), prefix=".keys.", suffix=".tmp")
try:
    with os.fdopen(fd, "w") as f:
        f.write(json.dumps(keys, indent=2) + "\n")
    os.chmod(tmp, os.stat(path).st_mode & 0o777)
    os.replace(tmp, path)
except BaseException:
    os.unlink(tmp)
    raise
print(f"keys.json: added \"{SECTION}\": {{\"{KEY}\": \"{ACTION}\"}}")
PY
if [ -f "$HOME_DIR/keys.json" ]; then
  sleep 1
  if [ -f "$HOME_DIR/keys.error" ]; then
    echo "warning: Herdr reports a problem with keys.json:" >&2; cat "$HOME_DIR/keys.error" >&2
  fi
fi

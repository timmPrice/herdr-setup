#!/usr/bin/env bash
# Installs the PHOSPHOR layout into Herdr's home. Touches only:
#   layouts/phosphor.*, themes/phosphor.json, backgrounds/phosphor-*, mods/ph-*
# and adds two keys to keys.json, each only if it is free: ctrl-shift-u (jump to the oldest blocked agent) and
# ctrl-shift-i (toggle calm/full).
# Runs ./check.sh first and refuses to install if it fails.
set -euo pipefail
cd "$(dirname "$0")"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
[ -d "$HOME_DIR" ] || { echo "no Herdr home at $HOME_DIR" >&2; exit 1; }

./check.sh

guard() {
  case "$1" in
    layouts/phosphor.json|layouts/phosphor.svg|themes/phosphor.json|backgrounds/phosphor-*|mods/ph-*) ;;
    *) echo "refusing to touch $1" >&2; exit 1 ;;
  esac
}

copy() { # src dest-relative-to-home
  local src=$1 rel=$2
  guard "$rel"
  mkdir -p "$(dirname "$HOME_DIR/$rel")"
  if [ -d "$src" ]; then
    mkdir -p "$HOME_DIR/$rel"
    # Mirror the folder, but leave the files Herdr writes into mods alone, and don't ship tools/.
    rsync -a --delete --filter='H tools/' --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' --exclude 'jsconfig.json' "$src/" "$HOME_DIR/$rel/"
  else
    # Single files: temp + rename, so Herdr never reads half a file.
    local tmp; tmp=$(mktemp "$(dirname "$HOME_DIR/$rel")/.ph-install.XXXXXX")
    cp "$src" "$tmp"; chmod 644 "$tmp"; mv -f "$tmp" "$HOME_DIR/$rel"
  fi
  echo "installed $rel"
}

# Keep the intensity the person chose (shared ph.intensity; the repo's layout has the full look).
keep=""
[ -f "$HOME_DIR/layouts/phosphor.json" ] && keep=$(./intensity.sh 2>/dev/null || true)

# Theme, backgrounds and mods first, the layout last, so Herdr never loads a layout whose pieces are missing.
copy themes/phosphor.json themes/phosphor.json
for b in backgrounds/phosphor-*; do [ -e "$b" ] && copy "$b" "$b"; done
for m in mods/ph-*/; do m=${m%/}; copy "$m" "$m"; done
copy layouts/phosphor.svg layouts/phosphor.svg

# The layout: one atomic write (temp file + rename), with the kept intensity already applied.
guard layouts/phosphor.json
mkdir -p "$HOME_DIR/layouts"
tmp=$(mktemp "$HOME_DIR/layouts/.phosphor.json.XXXXXX")
cp layouts/phosphor.json "$tmp"
chmod 644 "$tmp"
if [ "$keep" = "calm" ]; then PH_LAYOUT="$tmp" ./intensity.sh calm >/dev/null; fi
mv -f "$tmp" "$HOME_DIR/layouts/phosphor.json"
echo "installed layouts/phosphor.json${keep:+ (intensity: $keep)}"

# Two keys while phosphor is shown: ctrl-shift-u jumps to the oldest blocked agent (ph-kit.respond),
# ctrl-shift-i toggles calm/full (ph-kit.toggle). Each is added only if that key isn't bound anywhere in
# keys.json; nothing else in the file changes.
python3 -I - "$HOME_DIR/keys.json" <<'PY'
import json, os, sys, tempfile
path = sys.argv[1]
SECTION = "layout:phosphor"
WANT = [("ctrl-shift-u", "ph-kit.respond", "jump to the oldest blocked agent"),
        ("ctrl-shift-i", "ph-kit.toggle", "toggle calm/full")]
if not os.path.exists(path):
    for key, action, what in WANT:
        print(f"keys.json not found: to {what}, add \"{SECTION}\": {{\"{key}\": \"{action}\"}} to it")
    sys.exit(0)
with open(path) as f:
    keys = json.load(f)
added = []
for key, action, what in WANT:
    taken = [(sec, binds[key]) for sec, binds in keys.items() if isinstance(binds, dict) and key in binds]
    if (SECTION, action) in taken:
        print(f"keys.json: {key} already does {action}")
    elif taken:
        sec, cur = taken[0]
        print(f"keys.json: {key} is already bound in \"{sec}\" ({cur!r}), left alone; "
              f"bind another key to \"{action}\" in \"{SECTION}\" to {what}")
    elif any(isinstance(b, dict) and action in b.values() for b in keys.values()):
        print(f"keys.json: {action} already has a key, left alone")
    else:
        keys.setdefault(SECTION, {})[key] = action
        added.append((key, action))
if not added:
    sys.exit(0)

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), prefix=".keys.", suffix=".tmp")
try:
    with os.fdopen(fd, "w") as f:
        f.write(json.dumps(keys, indent=2) + "\n")
    os.chmod(tmp, os.stat(path).st_mode & 0o777)
    os.replace(tmp, path)
except BaseException:
    os.unlink(tmp)
    raise
for key, action in added:
    print(f"keys.json: added \"{SECTION}\": {{\"{key}\": \"{action}\"}}")
PY
if [ -f "$HOME_DIR/keys.json" ]; then
  sleep 1
  if [ -f "$HOME_DIR/keys.error" ]; then
    echo "warning: Herdr reports a problem with keys.json:" >&2; cat "$HOME_DIR/keys.error" >&2
  fi
fi

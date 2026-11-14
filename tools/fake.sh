#!/usr/bin/env bash
# Render a ph-* mod with fake data (agents, spaces, panes, ...), for `herdr-app check` and screenshots.
#
#   tools/fake.sh <mod> <scenario.json>            temp copy + `herdr-app check`; prints the temp folder
#   tools/fake.sh <mod> <scenario.json> --install  also installs it as mods/<mod>-fake and writes
#                                                  layouts/phosphor-fake.json (phosphor with <mod> → <mod>-fake);
#                                                  then: herdr-app do layout.switch '{"name":"phosphor-fake"}'
#                                                        herdr-app shot /path/x.png ; switch back
#   tools/fake.sh --clean                          removes every installed mods/ph-*-fake and phosphor-fake.json
#
# How: every `from "herdr"` in the copy is rewritten to a generated fake-herdr.js that re-exports the real
# module but overrides agents/spaces/panes/terminals/focused/props/shared/window with the scenario.
# Scenario keys (all optional; missing fields are filled with defaults): see tools/scenarios/demo.json.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

if [ "${1:-}" = "--clean" ]; then
  for m in mods/ph-*/; do
    m=$(basename "$m")
    if [ -d "$HOME_DIR/mods/$m-fake" ]; then rm -r -- "$HOME_DIR/mods/$m-fake"; echo "removed mods/$m-fake"; fi
  done
  if [ -f "$HOME_DIR/layouts/phosphor-fake.json" ]; then rm -- "$HOME_DIR/layouts/phosphor-fake.json"; echo "removed layouts/phosphor-fake.json"; fi
  exit 0
fi

mod=${1:?usage: tools/fake.sh <ph-mod> <scenario.json> [--install] | --clean}
scen=${2:?usage: tools/fake.sh <ph-mod> <scenario.json> [--install]}
install=0; [ "${3:-}" = "--install" ] && install=1
case "$mod" in ph-*) ;; *) echo "only ph-* mods" >&2; exit 2 ;; esac
[ -d "mods/$mod" ] || { echo "no mods/$mod" >&2; exit 1; }
[ -f "$scen" ] || { echo "no $scen" >&2; exit 1; }

tmp=$(mktemp -d "${TMPDIR:-/tmp}/$mod-fake.XXXXXX")
rsync -a --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' --exclude 'jsconfig.json' --exclude 'tools/' "mods/$mod/" "$tmp/"
python3 -I "$REPO/tools/fake_rewrite.py" "$tmp" "$scen" "$mod" "$install"
if out=$(herdr-app check "$tmp" 2>&1); then echo "check passed: $mod with $(basename "$scen")"; else echo "$out"; echo "FAIL (copy kept at $tmp)"; exit 1; fi
echo "fake copy: $tmp"

if [ $install = 1 ]; then
  dest="$HOME_DIR/mods/$mod-fake"
  mkdir -p "$dest"
  rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' --exclude 'jsconfig.json' "$tmp/" "$dest/"
  echo "installed mods/$mod-fake"
  python3 -I - "$REPO/layouts/phosphor.json" "$HOME_DIR/layouts/phosphor-fake.json" "$mod" <<'PY'
import json, os, sys, tempfile
src, dst, mod = sys.argv[1:4]
tree = json.load(open(src))
def walk(n):
    if isinstance(n, dict):
        if n.get("mod") == mod: n["mod"] = mod + "-fake"
        if n.get("toast") == mod: n["toast"] = mod + "-fake"
        for v in n.values(): walk(v)
    elif isinstance(n, list):
        for v in n: walk(v)
walk(tree)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(dst), prefix=".phosphor-fake.", suffix=".tmp")
with os.fdopen(fd, "w") as f: json.dump(tree, f, indent=2, ensure_ascii=False)
os.chmod(tmp, 0o644); os.replace(tmp, dst)
print("wrote layouts/phosphor-fake.json")
PY
fi

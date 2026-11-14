#!/usr/bin/env bash
# Render a ph-* mod with fake data (agents, spaces, panes, ...), for `herdr-app check` and screenshots.
#
#   tools/fake.sh <mod> <scenario.json>            temp copy + `herdr-app check` (the copy is removed on exit;
#                                                  --keep keeps it and prints its folder)
#   tools/fake.sh <mod> <scenario.json> --install  also installs it as mods/<mod>-fake and writes
#                                                  layouts/phosphor-fake.json (phosphor with every installed
#                                                  mods/ph-*-fake in place of its mod);
#                                                  then: herdr-app do layout.switch '{"name":"phosphor-fake"}'
#                                                        herdr-app shot /path/x.png ; switch back
#   tools/fake.sh --clean                          removes every installed mods/ph-*-fake, data/ph-*-fake and
#                                                  phosphor-fake.json (switch to phosphor first if the fake is shown)
#
# How: every `from "herdr"` in the copy is rewritten to a generated fake-herdr.js that re-exports the real
# module but overrides agents/spaces/panes/terminals/focused/props/shared/window with the scenario.
# Scenario keys (all optional; missing fields are filled with defaults): see tools/scenarios/demo.json.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$PWD
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

if [ "${1:-}" = "--clean" ]; then
  if herdr-app status 2>/dev/null | grep -q '"layout": *"phosphor-fake"'; then
    echo "warning: phosphor-fake is the shown layout; removing it from under the window." >&2
    echo "         Switch back first: herdr-app do layout.switch '{\"name\":\"phosphor\"}'" >&2
  fi
  for m in mods/ph-*/; do
    m=$(basename "$m")
    if [ -d "$HOME_DIR/mods/$m-fake" ]; then rm -r -- "${HOME_DIR:?}/mods/${m:?}-fake"; echo "removed mods/$m-fake"; fi
    if [ -d "$HOME_DIR/data/$m-fake" ]; then rm -r -- "${HOME_DIR:?}/data/${m:?}-fake"; echo "removed data/$m-fake"; fi
  done
  if [ -f "$HOME_DIR/layouts/phosphor-fake.json" ]; then rm -- "${HOME_DIR:?}/layouts/phosphor-fake.json"; echo "removed layouts/phosphor-fake.json"; fi
  exit 0
fi

mod=${1:?usage: tools/fake.sh <ph-mod> <scenario.json> [--install] [--keep] | --clean}
scen=${2:?usage: tools/fake.sh <ph-mod> <scenario.json> [--install]}
install=0; keep=0
for a in "${@:3}"; do
  case "$a" in --install) install=1 ;; --keep) keep=1 ;; *) echo "unknown option $a" >&2; exit 2 ;; esac
done
case "$mod" in ph-*) ;; *) echo "only ph-* mods" >&2; exit 2 ;; esac
[ -d "mods/$mod" ] || { echo "no mods/$mod" >&2; exit 1; }
[ -f "$scen" ] || { echo "no $scen" >&2; exit 1; }

tmp=$(mktemp -d "${TMPDIR:-/tmp}/$mod-fake.XXXXXX")
# The temp copy goes on exit (success or failure) unless --keep; --install copies it out first.
[ $keep = 1 ] || trap 'rm -rf -- "${tmp:?}"' EXIT
rsync -a --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' --exclude 'jsconfig.json' --exclude 'tools/' "mods/$mod/" "$tmp/"
python3 -I "$REPO/tools/fake_rewrite.py" "$tmp" "$scen" "$mod" "$install"
if out=$(herdr-app check "$tmp" 2>&1); then echo "check passed: $mod with $(basename "$scen")"; else echo "$out"; echo "FAIL"; [ $keep = 1 ] && echo "copy kept at $tmp"; exit 1; fi
[ $keep = 1 ] && echo "fake copy: $tmp"

if [ $install = 1 ]; then
  dest="$HOME_DIR/mods/$mod-fake"
  mkdir -p "$dest"
  rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' --exclude 'jsconfig.json' "$tmp/" "$dest/"
  echo "installed mods/$mod-fake"
  # The fake layout uses every installed fake (so several --install runs build one all-fake window).
  python3 -I - "$REPO/layouts/phosphor.json" "$HOME_DIR/layouts/phosphor-fake.json" "$HOME_DIR/mods" <<'PY'
import json, os, sys, tempfile
src, dst, mods = sys.argv[1:4]
tree = json.load(open(src))
fake = lambda m: isinstance(m, str) and m.startswith("ph-") and os.path.isdir(os.path.join(mods, m + "-fake"))
def walk(n):
    if isinstance(n, dict):
        if fake(n.get("mod")): n["mod"] = n["mod"] + "-fake"
        if fake(n.get("toast")): n["toast"] = n["toast"] + "-fake"
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

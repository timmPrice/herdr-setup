#!/usr/bin/env bash
# Neo-Kyoto's one intensity switch: ./intensity.sh calm | full   (no argument: print the current one)
#
# Sets "intensity" on every nk-* mod in the INSTALLED layout (~/.config/herdr-app/layouts/neo-kyoto.json):
# the nk-pane header props and the nk-sakura float props. Herdr reloads the layout file live.
# nk-toast can't get props (the root "toast" is a plain mod name), so nk-pane mirrors its intensity
# into shared("nk.intensity") when it starts, and nk-toast reads that.
# ./install.sh keeps whatever this last set. The repo's layout file stays "full".
set -euo pipefail
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
LAYOUT="$HOME_DIR/layouts/neo-kyoto.json"
[ -f "$LAYOUT" ] || { echo "neo-kyoto is not installed ($LAYOUT missing): run ./install.sh first" >&2; exit 1; }

case "${1:-}" in
  "") ;;
  calm|full) ;;
  *) echo "usage: $0 [calm|full]" >&2; exit 2 ;;
esac

python3 -I - "$LAYOUT" "${1:-}" <<'EOF'
import json, sys
path, want = sys.argv[1], sys.argv[2]
with open(path) as f:
    tree = json.load(f)
found = []
def walk(n):
    if isinstance(n, dict):
        if isinstance(n.get("mod"), str) and n["mod"].startswith("nk-"):
            props = n.setdefault("props", {})
            found.append((n["mod"], props.get("intensity", "full")))
            if want:
                props["intensity"] = want
        for v in n.values():
            walk(v)
    elif isinstance(n, list):
        for v in n:
            walk(v)
walk(tree)
if not found:
    sys.exit("no nk-* mods with props found in " + path)
if not want:
    print(" ".join(sorted({i for _, i in found})))
    sys.exit(0)
with open(path, "w") as f:
    json.dump(tree, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("neo-kyoto intensity: " + want + " (" + ", ".join(m for m, _ in found) + ")")
EOF

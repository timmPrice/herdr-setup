#!/usr/bin/env bash
# PHOSPHOR's one intensity switch: ./intensity.sh calm | full   (no argument: print the current one)
#
# Sets props.intensity on every ph-* mod node in the INSTALLED layout (~/.config/herdr-app/layouts/phosphor.json),
# and swaps the scanline look: full = root background image + terminal_opacity 0.7 + transparent `main` pane
# frame (#12110e00); calm = root "canvas" + terminal_opacity 1 + `main` pane.background "background".
# Herdr reloads the layout live; blocks whose props changed start over. ph-kit (an invisible block in the
# layout) mirrors its props.intensity into shared("ph.intensity") when it starts, for mods without props
# (ph-toast, ph-boot). There is no app command to set shared state, so that mirror is the only writer.
# ./install.sh keeps whatever this last set. The repo's layout file stays "full".
set -euo pipefail
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
# PH_LAYOUT (internal, used by install.sh) points at another copy of the layout to read or patch.
LAYOUT="${PH_LAYOUT:-$HOME_DIR/layouts/phosphor.json}"
[ -f "$LAYOUT" ] || { echo "phosphor is not installed ($LAYOUT missing): run ./install.sh first" >&2; exit 1; }

case "${1:-}" in
  "") ;;
  calm|full) ;;
  *) echo "usage: $0 [calm|full]" >&2; exit 2 ;;
esac

python3 -I - "$LAYOUT" "${1:-}" <<'PY'
import json, os, sys, tempfile
path, want = sys.argv[1], sys.argv[2]
with open(path) as f:
    tree = json.load(f)
found = []
def walk(n):
    if isinstance(n, dict):
        if isinstance(n.get("mod"), str) and n["mod"].startswith("ph-"):
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
    sys.exit("no ph-* mods found in " + path)
if not want:
    print(" ".join(sorted({i for _, i in found})))
    sys.exit(0)
# Scanlines: full shows the texture through slightly see-through terminals and a transparent pane
# frame; calm is solid (no rows, opaque terminals, the frame back on the terminal colour).
calm = want == "calm"
tree["background"] = "canvas" if calm else {"image": "backgrounds/phosphor-scanlines.png", "fit": "cover"}
tree["terminal_opacity"] = 1 if calm else 0.7
def pane_bg(n):
    if isinstance(n, dict):
        if n.get("id") == "main" and isinstance(n.get("content"), dict) and isinstance(n["content"].get("pane"), dict):
            n["content"]["pane"]["background"] = "background" if calm else "#12110e00"
        for v in n.values():
            pane_bg(v)
    elif isinstance(n, list):
        for v in n:
            pane_bg(v)
pane_bg(tree)
d = os.path.dirname(os.path.abspath(path))
fd, tmp = tempfile.mkstemp(dir=d, prefix=".phosphor.", suffix=".tmp")
try:
    with os.fdopen(fd, "w") as f:
        json.dump(tree, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.chmod(tmp, os.stat(path).st_mode & 0o777)
    os.replace(tmp, path)
except BaseException:
    os.unlink(tmp)
    raise
print("phosphor intensity: " + want + " (" + ", ".join(sorted({m for m, _ in found})) + ")")
PY

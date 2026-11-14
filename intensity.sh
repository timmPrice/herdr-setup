#!/usr/bin/env bash
# PHOSPHOR's one intensity switch: ./intensity.sh calm | full | toggle   (no argument: print the current one)
#
# Intensity lives in ONE place: shared("ph.intensity"), set by ph-kit (`herdr-app do ph-kit.calm|full|toggle`;
# the layout:phosphor key ctrl-shift-i toggles it too). Every mod reads it in render(), so a switch re-renders
# all mods without starting any of them over: EVENTS, the histogram, Since clocks and timers keep going.
#
# ph-kit also swaps the scanline look, which only the layout can carry (layout.set on the shown tree, see
# lib/look.js): full = root background image + terminal_opacity 0.7 + transparent `main` pane frame
# (#12110e00); calm = root "canvas" + terminal_opacity 1 + `main` pane.background "background". Mod props are
# never written (a props change would restart that block); a leftover props.intensity from older installs goes.
# With the window closed this script does both itself: the installed layout file and shared.json.
# ./install.sh keeps the current intensity.
set -euo pipefail
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
# PH_LAYOUT (internal, used by install.sh) points at another copy of the layout: patch only that file's look.
LAYOUT="${PH_LAYOUT:-$HOME_DIR/layouts/phosphor.json}"
SHARED="$HOME_DIR/shared.json"
[ -f "$LAYOUT" ] || { echo "phosphor is not installed ($LAYOUT missing): run ./install.sh first" >&2; exit 1; }

current() { # the shared value: "calm", else "full"
  python3 -I -c 'import json, sys
try: v = json.load(open(sys.argv[1])).get("ph.intensity")
except Exception: v = None
print("calm" if v == "calm" else "full")' "$SHARED"
}
look() { # the layout file's look: "calm" | "full"
  python3 -I -c 'import json, sys
t = json.load(open(sys.argv[1]))
print("calm" if t.get("background") == "canvas" else "full")' "$LAYOUT" 2>/dev/null || true
}

want="${1:-}"
case "$want" in
  "") current; exit 0 ;;
  calm|full) ;;
  toggle) if [ "$(current)" = calm ]; then want=full; else want=calm; fi ;;
  *) echo "usage: $0 [calm|full|toggle]" >&2; exit 2 ;;
esac

# Window open (and not install.sh's temp copy): ph-kit sets the value and the look; wait until both are saved.
if [ -z "${PH_LAYOUT:-}" ] && herdr-app status >/dev/null 2>&1; then
  herdr-app do "ph-kit.$want" >/dev/null
  for _ in $(seq 30); do [ "$(current)" = "$want" ] && [ "$(look)" = "$want" ] && break; sleep 0.1; done
  if [ "$(current)" != "$want" ]; then
    echo "ph-kit didn't set shared ph.intensity: is the phosphor layout showing? Show it" >&2
    echo "(herdr-app do layout.switch '{\"name\":\"phosphor\"}') and run this again, or press ctrl-shift-i there." >&2
    exit 1
  fi
  [ "$(look)" = "$want" ] || echo "warning: intensity is $want, but the layout's scanline look didn't follow (see herdr-app status)" >&2
  echo "phosphor intensity: $want"
  exit 0
fi

# Window closed (or install.sh): the look in the layout file. Keep in step with lib/look.js.
python3 -I - "$LAYOUT" "$want" <<'PY'
import json, os, sys, tempfile
path, want = sys.argv[1], sys.argv[2]
with open(path) as f:
    tree = json.load(f)
before = json.dumps(tree, sort_keys=True)
calm = want == "calm"
tree["background"] = "canvas" if calm else {"image": "backgrounds/phosphor-scanlines.png", "fit": "cover"}
op = 1 if calm else 0.7
cur = tree.get("terminal_opacity")
if not (isinstance(cur, (int, float)) and abs(cur - op) < 1e-3):  # Herdr saves f32: 0.699999988… is 0.7
    tree["terminal_opacity"] = op
def walk(n):
    if isinstance(n, dict):
        if n.get("id") == "main" and isinstance(n.get("content"), dict) and isinstance(n["content"].get("pane"), dict):
            n["content"]["pane"]["background"] = "background" if calm else "#12110e00"
        if isinstance(n.get("mod"), str) and n["mod"].startswith("ph-") and isinstance(n.get("props"), dict) and "intensity" in n["props"]:
            del n["props"]["intensity"]
            if not n["props"]:
                del n["props"]
        for v in n.values():
            walk(v)
    elif isinstance(n, list):
        for v in n:
            walk(v)
walk(tree)
if json.dumps(tree, sort_keys=True) == before:
    sys.exit(0)
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
PY
[ -n "${PH_LAYOUT:-}" ] && exit 0

# ...and the value in shared.json (nobody else writes it while the window is closed).
python3 -I - "$SHARED" "$want" <<'PY'
import json, os, sys, tempfile
path, want = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}
data["ph.intensity"] = want
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), prefix=".shared.", suffix=".tmp")
with os.fdopen(fd, "w") as f:
    json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
os.replace(tmp, path)
PY
echo "phosphor intensity: $want"

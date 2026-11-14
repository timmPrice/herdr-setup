// The scanline look per intensity. Only the layout can carry it (root background, terminal_opacity, the
// `main` pane frame), so ph-kit patches the shown tree with layout.set when intensity changes; intensity.sh
// does the same edit on the file when the window is closed (keep the two in step). Pure.
//   full: root background image + terminal_opacity 0.7 + transparent `main` pane frame (#12110e00)
//   calm: root "canvas" + terminal_opacity 1 + `main` pane.background "background"
// Never touches mod props: a props change would start that block over. A leftover props.intensity on a
// ph-* block (older installs) is removed.
export const SCANLINES = { image: "backgrounds/phosphor-scanlines.png", fit: "cover" };

/** A patched deep copy of `tree` for "calm" | "full", or null when it already has that look. */
export function applyLook(tree, want) {
  if (!tree || typeof tree !== "object") return null;
  const calm = want === "calm";
  const t = JSON.parse(JSON.stringify(tree));
  const before = JSON.stringify(t);
  t.background = calm ? "canvas" : { ...SCANLINES };
  t.terminal_opacity = calm ? 1 : 0.7;
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    const pane = n.id === "main" && n.content && typeof n.content === "object" ? n.content.pane : null;
    if (pane && typeof pane === "object") pane.background = calm ? "background" : "#12110e00";
    if (typeof n.mod === "string" && n.mod.startsWith("ph-") && n.props && typeof n.props === "object" && "intensity" in n.props) {
      delete n.props.intensity;
      if (!Object.keys(n.props).length) delete n.props;
    }
    Object.values(n).forEach(walk);
  };
  walk(t);
  return JSON.stringify(t) === before ? null : t;
}

/** "calm" | "full" | null: which look a tree has (null: neither / mixed). */
export function lookOf(tree) {
  if (!tree || typeof tree !== "object") return null;
  if (applyLook(tree, "full") === null) return "full";
  if (applyLook(tree, "calm") === null) return "calm";
  return null;
}

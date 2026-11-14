// Intensity (calm | full) and motion helpers. Rule: motion only when status says so; idle = still;
// calm = no loops at all (solid cursor, static bars, no blink).
import { div } from "gpui-kit";
import { props, shared } from "herdr";
import { FONT_TERM } from "./palette.js";

/** Pure: the layout prop wins (it is what intensity.sh writes), then shared, then "full". */
export function resolveIntensity(propValue, sharedValue) {
  for (const v of [propValue, sharedValue]) if (v === "calm" || v === "full") return v;
  return "full";
}

/** "calm" | "full" for this mod copy: props().intensity, else shared("ph.intensity"), else "full". */
export function intensity() {
  let p, s;
  try { p = props()?.intensity; } catch { p = undefined; }
  try { s = shared("ph.intensity"); } catch { s = undefined; }
  return resolveIntensity(p, s);
}
export const isCalm = () => intensity() === "calm";

/** Apply fn(el) only when motion is allowed. `on` = the status condition (e.g. st === "working"). */
export function moving(el, on, fn, calm = isCalm()) {
  return on && !calm ? fn(el) : el;
}

/** WAIT blink: opacity pulse ~700 ms. Still when calm or !on. */
export function blink(el, on = true, { period = 700, from = 0.35, calm = isCalm() } = {}) {
  return moving(el, on, (e) => e.loop("opacity", { from, to: 1, period, easing: "ease-in-out" }), calm);
}

/** The █ block cursor: hard blink (frames, 530 ms) while `on`, solid otherwise / in calm. */
export function cursor(on = true, { color, size, calm = isCalm() } = {}) {
  let el = div().font_family(FONT_TERM);
  if (color) el = el.text_color(color);
  if (size) el = el.text_size(size);
  return on && !calm ? el.frames(["█", " "], 530) : el.child("█");
}

/**
 * 3-bar signal glyph. level 0..3 bars lit (dim bars drawn in `off`), animated height loop while `on`
 * (working) and not calm. Returns an h_flex-like div of width 3*bw + 2*gap, height h.
 */
export function bars(level, color, { on = false, off = "#3c3836", h = 12, bw = 3, gap = 2, calm = isCalm() } = {}) {
  const row = div().flex().flex_row().items_end().h(h).gap(gap);
  const kids = [0, 1, 2].map((i) => {
    const full = Math.round(h * (i + 1) / 3);
    let b = div().w(bw).h(full).bg(i < level ? color : off);
    if (on && !calm && i < level) b = b.loop("height", { from: Math.max(2, full * 0.35), to: full, period: 600 + i * 170, easing: "ease-in-out" });
    return b;
  });
  return row.children(kids);
}

// Machined cut-corner plates, hazard stripes and stacked-stroke glow, drawn natively with paint_path.
// All helpers return ONE element sized w×h, absolutely positioned at (0,0): put them inside a
// `.relative()` parent of the same size and add your text as a later child.
//
//   div().relative().w(64).h(18)
//     .child(plate(64, 18, P.aqua))
//     .child(div().absolute().inset_0().flex().items_center().justify_center().child("[ RUN ]"))
//
// Paths are immutable and cheap to rebuild; elements are single-use per render (never cache elements).
// This module uses gpui-kit's global `window` (paint_path). It imports nothing from "herdr", so the
// herdr `window()` import in a mod's main.js doesn't shadow it here.
import { div, PathBuilder, Background } from "gpui-kit";
import { cutPoints, insetPoints, glowLayers } from "./geom.js";
import { alpha } from "./palette.js";

const at = (el, w, h) => el.absolute().left(0).top(0).w(w).h(h);

/** Filled cut-corner polygon Path. opts: {cut=6, corners="tl br"} */
export function platePath(w, h, { cut = 6, corners = "tl br" } = {}) {
  return PathBuilder.fill().add_polygon(cutPoints(w, h, cut, corners), true).build();
}

/** Outline Path (centred stroke, inset so it stays inside w×h). */
export function outlinePath(w, h, { cut = 6, corners = "tl br", width = 1 } = {}) {
  return PathBuilder.stroke(width).add_polygon(insetPoints(w, h, cut, corners, width / 2), true).build();
}

/** A solid cut-corner plate. color: "#rrggbb[aa]". */
export function plate(w, h, color, opts = {}) {
  return at(window.paint_path(platePath(w, h, opts), color), w, h);
}

/** A 1px (or opts.width) cut-corner outline. */
export function outline(w, h, color, opts = {}) {
  return at(window.paint_path(outlinePath(w, h, opts), color), w, h);
}

/**
 * Hazard plate: diagonal stripes clipped to the cut polygon, on a dark base.
 * calm → a solid plate in `color` (no stripes). opts: {cut, corners, stripe=3, interval=8, base}
 */
export function hazard(w, h, color, { calm = false, stripe = 3, interval = 8, base, ...opts } = {}) {
  if (calm) return plate(w, h, color, opts);
  const path = platePath(w, h, opts);
  return at(div().relative()
    .child(at(window.paint_path(path, base ?? alpha(color, 0.18)), w, h))
    .child(at(window.paint_path(platePath(w, h, opts), Background.pattern_slash(color, stripe, interval)), w, h)), w, h);
}

/**
 * Stacked-stroke glow along a horizontal rule of width w, centred in a box of height h (default 8).
 * Wide faint strokes under a 1px core. calm → core only. Never put this on text.
 */
export function glowRule(w, color, { h = 8, calm = false } = {}) {
  const y = h / 2;
  return at(div().relative().children(glowLayers(calm).map(({ width, alpha: a }) =>
    at(window.paint_path(PathBuilder.stroke(width).move_to(0, y).line_to(w, y).build(), alpha(color, a)), w, h))), w, h);
}

/** Stacked-stroke glow around a cut-corner box (toasts, boot frame). calm → 1px core only. */
export function glowOutline(w, h, color, { cut = 8, corners = "tl br", calm = false } = {}) {
  const layers = glowLayers(calm);
  const pad = Math.ceil(layers[0].width / 2);
  return at(div().relative().children(layers.map(({ width, alpha: a }) =>
    at(window.paint_path(PathBuilder.stroke(width).add_polygon(insetPoints(w, h, cut, corners, pad), true).build(), alpha(color, a)), w, h))), w, h);
}

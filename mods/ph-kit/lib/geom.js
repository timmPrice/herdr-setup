// Pure geometry for plates (no imports; node-testable). lib/plate.js turns these into paths.

/**
 * Polygon points of a w×h box with cut (chamfered) corners.
 * corners: any of "tl","tr","br","bl" (string like "tl br" or array). Default "tl br" (the PHOSPHOR plate).
 * c: cut size in px, clamped to half the short side.
 */
export function cutPoints(w, h, c = 6, corners = "tl br") {
  const set = new Set(Array.isArray(corners) ? corners : String(corners).split(/[\s,]+/).filter(Boolean));
  const k = Math.max(0, Math.min(c, w / 2, h / 2));
  const pts = [];
  if (set.has("tl") && k > 0) pts.push([0, k], [k, 0]); else pts.push([0, 0]);
  if (set.has("tr") && k > 0) pts.push([w - k, 0], [w, k]); else pts.push([w, 0]);
  if (set.has("br") && k > 0) pts.push([w, h - k], [w - k, h]); else pts.push([w, h]);
  if (set.has("bl") && k > 0) pts.push([k, h], [0, h - k]); else pts.push([0, h]);
  return pts;
}

/** Points inset by d px (for an inner stroke so a centred stroke of width 2d stays inside the box). */
export function insetPoints(w, h, c, corners, d) {
  return cutPoints(w - 2 * d, h - 2 * d, Math.max(0, c - d * 0.6), corners).map(([x, y]) => [x + d, y + d]);
}

/** Glow layers for a stacked-stroke glow: widest/faintest first, the 1px core last. calm → core only. */
export function glowLayers(calm = false) {
  const core = { width: 1, alpha: 1 };
  if (calm) return [core];
  return [{ width: 7, alpha: 0x18 / 255 }, { width: 5, alpha: 0x30 / 255 }, { width: 3, alpha: 0x60 / 255 }, core];
}

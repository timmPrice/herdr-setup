// ph-pane pure helpers (no host imports, so tests/ph-pane.test.mjs can load them in node).

export const RESPOND_ACTION = "ph-kit.respond";
export const RESPOND_FALLBACK = "ctrl-shift-u";

// Match the first visible tab frame, including the active child of a stack (from mods/pane).
export function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter((child) => !child.hidden);
    children = [visible.find((child) => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Live readout: 04:12 · 1h04:12 · 2d03h. */
export function fmtLive(ms) {
  const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h === 0) return `${pad2(m)}:${pad2(s % 60)}`;
  if (h < 24) return `${h}h${pad2(m % 60)}:${pad2(s % 60)}`;
  return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
}

/** Coarse readout (minute resolution, so it doesn't tick): 27m · 1h04m · 2d03h. */
export function fmtCoarse(ms) {
  const m = Math.floor(Math.max(0, ms ?? 0) / 60000), h = Math.floor(m / 60);
  if (h === 0) return `${pad2(m)}m`;
  if (h < 24) return `${h}h${pad2(m % 60)}m`;
  return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
}

/** From keys(): the binding for ph-kit.respond, phosphor layout section first, then global, then any. */
export function pickRespondKey(list) {
  const all = (list ?? []).filter((k) => k.action === RESPOND_ACTION);
  const pick = all.find((k) => k.section === "layout:phosphor") ?? all.find((k) => k.section === "global") ?? all[0];
  return pick?.keys || RESPOND_FALLBACK;
}

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

/** Time-in-state at minute resolution (project rule): <1m · 3m · 1h04m · 2d03h. */
export function fmtMin(ms) {
  const m = Math.floor(Math.max(0, Number(ms) || 0) / 60000), h = Math.floor(m / 60);
  if (m < 1) return "<1m";
  if (h === 0) return `${m}m`;
  if (h < 24) return `${h}h${pad2(m % 60)}m`;
  return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
}

/**
 * What may move / tick in one header copy. `active` = this pane is focused in the tab on screen.
 * Hidden tabs and unfocused panes run nothing (no timer, no loops); idle/done/shell never tick.
 *   timer: per-minute time re-render · bars: signal-bar loop · blink: WAIT stripe blink
 */
export function motionPlan({ state, focused = false, shownTab = false, calm = false } = {}) {
  const active = Boolean(focused && shownTab);
  const busy = state === "working" || state === "blocked";
  return {
    active,
    timer: active && busy,
    bars: active && state === "working" && !calm,
    blink: active && state === "blocked" && !calm,
  };
}

/** From keys(): the binding for ph-kit.respond, phosphor layout section first, then global, then any. */
export function pickRespondKey(list) {
  const all = (list ?? []).filter((k) => k.action === RESPOND_ACTION);
  const pick = all.find((k) => k.section === "layout:phosphor") ?? all.find((k) => k.section === "global") ?? all[0];
  return pick?.keys || RESPOND_FALLBACK;
}

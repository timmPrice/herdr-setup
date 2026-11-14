// Pure helpers for ph-side (no imports from herdr/gpui-kit, so node tests can load them).
import { stateOf } from "./lib/palette.js";

/** Below this width the sidebar draws the compact rail. */
export const COMPACT_W = 160;
export const isCompact = (w) => typeof w === "number" && w > 0 && w < COMPACT_W;

export const pad2 = (n) => String(n ?? 0).padStart(2, "0");

const MIN = 60000;
const FORGET = 30 * 86400000; // an address gone this long is forgotten (the shipped agents mod does the same)

/** Time-in-state at minute resolution: <1m · 3m · 1h04m · 2d03h. */
export function fmtMin(ms) {
  const m = Math.floor(Math.max(0, ms ?? 0) / MIN);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${pad2(m % 60)}m`;
  return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
}

/** ms from `now` to the next whole minute (never 0: a timer at a boundary waits a full minute). */
export const toNextMinute = (now) => MIN - (now % MIN) || MIN;

/** Done and idle count as one for timing: looking at a finished agent turns done into idle. */
export const timingStatus = (s) => (s === "done" ? "idle" : s ?? null);

/**
 * Per-address time-in-state, persisted ({address: {status, at}}, the lib Since format).
 * Unlike lib/since.js it never forgets an address on its first absence: agents() is empty right
 * after a start (and a remote's agents can drop out), so only addresses gone for 30 days go.
 */
export class Clock {
  constructor(map = {}) { this.map = map; }
  static load(json) {
    try { const m = JSON.parse(json ?? "{}"); return new Clock(m && typeof m === "object" && !Array.isArray(m) ? m : {}); }
    catch { return new Clock(); }
  }
  dump() { return JSON.stringify(this.map); }

  /** list: [{address, status}]; seed(item) → epoch ms | null for an address seen the first time. True when changed. */
  track(list, now = Date.now(), seed = null) {
    let changed = false;
    for (const a of list ?? []) {
      if (!a?.address) continue;
      const s = timingStatus(a.status);
      const prev = this.map[a.address];
      if (prev && timingStatus(prev.status) === s) {
        if (prev.status !== s) { this.map[a.address] = { status: s, at: prev.at }; changed = true; }
        continue;
      }
      this.map[a.address] = { status: s, at: prev ? now : clampSeed(seed?.(a), now) };
      changed = true;
    }
    if (changed) {
      const listed = new Set((list ?? []).map((a) => a?.address));
      for (const [k, c] of Object.entries(this.map)) if (!listed.has(k) && now - (c?.at ?? 0) > FORGET) delete this.map[k];
    }
    return changed;
  }
  at(address) { return this.map[address]?.at ?? null; }
  elapsed(address, now = Date.now()) { const t = this.at(address); return t == null ? 0 : Math.max(0, now - t); }
}

function clampSeed(t, now) {
  if (typeof t !== "number" || !isFinite(t) || t <= 0) return now;
  const ms = t < 1e12 ? t * 1000 : t;
  return ms > now ? now : ms;
}

const APP_SHORT = { "claude-code": "claude", "claude code": "claude", "gemini-cli": "gemini" };

/** Short lowercase program name: "claude", "codex", "opencode"; falls back to app, then "agent". */
export function progName(a) {
  const key = a?.program?.key;
  if (key && key !== "program" && key !== "agent" && key !== "shell") return key;
  const app = String(a?.app ?? "").toLowerCase();
  if (app) return APP_SHORT[app] ?? app.split(/\s+/)[0];
  const name = String(a?.program?.name ?? "").toLowerCase();
  if (name) return APP_SHORT[name] ?? name.split(/\s+/)[0];
  return "agent";
}

/** Signal bars lit per state: active states full, idle flat. */
export function barLevel(status) {
  const k = stateOf(status).key;
  return k === "idle" ? 0 : k === "shell" ? 1 : 3;
}

const rank = (s) => stateOf(s).rank; // 0 = most urgent

/** space id → agent statuses in that space, most urgent first (one pip each). */
export function pipsBySpace(list) {
  const m = new Map();
  for (const a of (list ?? []).slice().sort((x, y) => rank(x?.status) - rank(y?.status) || (x?.seq ?? 0) - (y?.seq ?? 0))) {
    if (!a?.space) continue;
    if (!m.has(a.space)) m.set(a.space, []);
    m.get(a.space).push(a.status ?? null);
  }
  return m;
}

/** At most `max` pips; when there are more, max-1 pips plus a "+n" count. */
export function fitPips(statuses, max) {
  const s = statuses ?? [];
  if (max <= 0) return { shown: [], more: s.length };
  if (s.length <= max) return { shown: s, more: 0 };
  const keep = Math.max(0, max - 1);
  return { shown: s.slice(0, keep), more: s.length - keep };
}

/** "01·herdr-neo-kyoto": the agent's home node (space index + name). */
export function homeNode(a, spaceList) {
  const s = (spaceList ?? []).find((x) => x.id === a?.space);
  const idx = s?.index;
  const name = a?.space_name ?? s?.name ?? "";
  return idx ? `${pad2(idx)}·${name}` : name;
}

// ── sub-agents (pane-less `hc run` children live only in terminals(), with a `parent`) ──

/** A sub-agent's status: agents()'s word when it has a pane, else its raw word; error = blocked, done = idle
 *  (it reports to its parent, and the parent's done is the news). */
export function kidStatus(k, listed) {
  const s = listed?.get?.(k?.address) ?? k?.status ?? null;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
}

/** Live sub-agents of `addr`, depth first: [{t, lines}] where lines are the tree glyphs in front of it. */
export function subTree(all, addr, lead = [], seen = new Set([addr])) {
  const kids = (all ?? []).filter((k) => k?.parent === addr && k.state === "live" && !seen.has(k.address));
  for (const k of kids) seen.add(k.address);
  return kids.flatMap((k, i) => {
    const last = i === kids.length - 1;
    return [{ t: k, lines: [...lead, last ? "└" : "├"] }, ...subTree(all, k.address, [...lead, last ? " " : "│"], seen)];
  });
}

/** Tree glyphs → one monospace string: ["│","└"] → "│ └─". */
export const treeText = (lines) => lines.map((l, i) => (i === lines.length - 1 ? `${l}─` : `${l} `)).join("");

/** Name for a sub-agent row. */
export const kidName = (k) => k?.name || k?.template || k?.program?.name || k?.address || "?";

/**
 * The DAEMONS list: [{a, subs, eff}] in sidebar order. Pinned first; then by urgency, where a parent takes
 * its most urgent sub-agent's place (eff); ties by time entered the state (oldest first), then address.
 * A sub-agent that has its own pane (so it is in agents()) shows in its parent's tree, not on its own, unless pinned.
 */
export function daemonList(list, all, clock) {
  const agentsList = list ?? [];
  const listed = new Map(agentsList.map((a) => [a.address, a.status]));
  const trees = new Map(agentsList.map((a) => [a.address, subTree(all, a.address)]));
  const nested = new Set([...trees.values()].flatMap((t) => t.map((s) => s.t.address)));
  const rows = agentsList.filter((a) => a.pinned || !nested.has(a.address)).map((a) => {
    const subs = trees.get(a.address) ?? [];
    let eff = a.status ?? null;
    for (const s of subs) { const ks = kidStatus(s.t, listed); if (rank(ks) < rank(eff)) eff = ks; }
    return { a, subs, eff };
  });
  const at = (r) => clock?.at?.(r.a.address) ?? Infinity;
  return rows.sort((x, y) => (Number(!!y.a.pinned) - Number(!!x.a.pinned)) || (rank(x.eff) - rank(y.eff))
    || (at(x) - at(y)) || String(x.a.address).localeCompare(String(y.a.address)));
}

/** What the timing tracker watches: agents plus every live sub-agent (as {address, status, tab}). */
export function timed(list, all) {
  const listed = new Map((list ?? []).map((a) => [a.address, a.status]));
  const out = [...(list ?? [])];
  for (const t of all ?? []) {
    if (t?.parent && t.state === "live" && !listed.has(t.address)) out.push({ address: t.address, status: kidStatus(t, listed) });
  }
  return out;
}

/** The readouts shown right now (re-render only when one changes). */
export function minuteKey(addresses, clock, now) {
  return (addresses ?? []).map((a) => fmtMin(clock.elapsed(a, now))).join("|");
}

// ── nodes ──

/** Where a space is now: its first terminal's live folder (panes() order), else where it was made. */
export function place(s, ps) {
  const tabs = new Set((s?.tabs ?? []).map((t) => t.id));
  return (ps ?? []).find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s?.folder || null;
}

/**
 * Spaces in display order, each worktree space under its main checkout: [{s, tree}] with tree "├─"/"└─"/null.
 * gitOf(space) → { repo, linked } | null. Display only: the real order is never changed here.
 */
export function nestSpaces(sp, gitOf) {
  const list = (sp ?? []).map((s) => ({ s, g: gitOf(s) ?? null }));
  const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
  const nested = (r) => r.g?.linked && mains.has(r.g.repo);
  const out = [];
  const placed = new Set();
  for (const r of list) {
    if (nested(r)) continue;
    out.push({ s: r.s, tree: null });
    if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
    placed.add(r.g.repo);
    const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
    kids.forEach((k, n) => out.push({ s: k.s, tree: n === kids.length - 1 ? "└─" : "├─" }));
  }
  return out;
}

/** Git suffix for a node row: "main ↑2 ↓4" pieces. */
export function gitBits(branch, g) {
  const out = [];
  if (branch) out.push({ kind: "branch", text: branch });
  if (g?.ahead > 0) out.push({ kind: "ahead", text: `↑${g.ahead}` });
  if (g?.behind > 0) out.push({ kind: "behind", text: `↓${g.behind}` });
  return out;
}

/** Find a layout node by id. */
export function findNode(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) { const f = findNode(c, id); if (f) return f; }
  return null;
}

// Pure helpers for ph-side (no imports from herdr/gpui-kit, so node tests can load them).
import { stateOf, byUrgency } from "./lib/palette.js";
import { fmtDur } from "./lib/since.js";

/** Below this width the sidebar draws the compact rail. */
export const COMPACT_W = 160;
export const isCompact = (w) => typeof w === "number" && w > 0 && w < COMPACT_W;

export const pad2 = (n) => String(n ?? 0).padStart(2, "0");

/** Time-in-state as a VT323 readout: 00:41 / 27:05 under an hour, then 1h04m / 2d03h. */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
  if (s < 3600) return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  return fmtDur(ms);
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

/** space id → agent statuses in that space, most urgent first (one pip each). */
export function pipsBySpace(list) {
  const m = new Map();
  for (const a of (list ?? []).slice().sort(byUrgency)) {
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

/** The agents in sidebar order. */
export const ordered = (list) => (list ?? []).slice().sort(byUrgency);

/** What the clocks show right now (to re-render only when a readout changes). */
export function clockKey(list, since, now) {
  return (list ?? []).map((a) => fmtClock(since.elapsed(a.address, now))).join("|");
}

/** Git suffix for a node row: "main ↑2 ↓4" pieces. */
export function gitBits(branch, g) {
  const out = [];
  if (branch) out.push({ kind: "branch", text: branch });
  if (g?.ahead > 0) out.push({ kind: "ahead", text: `↑${g.ahead}` });
  if (g?.behind > 0) out.push({ kind: "behind", text: `↓${g.behind}` });
  return out;
}

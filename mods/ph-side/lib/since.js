// Per-agent time-in-state tracker. Herdr exposes no per-agent timestamp (only per-tab changed_at /
// working_since), so each mod copy observes agents() on render and remembers when each address last
// changed status. After a restart timers start from the best seed available (the tab's changed_at),
// else from zero. Pure: no imports, node-testable.
//
//   init()   { this.since = Since.load(localStorage.getItem("since")); }
//   render() { const a = agents(); if (this.since.observe(a, Date.now(), tabSeed(spaces())))
//                localStorage.setItem("since", this.since.dump());
//              ... fmtDur(this.since.elapsed(agent.address)) }
// Project rule: time-in-state is shown at minute resolution; re-render at most once a wall-clock minute,
// and only where a RUN/WAIT readout is on screen. Nothing ticks per second.
//
// Restart-safe: an address missing from one render is NOT forgotten (an empty first agents() after a
// restart must not wipe history). An absent address is dropped only once its entry is older than
// 30 days (same rule as ph-side's Clock and the shipped agents mod), and only on an observe that
// changed something else, so an empty or unchanged render never writes.

const FORGET = 30 * 24 * 3600 * 1000;

export class Since {
  constructor(map = {}) { this.map = map; } // address → { status, at }

  static load(json) {
    try { const m = JSON.parse(json ?? "{}"); return new Since(m && typeof m === "object" ? m : {}); }
    catch { return new Since(); }
  }
  dump() { return JSON.stringify(this.map); }

  /**
   * Record agents' statuses. seed(agent) → epoch ms | null, used only for an address seen the first time.
   * Absent addresses are kept (see header); forgotten only when absent and older than 30 days.
   * Returns true when anything changed (persist then).
   */
  observe(list, now = Date.now(), seed = null) {
    let changed = false;
    const seen = new Set();
    for (const a of list ?? []) {
      if (!a?.address) continue;
      seen.add(a.address);
      const prev = this.map[a.address];
      if (!prev) {
        this.map[a.address] = { status: a.status ?? null, at: clampSeed(seed?.(a), now) };
        changed = true;
      } else if (prev.status !== (a.status ?? null)) {
        this.map[a.address] = { status: a.status ?? null, at: now };
        changed = true;
      }
    }
    if (changed) {
      for (const [k, e] of Object.entries(this.map)) if (!seen.has(k) && now - (e?.at ?? 0) > FORGET) delete this.map[k];
    }
    return changed;
  }

  /** epoch ms when this address entered its current status, or null if never seen. */
  since(address) { return this.map[address]?.at ?? null; }
  /** ms in the current status (0 if unknown). */
  elapsed(address, now = Date.now()) { const t = this.since(address); return t == null ? 0 : Math.max(0, now - t); }
  status(address) { return this.map[address]?.status ?? null; }
}

function clampSeed(t, now) {
  if (typeof t !== "number" || !isFinite(t) || t <= 0) return now;
  const ms = t < 1e12 ? t * 1000 : t; // accept seconds too
  return ms > now ? now : ms;
}

/** Seed from spaces(): the agent's tab changed_at, if that tab's status is the agent's status. */
export function tabSeed(spaceList) {
  const tabs = new Map();
  for (const s of spaceList ?? []) for (const t of s.tabs ?? []) tabs.set(t.id, t);
  return (a) => {
    const t = tabs.get(a.tab);
    return t && t.status === a.status ? t.changed_at ?? null : null;
  };
}

/** 4s · 3m12s · 1h04m · 2d03h (compact, monospace-friendly). */
export function fmtDur(ms) {
  const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d${String(h % 24).padStart(2, "0")}h`;
}

/** The blocked agent that has waited longest (by tracker time, then lowest seq), or null. */
export function oldestBlocked(list, since = null, now = Date.now()) {
  const blocked = (list ?? []).filter((a) => a?.status === "blocked");
  if (!blocked.length) return null;
  const at = (a) => since?.since(a.address) ?? now;
  return blocked.slice().sort((a, b) => (at(a) - at(b)) || ((a.seq ?? 0) - (b.seq ?? 0)))[0];
}

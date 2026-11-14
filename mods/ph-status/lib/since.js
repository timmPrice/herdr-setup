// Per-agent time-in-state tracker. Herdr exposes no per-agent timestamp (only per-tab changed_at /
// working_since), so each mod copy observes agents() on render and remembers when each address last
// changed status. After a restart timers start from the best seed available (the tab's changed_at),
// else from zero. Pure: no imports, node-testable.
//
//   init()   { this.since = Since.load(localStorage.getItem("since")); }
//   render() { const a = agents(); if (this.since.observe(a, Date.now(), tabSeed(spaces())))
//                localStorage.setItem("since", this.since.dump());
//              ... fmtDur(this.since.elapsed(agent.address)) }
// Re-render once a second only where a ticking timer is shown (cx.timer.every(1000, cx => cx.notify())).

export class Since {
  constructor(map = {}) { this.map = map; } // address → { status, at }

  static load(json) {
    try { const m = JSON.parse(json ?? "{}"); return new Since(m && typeof m === "object" ? m : {}); }
    catch { return new Since(); }
  }
  dump() { return JSON.stringify(this.map); }

  /**
   * Record agents' statuses. seed(agent) → epoch ms | null, used only for an address seen the first time.
   * Forgets addresses no longer present. Returns true when anything changed (persist then).
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
    for (const k of Object.keys(this.map)) if (!seen.has(k)) { delete this.map[k]; changed = true; }
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

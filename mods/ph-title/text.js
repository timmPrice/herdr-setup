// Pure text helpers for ph-title (no imports: node-testable).

const ORDER = [["working", "RUN"], ["blocked", "WAIT"], ["done", "OK"], ["idle", "IDLE"]];

/** "// 5 daemons · 1 RUN · 1 WAIT …": total + non-zero counts per state, in RUN WAIT OK IDLE order. */
export function summary(list = []) {
  const n = list.length;
  const parts = [];
  for (const [key] of ORDER) {
    const c = list.filter((a) => a?.status === key).length;
    if (c) parts.push({ key, n: c });
  }
  return { total: `${n} daemon${n === 1 ? "" : "s"}`, parts };
}

/**
 * Alert strip pieces for the blocked agents. `target` is the agent ph-kit.respond will focus
 * (oldestBlocked(list, since) from lib/since.js); without it, the first blocked agent.
 */
export function alertText(blocked = [], key = "ctrl-shift-u", target = null) {
  const n = blocked.length;
  const a = target ?? blocked[0] ?? null;
  const prog = a?.program?.name || a?.app || "agent";
  const what = [a?.space_name, a?.title].filter(Boolean).join(" · ");
  return {
    head: n === 1 ? "1 DAEMON NEEDS YOU" : `${n} DAEMONS NEED YOU`,
    who: a ? `${prog}@${a.address}` : "",
    what: what ? `· ${what}` : "",
    key,
  };
}

/** The key bound to ph-kit.respond (layout:phosphor first), else the default. */
export function respondKey(list = []) {
  const hits = (list ?? []).filter((k) => k?.action === "ph-kit.respond");
  const best = hits.find((k) => k.section === "layout:phosphor") ?? hits[0];
  return best?.keys ?? "ctrl-shift-u";
}

/** HH:MM:SS (HH:MM when minutes only). */
export function clockText(d, minutes = false) {
  const p = (x) => String(x).padStart(2, "0");
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return minutes ? hm : `${hm}:${p(d.getSeconds())}`;
}

/** Uplink state from machines(): OK, SYNC while loading, "N DOWN" when a core is unavailable. */
export function uplink(list = []) {
  const ms = list ?? [];
  const down = ms.filter((m) => m?.layout === "unavailable").length;
  if (down) return { ok: false, label: `${down} DOWN` };
  if (ms.some((m) => m?.layout === "loading")) return { ok: true, label: "SYNC" };
  return { ok: true, label: "OK" };
}

/** The UPDATE tag beside v<ver>: null unless an app update is downloaded (updates().app.ready). */
export function updateTag(u) {
  const ready = u?.app?.ready;
  if (!ready) return null;
  return { label: "UPDATE", tip: typeof ready === "string" ? `Restart into v${ready}` : "Restart into the downloaded update" };
}

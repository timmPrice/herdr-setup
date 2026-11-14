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

/** Oldest blocked first: lowest seq (higher seq = changed more recently). */
export function oldest(blocked = []) {
  return blocked.slice().sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0))[0] ?? null;
}

/** Alert strip pieces for the blocked agents. */
export function alertText(blocked = [], key = "ctrl-shift-u") {
  const n = blocked.length;
  const a = oldest(blocked);
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

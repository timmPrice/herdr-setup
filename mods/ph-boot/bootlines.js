// Pure: builds the boot log lines from a snapshot of real data. No imports from herdr/gpui-kit,
// so node tests can load it. main.js gathers the snapshot and draws the lines.
//
// A line: { tag: "[ OK ]"|"[WAIT]"|"[RUN ]"|"[FAIL]", color, parts: [{ text, color? }] }
// A part without a colour uses the default line text colour.

import { P } from "./lib/palette.js";

const OK = { tag: "[ OK ]", color: P.green };
const WAIT = { tag: "[WAIT]", color: P.red };
const RUN = { tag: "[RUN ]", color: P.aqua };
const FAIL = { tag: "[FAIL]", color: P.red };

const hot = (text) => ({ text: String(text), color: P.amber });
const dim = (text) => ({ text, color: P.dim2 });
const txt = (text) => ({ text });
const SEP = dim(" · ");

/** Shorten to n chars with an ellipsis (the overlay row has a fixed width; flex text can't ellipsize mid-row). */
export function clip(s, n) {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s;
}

/** Every distinct `mod` named in a layout tree (blocks, pane headers, floats, toast...). */
export function layoutMods(tree) {
  const out = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    if (typeof n.mod === "string") out.add(n.mod);
    if (typeof n.toast === "string") out.add(n.toast);
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
  };
  walk(tree);
  return [...out];
}

/** "claude ×3, codex ×1": agents grouped by program, most first, then by name. */
export function daemonsByProgram(agents) {
  const n = new Map();
  for (const a of agents ?? []) {
    const name = a?.program?.name || a?.app || "agent";
    n.set(name, (n.get(name) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Telemetry snapshot from /proc text (any argument may be null when unreadable). */
export function parseTelemetry({ cpuinfo, meminfo, route, speed } = {}) {
  const t = { cpus: null, memGiB: null, iface: null, speed: null };
  if (cpuinfo) { const n = (cpuinfo.match(/^processor\s*:/gm) ?? []).length; if (n) t.cpus = n; }
  if (meminfo) { const m = meminfo.match(/^MemTotal:\s+(\d+)\s*kB/m); if (m) t.memGiB = Math.round(Number(m[1]) / 1048576); }
  if (route) {
    // /proc/net/route: Iface Destination ... ; default route has Destination 00000000.
    for (const line of route.split("\n").slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f.length > 2 && f[1] === "00000000") { t.iface = f[0]; break; }
    }
  }
  const s = Number(String(speed ?? "").trim());
  if (Number.isFinite(s) && s > 0) t.speed = s;
  return t;
}

function fmtSpeed(mbps) {
  if (!mbps) return null;
  return mbps >= 1000 ? `${+(mbps / 1000).toFixed(1)} Gb/s` : `${mbps} Mb/s`;
}

/**
 * snap: { layout, tree, fontsWanted: [[label, family]...], fontsHave: string[], spaces, agents,
 *         terminals, telemetry (parseTelemetry result or null) }
 * maxWait: blocked agents listed one per line, the rest summarised.
 */
export function bootLines(snap, { maxWait = 3 } = {}) {
  const lines = [];
  const spaces = snap.spaces ?? [];
  const agents = snap.agents ?? [];

  // 1. layout, mods, fonts
  const mods = layoutMods(snap.tree).length;
  const have = new Set(snap.fontsHave ?? []);
  const wanted = snap.fontsWanted ?? [];
  const missing = wanted.filter(([, fam]) => !have.has(fam)).map(([l]) => l);
  const found = wanted.filter(([, fam]) => have.has(fam)).map(([l]) => l);
  const l1 = [txt("Loaded layout "), hot(snap.layout || "?"), SEP, txt(`${mods} mod${mods === 1 ? "" : "s"}`)];
  if (found.length) l1.push(SEP, txt("fonts "), dim(found.join("/")));
  if (missing.length) l1.push(SEP, { text: "missing " + missing.join("/"), color: P.red });
  lines.push({ ...(missing.length ? FAIL : OK), parts: l1 });

  // 2. nodes, tabs, terminals
  const tabs = spaces.reduce((n, s) => n + (s?.tabs?.length ?? 0), 0);
  const terms = (snap.terminals ?? []).length;
  lines.push({ ...OK, parts: [txt("Restored "), hot(spaces.length), txt(` node${spaces.length === 1 ? "" : "s"}`), SEP,
    hot(tabs), txt(` tab${tabs === 1 ? "" : "s"}`), SEP, hot(terms), txt(` terminal${terms === 1 ? "" : "s"}`)] });

  // 3. daemons by program
  const by = daemonsByProgram(agents);
  if (agents.length) {
    lines.push({ ...OK, parts: [txt("Attached "), hot(agents.length), txt(` daemon${agents.length === 1 ? "" : "s"}`), SEP,
      dim(by.map(([n, c]) => `${n} ×${c}`).join(", "))] });
  } else {
    lines.push({ ...OK, parts: [txt("No daemons attached"), SEP, dim("all quiet")] });
  }

  // 4. blocked agents, oldest change first (lowest seq)
  const blocked = agents.filter((a) => a?.status === "blocked").sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  for (const a of blocked.slice(0, maxWait)) {
    const prog = a.program?.name || a.app || "agent";
    const tab = a.tab_name ? clip(a.tab_name, 24) : null;
    const where = [a.space_name ? clip(a.space_name, 28) : null,
      a.tab_index != null ? `${String(a.tab_index).padStart(2, "0")}${tab ? ":" + tab : ""}` : tab]
      .filter(Boolean).join(" › ");
    lines.push({ ...WAIT, parts: [{ text: clip(`${prog}@${a.address}`, 24), color: P.fg }, dim(" needs input"), ...(where ? [SEP, dim(where)] : [])] });
  }
  if (blocked.length > maxWait) {
    const more = blocked.length - maxWait;
    lines.push({ ...WAIT, parts: [txt(`${more} more daemon${more === 1 ? "" : "s"} need${more === 1 ? "s" : ""} you`)] });
  }

  // 5. telemetry
  const t = snap.telemetry;
  if (t && (t.cpus || t.memGiB || t.iface)) {
    const p = [txt("Telemetry "), dim("/proc")];
    if (t.cpus) p.push(SEP, txt(`${t.cpus} cpu`));
    if (t.memGiB) p.push(SEP, txt(`${t.memGiB} GiB`));
    if (t.iface) p.push(SEP, txt(`${t.iface} up${t.speed ? " " + fmtSpeed(t.speed) : ""}`));
    lines.push({ ...OK, parts: p });
  } else {
    lines.push({ ...OK, parts: [txt("Telemetry "), dim("/proc"), SEP, dim("sampling")] });
  }

  // 6. hand-over (the cursor is drawn by main.js)
  lines.push({ ...RUN, parts: [txt("Handing over to operator")], last: true });
  return lines;
}

/** Ms between lines so the whole log fits `total` ms, never slower than `step`. */
export function stepFor(n, { step = 160, total = 1100 } = {}) {
  return n <= 1 ? step : Math.max(60, Math.min(step, Math.floor(total / n)));
}

/** Filled cells of a `cells`-cell bar after `shown` of `n` lines. */
export function cellsFor(shown, n, cells = 40) {
  if (n <= 0) return cells;
  return Math.max(0, Math.min(cells, Math.round((cells * shown) / n)));
}

/** A per-process run id: "<boot_id>:<pid>:<starttime>" from /proc/sys/kernel/random/boot_id and
 *  /proc/self/stat (field 22, clock ticks since boot). It changes with every app start and stays the same
 *  for the whole run, whatever happens to mod copies or module versions. Null when unreadable (no /proc). */
export function runId(stat, bootId) {
  const s = String(stat ?? "");
  const close = s.lastIndexOf(")");
  const pid = Number.parseInt(s, 10);
  if (close < 0 || !Number.isFinite(pid)) return null;
  const f = s.slice(close + 2).trim().split(/\s+/); // f[0] is field 3 (state), so field 22 is f[19]
  const start = f[19];
  if (!start || !/^\d+$/.test(start)) return null;
  return `${String(bootId ?? "").trim().slice(0, 8) || "-"}:${pid}:${start}`;
}

/** Cold start: the host's lists fill in during the first moments. The snapshot waits until it has
 *  spaces and terminals, or until the deadline (then it takes what is there). */
export function snapshotReady({ spaces, terminals } = {}, waitedMs = 0, deadlineMs = 400) {
  return waitedMs >= deadlineMs || ((spaces?.length ?? 0) > 0 && (terminals?.length ?? 0) > 0);
}

/** Where pane.focus should send the keyboard when the overlay closes: the pane that had focus at open,
 *  else the terminal block that had it, else whatever focus reports now, else the first terminal of the
 *  shown tab (live terminals carry it in labels herdr.space/herdr.tab; fakes may carry `tab`/`pane`).
 *  Null when there is nothing to focus. */
export function focusTarget(was, now, spaces, terminals) {
  if (was?.pane) return { pane: was.pane };
  if (was?.terminal) return { terminal: was.terminal };
  if (now?.pane) return { pane: now.pane };
  if (now?.terminal) return { terminal: now.terminal };
  const space = (spaces ?? []).find((s) => s?.active) ?? null;
  const tab = space?.tabs?.find((t) => t?.active) ?? null;
  const names = new Set([tab?.id, tab?.name, now?.tab].filter(Boolean));
  const spaceNames = new Set([space?.id, space?.name, now?.space].filter(Boolean));
  const inTab = (x) => {
    const l = x?.labels ?? {};
    if (x?.tab && names.has(x.tab)) return true;
    return names.has(l["herdr.tab"]) && (!l["herdr.space"] || spaceNames.has(l["herdr.space"]));
  };
  const t = (terminals ?? []).find((x) => x && x.state !== "exited" && inTab(x)) ?? null;
  if (t?.pane) return { pane: t.pane };
  if (t?.address) return { terminal: t.address };
  return null;
}

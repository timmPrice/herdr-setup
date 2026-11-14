// ph-telemetry model: pure (no imports), node-tested in tests/telemetry.test.mjs.
//   Hist   60-minute histogram of the working-agent count (one bin per minute, max seen in that minute)
//   Events status-change log built by diffing observed agents()
//   parse* /proc parsers; Host keeps the previous sample for CPU/NET deltas

export const MIN = 60_000;

/**
 * Working-count histogram, keyed by epoch minute: bins[m] = max working count seen in minute m,
 * ends[m] = the last count seen in minute m (what a following unsampled minute carries).
 */
export class Hist {
  constructor(bins = {}, last = 0, ends = {}) { this.bins = bins; this.last = last; this.ends = ends; } // last: most recent count seen
  static load(json) {
    try {
      const o = JSON.parse(json ?? "null");
      if (!o || typeof o.bins !== "object" || !o.bins) return new Hist();
      return new Hist(o.bins, o.last | 0, o.ends && typeof o.ends === "object" ? o.ends : {});
    } catch { return new Hist(); }
  }
  dump() { return JSON.stringify({ bins: this.bins, last: this.last, ends: this.ends }); }

  /** Record a working count at `now`. Returns true when stored data changed. Drops bins older than 60 min. */
  sample(count, now = Date.now()) {
    const m = Math.floor(now / MIN);
    let changed = false;
    if ((this.bins[m] ?? -1) < count) { this.bins[m] = count; changed = true; }
    if (this.ends[m] !== count) { this.ends[m] = count; changed = true; }
    if (this.last !== count) { this.last = count; changed = true; }
    for (const k of Object.keys(this.bins)) if (+k <= m - 60) { delete this.bins[k]; changed = true; }
    for (const k of Object.keys(this.ends)) if (+k <= m - 60) { delete this.ends[k]; changed = true; }
    return changed;
  }

  /**
   * 60 values, oldest first, ending at the current minute. A minute with no sample (the app was closed)
   * carries the last count seen before it, not that minute's max; before any sample it is 0.
   */
  series(now = Date.now()) {
    const m = Math.floor(now / MIN);
    const end = (k) => this.ends[k] ?? 0; // data saved before `ends` existed: carry 0
    const out = [];
    let carry = null;
    // carry-in: the newest bin older than the window start
    for (const k of Object.keys(this.bins)) if (+k < m - 59 && (carry == null || +k > carry)) carry = +k;
    let v = carry != null ? end(carry) : 0;
    for (let i = m - 59; i <= m; i++) {
      if (this.bins[i] != null) { out.push(this.bins[i]); v = end(i); }
      else out.push(v);
    }
    return out;
  }
}

/** Short program name for an agent row: claude, codex, opencode, zsh… */
export function progOf(a) {
  return a?.program?.key ?? a?.app ?? a?.program?.name ?? "sh";
}

/**
 * Status-change log. prev: address → status (in memory only). Keeps the newest `cap` events, newest first.
 * Only the list is persisted: every start (app restart, hot reload) seeds prev from its first observation.
 */
export class Events {
  constructor(list = [], cap = 60) { this.list = list; this.prev = null; this.names = {}; this.cap = cap; }
  static load(json, cap = 60) {
    try {
      const o = JSON.parse(json ?? "null");
      return new Events(o && Array.isArray(o.list) ? o.list.slice(0, cap) : [], cap);
    } catch { return new Events([], cap); }
  }
  dump() { return JSON.stringify({ list: this.list }); }

  /**
   * Diff agents against the last observation. The first observation after a start only records
   * statuses (silent), and an empty first observation doesn't count (agents() may not be filled yet),
   * so a restart never floods the log. A new address logs from: null ("spawned"), a vanished address
   * logs to: "gone". Returns true when the list changed.
   */
  observe(agentList, now = Date.now()) {
    const cur = {};
    const names = {};
    for (const a of agentList ?? []) {
      if (!a?.address) continue;
      cur[a.address] = a.status ?? null;
      names[a.address] = progOf(a);
    }
    if (this.prev == null) {
      if (Object.keys(cur).length) { this.prev = cur; this.names = names; }
      return false;
    }
    const add = [];
    let changed = false;
    for (const [addr, st] of Object.entries(cur)) {
      if (!(addr in this.prev)) add.push({ t: now, addr, prog: names[addr], from: null, to: st });
      else if (this.prev[addr] !== st) add.push({ t: now, addr, prog: names[addr], from: this.prev[addr], to: st });
    }
    for (const addr of Object.keys(this.prev)) {
      if (!(addr in cur)) { add.push({ t: now, addr, prog: this.names?.[addr] ?? null, from: this.prev[addr], to: "gone" }); }
    }
    if (add.length) { this.list = [...add.reverse(), ...this.list].slice(0, this.cap); changed = true; }
    this.prev = cur;
    this.names = names;
    return changed;
  }
}

/** HH:MM:SS local time. */
export function clock(t) {
  const d = new Date(t);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

// ---------- /proc ----------

/** /proc/stat first line → {busy, total} jiffies. */
export function parseStat(text) {
  const line = (text ?? "").split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const v = line.trim().split(/\s+/).slice(1).map(Number);
  const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = v;
  const idleAll = idle + iowait;
  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  const ncpu = (text.match(/^cpu\d+\s/gm) ?? []).length || 1;
  return { busy: total - idleAll, total, ncpu };
}

/** /proc/meminfo → {total, used} bytes (used = MemTotal − MemAvailable). */
export function parseMem(text) {
  const kb = (k) => { const m = (text ?? "").match(new RegExp(`^${k}:\\s+(\\d+)`, "m")); return m ? +m[1] * 1024 : null; };
  const total = kb("MemTotal");
  const avail = kb("MemAvailable") ?? kb("MemFree");
  if (total == null || avail == null) return null;
  return { total, used: Math.max(0, total - avail) };
}

/** /proc/net/dev → {rx, tx, ifs: {name: {rx, tx}}} bytes, over interfaces except lo and virtual bridges/veths. */
export function parseNet(text) {
  let rx = 0, tx = 0, any = false;
  const ifs = {};
  for (const l of (text ?? "").split("\n")) {
    const m = l.match(/^\s*([^:\s]+):\s*(.*)$/);
    if (!m) continue;
    const name = m[1];
    if (name === "lo" || /^(veth|docker|br-|virbr|podman|cni|flannel|tun|tap|wg)/.test(name)) continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    if (f.length < 9) continue;
    rx += f[0]; tx += f[8]; any = true;
    ifs[name] = { rx: f[0], tx: f[8] };
  }
  return any ? { rx, tx, ifs } : null;
}

/** /proc/loadavg → [1, 5, 15]. */
export function parseLoad(text) {
  const f = (text ?? "").trim().split(/\s+/).slice(0, 3).map(Number);
  return f.length === 3 && f.every(isFinite) ? f : null;
}

/** /proc/uptime → seconds. */
export function parseUptime(text) {
  const s = parseFloat((text ?? "").trim().split(/\s+/)[0]);
  return isFinite(s) ? s : null;
}

/**
 * Host sampler state. feed(texts, now) with the raw /proc texts → a snapshot:
 * {cpu: 0..1 | null, mem: {used,total} | null, net: {rx,tx} bytes/s | null, load, up, ncpu}
 * CPU and NET need two samples; the first feed gives null for them.
 */
export class Host {
  constructor() { this.prev = null; this.snap = null; }
  feed({ stat, meminfo, netdev, loadavg, uptime }, now = Date.now()) {
    const s = parseStat(stat), n = parseNet(netdev);
    let cpu = null, net = null;
    if (this.prev) {
      if (s && this.prev.s) {
        const dt = s.total - this.prev.s.total;
        cpu = dt > 0 ? Math.max(0, Math.min(1, (s.busy - this.prev.s.busy) / dt)) : this.snap?.cpu ?? null;
      }
      const secs = (now - this.prev.t) / 1000;
      if (n && this.prev.n && secs > 0) {
        // per-interface deltas: an interface that appears (re-plugged, renamed) or whose counter
        // wraps/resets adds nothing for that tick instead of a spike
        let rx = 0, tx = 0;
        for (const [name, c] of Object.entries(n.ifs)) {
          const p = this.prev.n.ifs[name];
          if (!p) continue;
          rx += Math.max(0, c.rx - p.rx); tx += Math.max(0, c.tx - p.tx);
        }
        net = { rx: rx / secs, tx: tx / secs };
      }
    }
    this.prev = { s, n, t: now };
    this.snap = { cpu, mem: parseMem(meminfo), net, load: parseLoad(loadavg), up: parseUptime(uptime), ncpu: s?.ncpu ?? null };
    return this.snap;
  }
}

/** Bytes → "18.4G" style (1024-based, one decimal under 100). */
export function fmtBytes(b) {
  if (b == null || !isFinite(b)) return "--";
  const u = ["B", "K", "M", "G", "T"];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1024; i++; }
  return (b < 10 && i > 0 ? b.toFixed(1) : String(Math.round(b))) + u[i];
}

/**
 * Bytes/s for NET, deliberately coarse so an idle link doesn't redraw the window every tick:
 * under 1 KiB/s → "<1K", then 2 significant figures ("4K", "37K", "120K"... "1.2M", "45M").
 */
export function fmtRate(b) {
  if (b == null || !isFinite(b)) return "--";
  if (b < 1024) return "<1K";
  const u = ["K", "M", "G", "T"];
  const two = (x) => { const mag = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1); return Math.round(x / mag) * mag; };
  let i = 0;
  b /= 1024;
  while (i < u.length - 1 && (i > 0 && b < 9.95 ? +b.toFixed(1) : two(b)) >= 1000) { b /= 1024; i++; }
  return (i > 0 && b < 9.95 ? b.toFixed(1) : String(two(b))) + u[i];
}

/** Lit cells of a 10-cell gauge for a 0..1 fraction (null → 0). */
export function cells(frac, n = 10) {
  return frac == null ? 0 : Math.max(0, Math.min(n, Math.round(frac * n)));
}

/**
 * Everything the host rows show, already formatted: the view draws exactly these, and their JSON is
 * the redraw key (a tick that leaves them unchanged doesn't notify).
 */
export function hostFields(s) {
  const cpu = s?.cpu, mem = s?.mem, load = s?.load, net = s?.net;
  return {
    cpu: cpu == null ? "--" : `${Math.round(cpu * 100)}%`,
    cpuK: cells(cpu),
    mem: fmtMem(mem),
    memK: cells(mem && mem.total ? mem.used / mem.total : null),
    load: load ? load[0].toFixed(2) : "--",
    loadK: cells(load && s?.ncpu ? load[0] / s.ncpu : null),
    load515: load ? `${load[1].toFixed(2)} ${load[2].toFixed(2)}` : "--",
    rx: net ? fmtRate(net.rx) : "--",
    tx: net ? fmtRate(net.tx) : "--",
    up: fmtUptime(s?.up),
  };
}

/** Memory "18.4/62G". */
export function fmtMem(m) {
  if (!m) return "--";
  const g = (x) => x / 1024 ** 3;
  const used = g(m.used), total = g(m.total);
  return `${used < 100 ? used.toFixed(1) : Math.round(used)}/${Math.round(total)}G`;
}

/** Uptime seconds → "3d 07:12" / "07:12". */
export function fmtUptime(s) {
  if (s == null) return "--";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hm}` : hm;
}

/** Split the combined output of the exec fallback ("@@<path>" separators) into {path: text}. */
export function splitDump(out) {
  const res = {};
  let cur = null;
  for (const l of (out ?? "").split("\n")) {
    const m = l.match(/^@@(\/proc\/\S+)$/);
    if (m) { cur = m[1]; res[cur] = ""; }
    else if (cur) res[cur] += l + "\n";
  }
  return res;
}

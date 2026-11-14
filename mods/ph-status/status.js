// ph-status's pure helpers. No imports, so tests/ph-status.test.mjs runs them under plain node.

/** `git status --porcelain=v2 --branch` → { branch, ahead, behind, dirty } (dirty = changed paths). */
export function parseGitStatus(out) {
  const r = { branch: null, ahead: 0, behind: 0, dirty: 0 };
  for (const line of String(out ?? "").split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      const b = line.slice(14).trim();
      r.branch = b === "(detached)" ? null : b;
    } else if (line.startsWith("# branch.ab ")) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) { r.ahead = +m[1]; r.behind = +m[2]; }
    } else if (!line.startsWith("#")) r.dirty++;
  }
  return r;
}

/** "/home/op/repos/x" → "~/repos/x" (also /Users/<u>, /root). */
export function shortPath(cwd, home) {
  if (!cwd) return "";
  const s = String(cwd);
  const h = home ? String(home).replace(/\/+$/, "") : "";
  if (h && (s === h || s.startsWith(`${h}/`))) return `~${s.slice(h.length)}`;
  return s.replace(/^(\/home\/[^/]+|\/Users\/[^/]+|\/root)(?=\/|$)/, "~");
}

/** Per-status counts of agents: { blocked, done, working, idle }. */
export function counts(list) {
  const c = { blocked: 0, done: 0, working: 0, idle: 0 };
  for (const a of Array.isArray(list) ? list : []) if (a && a.status in c) c[a.status]++;
  return c;
}

/** "HH:MM", 24 h, local time. */
export function clock(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ms until the next whole minute (at least 1 s, so a timer never fires twice in one minute). */
export function msToNextMinute(d) {
  return Math.max(1000, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
}

/** The git suffix for the status line: "↑2 ↓1 +3" (empty parts dropped). */
export function gitSuffix(g) {
  if (!g) return "";
  return [g.ahead ? `↑${g.ahead}` : "", g.behind ? `↓${g.behind}` : "", g.dirty ? `+${g.dirty}` : ""].filter(Boolean).join(" ");
}

export const GIT_STALE_LOCAL_MS = 15000;
export const GIT_STALE_REMOTE_MS = 60000;

/** The cache key of a git read: machine + cwd (null when there is no cwd). */
export function gitKeyOf(w) {
  return w?.cwd ? `${w.machine ?? ""}|${w.cwd}` : null;
}

/**
 * Whether to start a git read now. st = { key, at, busy, errKey }: the key and time of the last read
 * started, a read in flight, and the key whose last read failed (no retry until the cwd changes).
 * Re-reads after 15 s locally, 60 s on another machine.
 */
export function needGit(st, key, now, remote) {
  if (!key || st.busy) return false;
  if (key === st.errKey) return false;
  if (key !== st.key) return true;
  return now - st.at > (remote ? GIT_STALE_REMOTE_MS : GIT_STALE_LOCAL_MS);
}

/**
 * The key bound to an action, from keys(): the first binding in `section`, else in any section,
 * else `fallback`. A key string ending in "--" (the minus key) is kept as is.
 */
export function keyFor(list, action, section, fallback) {
  const bs = (Array.isArray(list) ? list : []).filter((b) => b && b.action === action && b.keys);
  const b = bs.find((x) => x.section === section) ?? bs[0];
  return b ? String(b.keys) : fallback;
}

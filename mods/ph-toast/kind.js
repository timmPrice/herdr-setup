// ph-toast's pure helpers: which kind a toast is, Herdr's machine-login body, and which agent a
// Herdr agent toast is about. No imports, so tests/ph-toast-kind.test.mjs runs it under plain node.
// (Ported from nk-toast/kind.js on meeseeks/neo-kyoto, reviewed: suffix first, then levels' words.)

// Herdr's own agent toasts are "<name> needs you" / "<name> finished", where <name> is whatever
// the person called the terminal or agent (or the program's name); so the suffix decides, not
// words inside the name ("release-ready needs you" is a warning).
const HERDR_WARN_RE = / needs you$/i;
const HERDR_DONE_RE = / finished$/i;
// General words, for everyone else's notify(). Warnings are checked first.
const WARN_RE = /\b(needs?|blocked|waiting|fail(ed|s|ure)?|errors?|denied|stuck|attention)\b/i;
const DONE_RE = /\b(finished|done|complete(d)?|succeeded)\b/i;

// Herdr's body when a machine's login has run out (same regex as the shipped toast).
const LOGIN_RE = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/;

/** The machine name when the body is Herdr's "needs login" text, else null. */
export function loginMachine(body) {
  const m = LOGIN_RE.exec(body ?? "");
  return m ? m[1] : null;
}

/** "done" ([ OK ]) | "warn" ([WAIT]/[WARN]) | "info" (plain) for a toast's props. */
export function kindOf(p) {
  const title = String(p?.title ?? "").trim();
  const body = String(p?.body ?? "");
  if (p?.level === "error" || p?.level === "warning") return "warn";
  if (p?.level === "success") return "done";
  if (HERDR_WARN_RE.test(title)) return "warn";
  if (HERDR_DONE_RE.test(title)) return "done";
  if (loginMachine(body)) return "warn";
  if (WARN_RE.test(`${title} ${body}`)) return "warn";
  if (DONE_RE.test(title)) return "done";
  return "info";
}

/** Herdr's agent toast: { name, event: "wait" | "done" } from "<name> needs you|finished", else null. */
export function agentEvent(title) {
  const t = String(title ?? "").trim();
  let m = /^(.+) needs you$/i.exec(t);
  if (m) return { name: m[1].trim(), event: "wait" };
  m = /^(.+) finished$/i.exec(t);
  if (m) return { name: m[1].trim(), event: "done" };
  return null;
}

/**
 * The agent a toast is about, or null.
 * 1. the action's args name it (terminal / agent / address / pane);
 * 2. else the title's <name> matches a terminal's name (hc ls "name"), the agent's program name,
 *    its app or its address; among several, the one whose status fits the event, then the newest (seq).
 * agents: herdr agents(); terms: herdr terminals() (address, name, ...).
 */
export function findAgent(p, agents = [], terms = []) {
  const list = Array.isArray(agents) ? agents : [];
  const a = p?.action?.args ?? {};
  for (const k of ["terminal", "agent", "address"]) {
    const v = a[k];
    if (typeof v === "string") { const hit = list.find((x) => x.address === v); if (hit) return hit; }
  }
  if (typeof a.pane === "string") { const hit = list.find((x) => x.pane === a.pane); if (hit) return hit; }
  const ev = agentEvent(p?.title);
  if (!ev) return null;
  const want = ev.name.toLowerCase();
  const named = new Set((Array.isArray(terms) ? terms : [])
    .filter((t) => String(t?.name ?? "").toLowerCase() === want).map((t) => t.address));
  const hits = list.filter((x) => named.has(x.address)
    || [x.program?.name, x.program?.key, x.app, x.address].some((s) => String(s ?? "").toLowerCase() === want));
  if (!hits.length) return null;
  const fit = ev.event === "wait" ? "blocked" : "done";
  hits.sort((x, y) => ((y.status === fit) - (x.status === fit)) || ((y.seq ?? 0) - (x.seq ?? 0)));
  return hits[0];
}

/** Short program word for "<agent>@<addr>.service": claude, codex, opencode, ... */
export function agentWord(agent, fallback = "agent") {
  const s = agent?.program?.key && agent.program.key !== "agent" && agent.program.key !== "program"
    ? agent.program.key : agent?.app ?? agent?.program?.name ?? fallback;
  return String(s).toLowerCase().replace(/-code$/, "").replace(/\s+/g, "-");
}

// Which seal a toast gets, and Herdr's machine-login body. No imports, so
// tools/kind.test.mjs can run it under plain node.

// Herdr's own agent toasts are "<name> needs you" / "<name> finished", where
// <name> is whatever the person called the terminal or agent; so the suffix
// decides, not words inside the name ("release-ready needs you" is a warning).
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

/** "done" (完了) | "warn" (警告) | "info" (通知) for a toast's props. */
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

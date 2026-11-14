import test from "node:test";
import assert from "node:assert/strict";
import { parseGitStatus, shortPath, counts, clock, msToNextMinute, gitSuffix, gitKeyOf, needGit, keyFor, GIT_STALE_LOCAL_MS, GIT_STALE_REMOTE_MS } from "../mods/ph-status/status.js";

test("git porcelain v2", () => {
  const out = [
    "# branch.oid 58e117a", "# branch.head main", "# branch.upstream origin/main", "# branch.ab +2 -1",
    "1 .M N... 100644 100644 100644 a b README.md", "? new.txt", "? other.txt", "",
  ].join("\n");
  assert.deepEqual(parseGitStatus(out), { branch: "main", ahead: 2, behind: 1, dirty: 3 });
  assert.deepEqual(parseGitStatus("# branch.head (detached)\n"), { branch: null, ahead: 0, behind: 0, dirty: 0 });
  assert.deepEqual(parseGitStatus(""), { branch: null, ahead: 0, behind: 0, dirty: 0 });
  assert.equal(gitSuffix({ ahead: 2, behind: 0, dirty: 3 }), "↑2 +3");
  assert.equal(gitSuffix({ ahead: 0, behind: 0, dirty: 0 }), "");
  assert.equal(gitSuffix(null), "");
});

test("short path", () => {
  assert.equal(shortPath("/home/op/repos/x"), "~/repos/x");
  assert.equal(shortPath("/home/op"), "~");
  assert.equal(shortPath("/homework/x"), "/homework/x");
  assert.equal(shortPath("/Users/me/a"), "~/a");
  assert.equal(shortPath(null), "");
  assert.equal(shortPath("/srv/u/x", "/srv/u"), "~/x");
  assert.equal(shortPath("/srv/u", "/srv/u/"), "~");
  assert.equal(shortPath("/srv/ux", "/srv/u"), "/srv/ux");
});

test("counts and clock", () => {
  assert.deepEqual(counts([{ status: "blocked" }, { status: "working" }, { status: "working" }, { status: "x" }, null]),
    { blocked: 1, done: 0, working: 2, idle: 0 });
  assert.deepEqual(counts(undefined), { blocked: 0, done: 0, working: 0, idle: 0 });
  assert.equal(clock(new Date(2026, 10, 14, 7, 5, 59)), "07:05");
  const ms = msToNextMinute(new Date(2026, 10, 14, 7, 5, 30, 0));
  assert.ok(ms > 30000 && ms < 30200);
  assert.ok(msToNextMinute(new Date(2026, 10, 14, 7, 5, 59, 999)) >= 1000);
});

test("git read policy", () => {
  const st = { key: "|/a", at: 1000, busy: false, errKey: null };
  assert.equal(gitKeyOf({ cwd: "/a", machine: null }), "|/a");
  assert.equal(gitKeyOf({ cwd: "/a", machine: "box" }), "box|/a");
  assert.equal(gitKeyOf({ cwd: null }), null);
  assert.equal(gitKeyOf(null), null);
  assert.equal(needGit(st, null, 5000, false), false);
  assert.equal(needGit(st, "|/a", 5000, false), false);                        // fresh
  assert.equal(needGit(st, "|/a", 1000 + GIT_STALE_LOCAL_MS + 1, false), true); // stale locally
  assert.equal(needGit({ ...st, key: "m|/a" }, "m|/a", 1000 + GIT_STALE_LOCAL_MS + 1, true), false);
  assert.equal(needGit({ ...st, key: "m|/a" }, "m|/a", 1000 + GIT_STALE_REMOTE_MS + 1, true), true);
  assert.equal(needGit(st, "|/b", 1001, false), true);                          // cwd changed
  assert.equal(needGit({ ...st, busy: true }, "|/b", 1001, false), false);      // in flight: wait, re-check after
  assert.equal(needGit({ ...st, errKey: "|/a" }, "|/a", 1e9, false), false);    // failed: no retry...
  assert.equal(needGit({ ...st, errKey: "|/a" }, "|/b", 1e9, false), true);     // ...until the cwd changes
  assert.equal(needGit({ ...st, key: "|/b", errKey: "|/a" }, "|/a", 1e9, false), false);
});

test("key hints from keys()", () => {
  const ks = [
    { section: "global", keys: "ctrl-shift-p", action: "app.palette" },
    { section: "layout:other", keys: "alt-r", action: "ph-kit.respond" },
    { section: "layout:phosphor", keys: "ctrl-alt-u", action: "ph-kit.respond" },
  ];
  assert.equal(keyFor(ks, "app.palette", "global", "x"), "ctrl-shift-p");
  assert.equal(keyFor(ks, "ph-kit.respond", "layout:phosphor", "x"), "ctrl-alt-u");
  assert.equal(keyFor(ks.slice(0, 2), "ph-kit.respond", "layout:phosphor", "x"), "alt-r");
  assert.equal(keyFor([], "app.palette", "global", "ctrl-shift-p"), "ctrl-shift-p");
  assert.equal(keyFor(undefined, "app.palette", "global", "f"), "f");
});

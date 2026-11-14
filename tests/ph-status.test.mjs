import test from "node:test";
import assert from "node:assert/strict";
import { parseGitStatus, shortPath, counts, clock, msToNextMinute, gitSuffix } from "../mods/ph-status/status.js";

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

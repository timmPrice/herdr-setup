import test from "node:test";
import assert from "node:assert/strict";
import { summary, alertText, respondKey, clockText, uplink } from "../mods/ph-title/text.js";
import { Since, oldestBlocked } from "../mods/ph-title/lib/since.js";
import { tabLabel, estWidth } from "../mods/ph-tabs/text.js";

const A = (address, status, seq, extra = {}) => ({ address, status, seq, ...extra });

test("summary counts non-zero states in RUN WAIT OK IDLE order", () => {
  const s = summary([A("a", "idle", 1), A("b", "working", 2), A("c", "done", 3), A("d", "working", 4)]);
  assert.equal(s.total, "4 daemons");
  assert.deepEqual(s.parts, [{ key: "working", n: 2 }, { key: "done", n: 1 }, { key: "idle", n: 1 }]);
  assert.equal(summary([]).total, "0 daemons");
  assert.equal(summary([A("a", "idle", 1)]).total, "1 daemon");
});

test("alert names the given target and pluralises", () => {
  const b = [A("t9z", "blocked", 9, { app: "claude" }), A("t2k", "blocked", 2, { program: { name: "codex" }, space_name: "api-gateway", title: "rotate keys" })];
  const t = alertText(b, "ctrl-shift-u", b[1]);
  assert.equal(t.head, "2 DAEMONS NEED YOU");
  assert.equal(t.who, "codex@t2k");
  assert.equal(t.what, "· api-gateway · rotate keys");
  assert.equal(alertText([b[0]]).head, "1 DAEMON NEEDS YOU");
  assert.equal(alertText([b[0]]).who, "claude@t9z");
});

test("alert names the agent ph-kit.respond focuses, even when seq order disagrees", () => {
  // A blocked first (t=1000), B later (t=2000); then A's title changes, so A.seq > B.seq.
  const since = new Since();
  since.observe([A("tA", "working", 1), A("tB", "working", 2)], 0);
  since.observe([A("tA", "blocked", 3), A("tB", "working", 2)], 1000);
  since.observe([A("tA", "blocked", 3), A("tB", "blocked", 4)], 2000);
  const list = [A("tA", "blocked", 9, { app: "claude" }), A("tB", "blocked", 4, { app: "codex" })];
  const target = oldestBlocked(list, since, 3000);
  assert.equal(target.address, "tA"); // what ph-kit.respond focuses
  assert.equal(alertText(list.filter((a) => a.status === "blocked"), "ctrl-shift-u", target).who, "claude@tA");
});

test("respond key from keys(), layout section first", () => {
  assert.equal(respondKey([]), "ctrl-shift-u");
  assert.equal(respondKey([{ section: "global", keys: "ctrl-shift-y", action: "ph-kit.respond" },
    { section: "layout:phosphor", keys: "ctrl-shift-u", action: "ph-kit.respond" }]), "ctrl-shift-u");
  assert.equal(respondKey([{ section: "global", keys: "f9", action: "ph-kit.respond" }]), "f9");
});

test("clock and uplink", () => {
  const d = new Date(2026, 10, 13, 7, 4, 9);
  assert.equal(clockText(d), "07:04:09");
  assert.equal(clockText(d, true), "07:04");
  assert.deepEqual(uplink([{ name: null, layout: "ready" }]), { ok: true, label: "OK" });
  assert.deepEqual(uplink([{ name: null, layout: "ready" }, { name: "box", layout: "unavailable" }]), { ok: false, label: "1 DOWN" });
  assert.equal(uplink([{ name: null, layout: "loading" }]).label, "SYNC");
});

test("tab labels", () => {
  assert.equal(tabLabel({ index: 1, name: "build", named: true }), "1:build");
  assert.equal(tabLabel({ index: 2, name: "2", named: false }, "claude"), "2:claude");
  assert.equal(tabLabel({ index: 3, name: "3", named: false }), "3:sh");
  assert.ok(estWidth("1:build", { active: true, status: "blocked" }) > estWidth("1:build", {}));
});

import test from "node:test";
import assert from "node:assert/strict";
import { summary, alertText, respondKey, clockText, uplink, oldest } from "../mods/ph-title/text.js";
import { tabLabel, estWidth } from "../mods/ph-tabs/text.js";

const A = (address, status, seq, extra = {}) => ({ address, status, seq, ...extra });

test("summary counts non-zero states in RUN WAIT OK IDLE order", () => {
  const s = summary([A("a", "idle", 1), A("b", "working", 2), A("c", "done", 3), A("d", "working", 4)]);
  assert.equal(s.total, "4 daemons");
  assert.deepEqual(s.parts, [{ key: "working", n: 2 }, { key: "done", n: 1 }, { key: "idle", n: 1 }]);
  assert.equal(summary([]).total, "0 daemons");
  assert.equal(summary([A("a", "idle", 1)]).total, "1 daemon");
});

test("alert names the oldest blocked agent and pluralises", () => {
  const b = [A("t9z", "blocked", 9, { app: "claude" }), A("t2k", "blocked", 2, { program: { name: "codex" }, space_name: "api-gateway", title: "rotate keys" })];
  assert.equal(oldest(b).address, "t2k");
  const t = alertText(b, "ctrl-shift-u");
  assert.equal(t.head, "2 DAEMONS NEED YOU");
  assert.equal(t.who, "codex@t2k");
  assert.equal(t.what, "· api-gateway · rotate keys");
  assert.equal(alertText([b[0]]).head, "1 DAEMON NEEDS YOU");
  assert.equal(alertText([b[0]]).who, "claude@t9z");
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

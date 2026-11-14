// ph-side pure helpers (mods/ph-side/model.js).
import test from "node:test";
import assert from "node:assert/strict";
import { Since } from "../lib/since.js";
import {
  isCompact, pad2, fmtClock, progName, barLevel, pipsBySpace, fitPips, homeNode, ordered, clockKey, gitBits,
} from "../mods/ph-side/model.js";

test("compact rail below 160 px", () => {
  assert.equal(isCompact(159), true);
  assert.equal(isCompact(160), false);
  assert.equal(isCompact(0), false); // not measured yet: full layout
  assert.equal(pad2(3), "03");
  assert.equal(pad2(undefined), "00");
});

test("clock readout", () => {
  assert.equal(fmtClock(41_000), "00:41");
  assert.equal(fmtClock(27 * 60_000 + 5_000), "27:05");
  assert.equal(fmtClock(-5), "00:00");
  assert.equal(fmtClock(3_840_000), "1h04m");
});

test("program names", () => {
  assert.equal(progName({ program: { key: "codex" } }), "codex");
  assert.equal(progName({ program: { key: "agent" }, app: "Claude Code" }), "claude");
  assert.equal(progName({ app: "gemini-cli" }), "gemini");
  assert.equal(progName({}), "agent");
});

test("bars, pips, order", () => {
  assert.equal(barLevel("idle"), 0);
  assert.equal(barLevel("working"), 3);
  assert.equal(barLevel(null), 1);
  const list = [
    { address: "a", status: "idle", space: "s1", seq: 0 },
    { address: "b", status: "blocked", space: "s1", seq: 1 },
    { address: "c", status: "working", space: "s2", seq: 2 },
    { address: "d", status: "done", space: null, seq: 3 },
  ];
  const m = pipsBySpace(list);
  assert.deepEqual(m.get("s1"), ["blocked", "idle"]);
  assert.deepEqual(m.get("s2"), ["working"]);
  assert.equal(m.size, 2);
  assert.deepEqual(ordered(list).map((a) => a.address), ["b", "d", "c", "a"]);
  assert.deepEqual(ordered(null), []);
  assert.deepEqual(fitPips(["x", "y", "z"], 3), { shown: ["x", "y", "z"], more: 0 });
  assert.deepEqual(fitPips(["x", "y", "z", "w"], 3), { shown: ["x", "y"], more: 2 });
  assert.deepEqual(fitPips(["x"], 0), { shown: [], more: 1 });
});

test("home node, git bits, clock key", () => {
  const sp = [{ id: "s1", index: 1, name: "herdr" }];
  assert.equal(homeNode({ space: "s1", space_name: "herdr" }, sp), "01·herdr");
  assert.equal(homeNode({ space: "zz", space_name: "far" }, sp), "far");
  assert.deepEqual(gitBits("main", { ahead: 2, behind: 0 }).map((b) => b.text), ["main", "↑2"]);
  assert.deepEqual(gitBits(null, { ahead: 0, behind: 4 }).map((b) => b.text), ["↓4"]);
  const s = new Since();
  s.observe([{ address: "t1", status: "working" }], 0);
  assert.equal(clockKey([{ address: "t1" }], s, 61_000), "01:01");
});

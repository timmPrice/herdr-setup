import test from "node:test";
import assert from "node:assert/strict";
import { P, STATES, stateOf, byUrgency, alpha, statusTag } from "../lib/palette.js";
import { cutPoints, glowLayers } from "../lib/geom.js";
import { Since, fmtDur, tabSeed, oldestBlocked } from "../lib/since.js";
import { resolveIntensity, intensity, cursor, bars } from "../lib/motion.js";
import { state } from "./stubs/herdr.mjs";

test("palette meanings", () => {
  assert.equal(P.amber, "#fabd2f");
  assert.equal(stateOf("blocked").color, "#fb4934");
  assert.equal(stateOf(null).key, "shell");
  assert.equal(statusTag("working"), "[ RUN ]");
  assert.equal(alpha("#fabd2f", 0.5), "#fabd2f80");
  assert.equal(alpha("#fabd2f", 0x18), "#fabd2f18");
  const sorted = ["idle", "working", "blocked", "done", null].map((status, seq) => ({ status, seq })).sort(byUrgency);
  assert.deepEqual(sorted.map((a) => a.status), ["blocked", "done", "working", "idle", null]);
  assert.ok(Object.values(STATES).every((s) => s.kanji.length === 2));
});

test("cut corners", () => {
  assert.deepEqual(cutPoints(40, 20, 6), [[0, 6], [6, 0], [40, 0], [40, 14], [34, 20], [0, 20]]);
  assert.equal(cutPoints(10, 4, 6, "tl tr br bl").length, 8);
  assert.deepEqual(cutPoints(10, 10, 0), [[0, 0], [10, 0], [10, 10], [0, 10]]);
  assert.equal(glowLayers(true).length, 1);
  assert.equal(glowLayers(false).at(-1).width, 1);
});

test("since tracker", () => {
  const s = new Since();
  assert.ok(s.observe([{ address: "t1", status: "working" }], 1000));
  assert.equal(s.elapsed("t1", 4000), 3000);
  assert.ok(!s.observe([{ address: "t1", status: "working" }], 5000));
  assert.ok(s.observe([{ address: "t1", status: "blocked" }], 6000));
  assert.equal(s.since("t1"), 6000);
  const r = Since.load(s.dump());
  assert.equal(r.since("t1"), 6000);
  assert.ok(r.observe([], 7000));
  assert.equal(r.since("t1"), null);
  assert.equal(Since.load("garbage").since("x"), null);
});

test("since seed from tabs", () => {
  const seed = tabSeed([{ tabs: [{ id: "tb1", status: "working", changed_at: 500 }] }]);
  const s = new Since();
  s.observe([{ address: "t1", tab: "tb1", status: "working" }, { address: "t2", tab: "tb1", status: "idle" }], 2_000_000_000_000, seed);
  assert.equal(s.since("t1"), 500_000);      // seconds → ms
  assert.equal(s.since("t2"), 2_000_000_000_000); // status differs → now
});

test("oldest blocked", () => {
  const s = new Since();
  s.observe([{ address: "a", status: "blocked" }], 10);
  s.observe([{ address: "a", status: "blocked" }, { address: "b", status: "blocked" }], 5_000);
  const list = [{ address: "b", status: "blocked", seq: 1 }, { address: "a", status: "blocked", seq: 2 }, { address: "c", status: "working" }];
  assert.equal(oldestBlocked(list, s, 6000).address, "a");
  assert.equal(oldestBlocked(list, null).address, "b");
  assert.equal(oldestBlocked([{ address: "c", status: "idle" }]), null);
});

test("durations", () => {
  assert.equal(fmtDur(4_000), "4s");
  assert.equal(fmtDur(192_000), "3m12s");
  assert.equal(fmtDur(3_840_000), "1h04m");
  assert.equal(fmtDur(183_600_000), "2d03h");
});

test("intensity", () => {
  assert.equal(resolveIntensity(undefined, undefined), "full");
  assert.equal(resolveIntensity("calm", "full"), "calm");
  assert.equal(resolveIntensity("bogus", "calm"), "calm");
  state.props = {}; state.shared = { "ph.intensity": "calm" };
  assert.equal(intensity(), "calm");
  const c = cursor(true);
  assert.ok(c.calls.some(([k]) => k === "child"), "calm cursor is solid");
  state.shared = {};
  assert.ok(cursor(true).calls.some(([k]) => k === "frames"), "full cursor blinks");
  assert.ok(!JSON.stringify(bars(3, "#fff", { on: true, calm: true }).calls).includes("loop"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { P, STATES, stateOf, byUrgency, alpha, statusTag } from "../lib/palette.js";
import { cutPoints, glowLayers } from "../lib/geom.js";
import { Since, fmtDur, tabSeed, oldestBlocked } from "../lib/since.js";
import { resolveIntensity, intensityCommand, intensity, cursor, bars } from "../lib/motion.js";
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
  assert.ok(!r.observe([], 7000));            // absent once: kept, nothing to persist
  assert.equal(r.since("t1"), 6000);
  assert.equal(Since.load("garbage").since("x"), null);
});

test("since survives a restart with an empty first render", () => {
  const H = 3600_000, DAY = 24 * H;
  const s = new Since();
  s.observe([{ address: "t1", status: "blocked" }, { address: "t2", status: "working" }], 1_000_000);
  const saved = s.dump();
  const r = Since.load(saved);                       // restart 1 h later
  assert.equal(r.observe([], 1_000_000 + H), false);
  assert.equal(r.observe([], 1_000_000 + H), false);
  assert.equal(r.dump(), saved);                     // empty renders change nothing
  r.observe([{ address: "t1", status: "blocked" }], 1_000_000 + H);
  assert.equal(r.elapsed("t1", 1_000_000 + H), H);   // clock carried over
  assert.equal(r.since("t2"), 1_000_000);            // absent t2 still remembered
  // 31 days later a change elsewhere prunes the long-absent t2, keeps listed t1
  r.observe([{ address: "t1", status: "working" }], 1_000_000 + 31 * DAY);
  assert.equal(r.since("t2"), null);
  assert.equal(r.since("t1"), 1_000_000 + 31 * DAY);
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
  assert.equal(resolveIntensity(undefined), "full");
  assert.equal(resolveIntensity("calm"), "calm");
  assert.equal(resolveIntensity("bogus"), "full");
  state.props = {}; state.shared = { "ph.intensity": "calm" };
  assert.equal(intensity(), "calm");
  // A stale layout prop no longer counts: shared is the only source.
  state.props = { intensity: "calm" }; state.shared = { "ph.intensity": "full" };
  assert.equal(intensity(), "full");
  state.props = {}; state.shared = { "ph.intensity": "calm" };
  const c = cursor(true);
  assert.ok(c.calls.some(([k]) => k === "child"), "calm cursor is solid");
  state.shared = {};
  assert.ok(cursor(true).calls.some(([k]) => k === "frames"), "full cursor blinks");
  assert.ok(!JSON.stringify(bars(3, "#fff", { on: true, calm: true }).calls).includes("loop"));
});

test("intensity commands", () => {
  assert.equal(intensityCommand("calm", "full"), "calm");
  assert.equal(intensityCommand("full", "calm"), "full");
  assert.equal(intensityCommand("toggle", "full"), "calm");
  assert.equal(intensityCommand("toggle", "calm"), "full");
  assert.equal(intensityCommand("toggle", undefined), "calm");
  assert.equal(intensityCommand("intensity", "calm"), "full");
  assert.equal(intensityCommand("intensity:calm", "calm"), "calm");
  assert.equal(intensityCommand("intensity.full", "calm"), "full");
  assert.equal(intensityCommand("respond", "full"), null);
  assert.equal(intensityCommand("focus", "full"), null);
  assert.equal(intensityCommand(undefined, "full"), null);
});

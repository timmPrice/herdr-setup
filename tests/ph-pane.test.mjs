import test from "node:test";
import assert from "node:assert/strict";
import { paneFrame, fmtMin, motionPlan, pickRespondKey, RESPOND_FALLBACK } from "../mods/ph-pane/fmt.js";

test("ph-pane time-in-state at minute resolution", () => {
  assert.equal(fmtMin(0), "<1m");
  assert.equal(fmtMin(59_999), "<1m");
  assert.equal(fmtMin(60_000), "1m");
  assert.equal(fmtMin(3 * 60_000 + 59_000), "3m");
  assert.equal(fmtMin(59 * 60_000), "59m");
  assert.equal(fmtMin(64 * 60_000), "1h04m");
  assert.equal(fmtMin(23 * 3_600_000 + 59 * 60_000), "23h59m");
  assert.equal(fmtMin(51 * 3_600_000), "2d03h");
  assert.equal(fmtMin(-5), "<1m");
  assert.equal(fmtMin(undefined), "<1m");
  assert.equal(fmtMin(NaN), "<1m");
  for (const ms of [0, 61_000, 3_852_000, 51 * 3_600_000 + 1234]) assert.doesNotMatch(fmtMin(ms), /:|s$/);
});

test("ph-pane motion: only the focused pane of the shown tab ticks or moves", () => {
  const off = { timer: false, bars: false, blink: false };
  const pick = (o) => ({ timer: o.timer, bars: o.bars, blink: o.blink });
  // focused RUN on screen: per-minute timer + bars
  assert.deepEqual(pick(motionPlan({ state: "working", focused: true, shownTab: true })), { timer: true, bars: true, blink: false });
  // focused WAIT on screen: timer + stripe blink
  assert.deepEqual(pick(motionPlan({ state: "blocked", focused: true, shownTab: true })), { timer: true, bars: false, blink: true });
  // calm: minute timer still runs on the focused busy pane, but no loops
  assert.deepEqual(pick(motionPlan({ state: "working", focused: true, shownTab: true, calm: true })), { timer: true, bars: false, blink: false });
  assert.deepEqual(pick(motionPlan({ state: "blocked", focused: true, shownTab: true, calm: true })), { timer: true, bars: false, blink: false });
  // unfocused panes and hidden tabs: nothing
  for (const state of ["working", "blocked", "done", "idle", "shell", "mod"]) {
    assert.deepEqual(pick(motionPlan({ state, focused: false, shownTab: true })), off, `unfocused ${state}`);
    assert.deepEqual(pick(motionPlan({ state, focused: true, shownTab: false })), off, `hidden tab ${state}`);
  }
  // idle states never tick, even focused
  for (const state of ["done", "idle", "shell", "mod"]) assert.deepEqual(pick(motionPlan({ state, focused: true, shownTab: true })), off, state);
  assert.deepEqual(pick(motionPlan()), off);
});

test("ph-pane header position from the layout tree", () => {
  const frame = (position) => ({ tab: true, pane: { header: { position, height: 26 } } });
  assert.equal(paneFrame({ type: "row", children: [{ content: { mod: "ph-side" } }, { content: frame("bottom") }] })?.header?.position, "bottom");
  assert.equal(paneFrame({ content: frame("top") }).header.position, "top");
  // stacks: the active visible child wins; hidden nodes are skipped
  const stack = { type: "stack", active: "b", children: [{ id: "a", content: frame("top") }, { id: "b", content: frame("bottom") }] };
  assert.equal(paneFrame(stack).header.position, "bottom");
  assert.equal(paneFrame({ children: [{ hidden: true, content: frame("bottom") }, { content: frame("top") }] }).header.position, "top");
  assert.equal(paneFrame(null), null);
  assert.equal(paneFrame({ children: [{ content: { mod: "x" } }] }), null);
});

test("ph-pane respond key", () => {
  assert.equal(pickRespondKey([]), RESPOND_FALLBACK);
  assert.equal(pickRespondKey(undefined), "ctrl-shift-u");
  const ks = [
    { action: "ph-kit.respond", section: "global", keys: "ctrl-j" },
    { action: "ph-kit.respond", section: "layout:phosphor", keys: "ctrl-shift-u" },
    { action: "pane.close", section: "layout:phosphor", keys: "ctrl-w" },
  ];
  assert.equal(pickRespondKey(ks), "ctrl-shift-u");
  assert.equal(pickRespondKey(ks.slice(0, 1)), "ctrl-j");
  assert.equal(pickRespondKey([{ action: "ph-kit.respond", section: "layout:x", keys: "f9" }]), "f9");
});

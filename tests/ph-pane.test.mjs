import test from "node:test";
import assert from "node:assert/strict";
import { paneFrame, fmtLive, fmtCoarse, pickRespondKey, RESPOND_FALLBACK } from "../mods/ph-pane/fmt.js";

test("ph-pane live time-in-state", () => {
  assert.equal(fmtLive(0), "00:00");
  assert.equal(fmtLive(252_000), "04:12");
  assert.equal(fmtLive(3_852_000), "1h04:12");
  assert.equal(fmtLive((2 * 24 + 3) * 3_600_000), "2d03h");
  assert.equal(fmtLive(-5), "00:00");
  assert.equal(fmtLive(undefined), "00:00");
});

test("ph-pane coarse time-in-state (no seconds, so idle/calm stays still)", () => {
  assert.equal(fmtCoarse(59_999), "00m");
  assert.equal(fmtCoarse(27 * 60_000 + 5_000), "27m");
  assert.equal(fmtCoarse(64 * 60_000), "1h04m");
  assert.equal(fmtCoarse(51 * 3_600_000), "2d03h");
  assert.doesNotMatch(fmtCoarse(3_600_000 * 5 + 1234), /:/);
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

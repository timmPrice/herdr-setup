// Stability tests for nk-sakura's agent → anchor mapping. Run: node mods/nk-sakura/tools/assign.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANCHORS, LIMBS, assign, newState } from "../assign.js";

const ag = (address, space) => ({ address, space, status: "idle" });
// address → anchor index
const map = (used) => Object.fromEntries(used.flatMap((a, i) => (a ? [[a.address, i]] : [])));
const limbOfAnchor = (i) => ANCHORS[i][2];

// The reviewer's scenario: s1 {t1}, s2 {t2, t3}, s3 {t4}.
const BASE = [ag("t1", "s1"), ag("t2", "s2"), ag("t3", "s2"), ag("t4", "s3")];

test("same data twice gives the same mapping", () => {
  const st = newState();
  const a = map(assign(BASE, st));
  assert.deepEqual(map(assign(BASE, st)), a);
  assert.deepEqual(st.limbOf, { s1: 0, s2: 1, s3: 2 });
});

test("a space empties: other spaces keep their limbs and anchors", () => {
  const st = newState();
  const before = map(assign(BASE, st));
  const after = map(assign(BASE.filter((a) => a.address !== "t1"), st));
  assert.equal(after.t1, undefined);
  for (const k of ["t2", "t3", "t4"]) assert.equal(after[k], before[k], k);
  assert.deepEqual(st.limbOf, { s2: 1, s3: 2 });
  assert.deepEqual(Object.keys(st.slotOf).sort(), ["t2", "t3", "t4"]);
});

test("a sibling exits: the next sibling keeps its anchor", () => {
  const st = newState();
  const before = map(assign(BASE, st));
  const after = map(assign(BASE.filter((a) => a.address !== "t2"), st));
  assert.equal(after.t3, before.t3);
  assert.equal(after.t1, before.t1);
  assert.equal(after.t4, before.t4);
});

test("a newcomer gets the lowest free anchor/limb and moves no one", () => {
  const st = newState();
  const before = map(assign(BASE, st));
  // t1 and s1 gone, then a new space s4 and a new s2 agent appear first in agents() order.
  assign(BASE.filter((a) => a.address !== "t1"), st);
  const list = [ag("n1", "s4"), ag("n2", "s2"), ...BASE.filter((a) => a.address !== "t1")];
  const after = map(assign(list, st));
  for (const k of ["t2", "t3", "t4"]) assert.equal(after[k], before[k], k);
  assert.equal(st.limbOf.s4, 0, "new space takes the freed limb 0");
  assert.equal(after.n1, before.t1, "and the lowest free anchor on it");
  assert.equal(limbOfAnchor(after.n2), 1);
  assert.equal(after.n2, before.t3 + 1, "lowest free anchor on s2's limb");
});

test("a freed anchor goes to the next newcomer (lowest free)", () => {
  const st = newState();
  const before = map(assign(BASE, st));
  assign(BASE.filter((a) => a.address !== "t2"), st);
  const after = map(assign([...BASE.filter((a) => a.address !== "t2"), ag("t9", "s2")], st));
  assert.equal(after.t9, before.t2);
  assert.equal(after.t3, before.t3);
});

test("35 agents: 30 placed, 5 without blossoms, no crash; mapping survives an exit", () => {
  const st = newState();
  const list = Array.from({ length: 35 }, (_, i) => ag(`a${i}`, `s${i % 7}`));
  const used = assign(list, st);
  assert.equal(used.length, ANCHORS.length);
  assert.equal(used.filter(Boolean).length, ANCHORS.length);
  assert.equal(new Set(used.filter(Boolean).map((a) => a.address)).size, ANCHORS.length);
  assert.equal(Object.keys(st.slotOf).length, ANCHORS.length);
  // 7 spaces on 5 limbs: every limb used, at most 2 spaces each.
  const load = new Array(LIMBS).fill(0);
  for (const l of Object.values(st.limbOf)) load[l]++;
  assert.deepEqual(load, [2, 2, 1, 1, 1]);

  const before = map(used);
  const rest = list.filter((a) => a.address !== "a0");
  const after = map(assign(rest, st));
  for (const [k, i] of Object.entries(before)) if (k !== "a0") assert.equal(after[k], i, k);
  assert.equal(Object.keys(after).length, ANCHORS.length, "a waiting agent fills the freed anchor");
});

test("zero agents: all buds, state cleared", () => {
  const st = newState();
  assign(BASE, st);
  const used = assign([], st);
  assert.equal(used.length, ANCHORS.length);
  assert.ok(used.every((a) => a === null));
  assert.deepEqual(st.limbOf, {});
  assert.deepEqual(st.slotOf, {});
});

test("an agent that changes space moves to its new space's limb", () => {
  const st = newState();
  assign(BASE, st);
  const moved = BASE.map((a) => (a.address === "t4" ? ag("t4", "s1") : a));
  const after = map(assign(moved, st));
  assert.equal(limbOfAnchor(after.t4), 0);
  assert.equal(st.limbOf.s3, undefined);
});

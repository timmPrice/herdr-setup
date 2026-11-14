// ph-side pure helpers (mods/ph-side/model.js).
import test from "node:test";
import assert from "node:assert/strict";
import {
  isCompact, pad2, fmtMin, toNextMinute, Clock, timingStatus, progName, barLevel, pipsBySpace, fitPips, homeNode,
  gitBits, kidStatus, subTree, treeText, daemonList, timed, minuteKey, place, nestSpaces, findNode,
} from "../mods/ph-side/model.js";

const M = 60_000, H = 60 * M, D = 24 * H;

test("compact rail below 160 px", () => {
  assert.equal(isCompact(159), true);
  assert.equal(isCompact(160), false);
  assert.equal(isCompact(0), false);
  assert.equal(pad2(3), "03");
  assert.equal(pad2(undefined), "00");
});

test("minute format", () => {
  assert.equal(fmtMin(0), "<1m");
  assert.equal(fmtMin(59_999), "<1m");
  assert.equal(fmtMin(-5), "<1m");
  assert.equal(fmtMin(undefined), "<1m");
  assert.equal(fmtMin(M), "1m");
  assert.equal(fmtMin(3 * M + 59_000), "3m");
  assert.equal(fmtMin(59 * M), "59m");
  assert.equal(fmtMin(H + 4 * M), "1h04m");
  assert.equal(fmtMin(23 * H + 59 * M), "23h59m");
  assert.equal(fmtMin(2 * D + 3 * H + 30 * M), "2d03h");
  assert.equal(toNextMinute(10 * M), M);
  assert.equal(toNextMinute(10 * M + 15_000), 45_000);
});

test("clock survives a restart (empty first render)", () => {
  const T = 1_700_000_000_000;
  const a = new Clock();
  assert.equal(a.track([{ address: "t1", status: "working" }], T), true);
  const saved = a.dump();
  // Restart an hour later: the first renders have no agents.
  const b = Clock.load(saved);
  assert.equal(b.track([], T + H), false);
  assert.equal(b.track([], T + H + 500), false);
  assert.equal(b.dump(), saved);
  // The agent comes back in the same state: its clock goes on.
  b.track([{ address: "t1", status: "working" }], T + H + 1000);
  assert.equal(b.elapsed("t1", T + H + 1000), H + 1000);
  assert.equal(fmtMin(b.elapsed("t1", T + H + 1000)), "1h00m");
});

test("clock: change restarts, done = idle, long-gone forgotten, seeds", () => {
  const c = Clock.load("not json");
  c.track([{ address: "a", status: "done" }], 1000);
  c.track([{ address: "a", status: "idle" }], 5000); // looked at: same state for timing
  assert.equal(c.at("a"), 1000);
  c.track([{ address: "a", status: "working" }], 9000);
  assert.equal(c.at("a"), 9000);
  c.track([{ address: "b", status: "idle" }], 9000 + 31 * D); // a is gone > 30 days
  assert.equal(c.at("a"), null);
  c.track([{ address: "s", status: "idle" }], 100_000, () => 40); // seed in seconds
  assert.equal(c.at("s"), 40_000);
  c.track([{ address: "f", status: "idle" }], 100_000, () => 999_999_999_999_999); // future: now
  assert.equal(c.at("f"), 100_000);
  assert.equal(timingStatus(undefined), null);
  assert.equal(minuteKey(["a", "s"], c, 100_000 + 2 * M), "<1m|3m");
});

test("program names, bars, pips", () => {
  assert.equal(progName({ program: { key: "codex" } }), "codex");
  assert.equal(progName({ program: { key: "agent" }, app: "Claude Code" }), "claude");
  assert.equal(progName({ app: "gemini-cli" }), "gemini");
  assert.equal(progName({}), "agent");
  assert.equal(barLevel("idle"), 0);
  assert.equal(barLevel("working"), 3);
  assert.equal(barLevel(null), 1);
  const list = [
    { address: "a", status: "idle", space: "s1", seq: 0 },
    { address: "b", status: "blocked", space: "s1", seq: 1 },
    { address: "c", status: "working", space: "s2", seq: 2 },
  ];
  const m = pipsBySpace(list);
  assert.deepEqual(m.get("s1"), ["blocked", "idle"]);
  assert.deepEqual(fitPips(["x", "y", "z", "w"], 3), { shown: ["x", "y"], more: 2 });
  assert.deepEqual(fitPips(["x"], 0), { shown: [], more: 1 });
});

test("pinned first, then urgency, ties by time in state then address (not seq)", () => {
  const c = new Clock();
  const list = [
    { address: "a", status: "idle", seq: 9 },
    { address: "b", status: "blocked", seq: 1 },
    { address: "c", status: "working", seq: 5 },
    { address: "d", status: "working", seq: 2 },
    { address: "e", status: "idle", pinned: true, seq: 0 },
    { address: "f", status: "done", seq: 3 },
  ];
  c.track([{ address: "c", status: "working" }], 1000);
  c.track([{ address: "d", status: "working" }], 2000);
  assert.deepEqual(daemonList(list, [], c).map((r) => r.a.address), ["e", "b", "f", "c", "d", "a"]);
  // seq bumps (title change) do not reorder within a group.
  const bumped = list.map((a) => (a.address === "c" ? { ...a, seq: 99 } : a));
  assert.deepEqual(daemonList(bumped, [], c).map((r) => r.a.address), ["e", "b", "f", "c", "d", "a"]);
  // Two pinned: urgency among them.
  const two = list.map((a) => (a.address === "c" ? { ...a, pinned: true } : a));
  assert.deepEqual(daemonList(two, [], c).map((r) => r.a.address).slice(0, 2), ["c", "e"]);
});

test("sub-agents: tree under the parent, parent takes its most urgent child's place", () => {
  const list = [
    { address: "mgr", status: "idle" },
    { address: "solo", status: "working" },
    { address: "kidp", status: "working" }, // a sub-agent with its own pane
  ];
  const all = [
    { address: "mgr", state: "live", status: "idle" },
    { address: "w1", parent: "mgr", state: "live", status: "working", name: "build-x" },
    { address: "w2", parent: "mgr", state: "live", status: "error", name: "build-y" },
    { address: "w3", parent: "w1", state: "live", status: "done", template: "tpl" },
    { address: "kidp", parent: "mgr", state: "live", status: "working" },
    { address: "dead", parent: "mgr", state: "exited", status: "idle" },
  ];
  const tree = subTree(all, "mgr");
  assert.deepEqual(tree.map((s) => s.t.address), ["w1", "w3", "w2", "kidp"]);
  assert.deepEqual(tree.map((s) => treeText(s.lines)), ["├─", "│ └─", "├─", "└─"]);
  const listed = new Map(list.map((a) => [a.address, a.status]));
  assert.equal(kidStatus(all[2], listed), "blocked");
  assert.equal(kidStatus(all[3], listed), "idle");
  assert.equal(kidStatus({ address: "kidp", status: "idle" }, listed), "working");
  const rows = daemonList(list, all, new Clock());
  assert.deepEqual(rows.map((r) => r.a.address), ["mgr", "solo"]); // kidp only in the tree; mgr is WAIT via w2
  assert.equal(rows[0].eff, "blocked");
  assert.equal(rows[0].subs.length, 4);
  // pinned nested agent keeps its own row too
  const pinned = list.map((a) => (a.address === "kidp" ? { ...a, pinned: true } : a));
  assert.deepEqual(daemonList(pinned, all, new Clock()).map((r) => r.a.address), ["kidp", "mgr", "solo"]);
  // timed: agents + pane-less kids (kidp once)
  assert.deepEqual(timed(list, all).map((a) => a.address), ["mgr", "solo", "kidp", "w1", "w2", "w3"]);
  assert.equal(timed(list, all).find((a) => a.address === "w2").status, "blocked");
  // a cycle doesn't loop forever
  assert.equal(subTree([{ address: "x", parent: "y", state: "live" }, { address: "y", parent: "x", state: "live" }], "x").length, 1);
});

test("nodes: place, worktree nesting, git bits, home node, layout find", () => {
  const ps = [{ tab: "t9", cwd: "/elsewhere" }, { tab: "t1", cwd: "/repo/wt" }];
  assert.equal(place({ tabs: [{ id: "t1" }], folder: "/repo" }, ps), "/repo/wt");
  assert.equal(place({ tabs: [{ id: "t2" }], folder: "/repo" }, ps), "/repo");
  const sp = [{ id: "a" }, { id: "wt1" }, { id: "b" }, { id: "wt2" }, { id: "lone" }];
  const g = { a: { repo: "R", linked: false }, wt1: { repo: "R", linked: true }, wt2: { repo: "R", linked: true }, b: null, lone: { repo: "Q", linked: true } };
  assert.deepEqual(nestSpaces(sp, (s) => g[s.id]).map((r) => `${r.s.id}${r.tree ?? ""}`), ["a", "wt1├─", "wt2└─", "b", "lone"]);
  assert.deepEqual(gitBits("main", { ahead: 2, behind: 0 }).map((b) => b.text), ["main", "↑2"]);
  assert.deepEqual(gitBits(null, { ahead: 0, behind: 4 }).map((b) => b.text), ["↓4"]);
  assert.equal(homeNode({ space: "s1", space_name: "herdr" }, [{ id: "s1", index: 1, name: "herdr" }]), "01·herdr");
  assert.equal(findNode({ id: "root", children: [{ id: "body", children: [{ id: "sidebar", size: { px: 420 } }] }] }, "sidebar").size.px, 420);
});

// ph-toast's pure helpers (ported nk-toast classifier cases + agent lookup).
import test from "node:test";
import assert from "node:assert/strict";
import { kindOf, loginMachine, agentEvent, findAgent, agentWord } from "../mods/ph-toast/kind.js";

test("kind: suffix first, then levels, then words", () => {
  const cases = [
    // names with done-words that need you are warnings
    [{ title: "release-ready needs you" }, "warn"],
    [{ title: "done-check needs you" }, "warn"],
    [{ title: "build-complete needs you" }, "warn"],
    [{ title: "Ready to restart" }, "info"],
    // and the other way round
    [{ title: "manager-2 finished", body: "meeseeks 2 / 1" }, "done"],
    [{ title: "fix-errors finished" }, "done"],
    [{ title: "blocked-waiter finished" }, "done"],
    [{ title: "Claude Code needs you", body: "space / tab" }, "warn"],
    // other Herdr strings
    [{ title: "herdr-core update failed: timeout" }, "warn"],
    [{ title: "Terminal failed to start" }, "warn"],
    [{ title: "Updated to 0.1.15" }, "info"],
    [{ title: "Couldn't make the space", body: "box needs login; run hc machine login box" }, "warn"],
    // explicit levels win
    [{ title: "release-ready needs you", level: "success" }, "done"],
    [{ title: "all done", level: "error" }, "warn"],
    [{ title: "Tests passed", level: "info" }, "info"],
    // general words
    [{ title: "Build complete" }, "done"],
    [{ title: "Deploy done", body: "but 2 errors" }, "warn"],
    [{ title: "Hello" }, "info"],
    [{}, "info"],
    [undefined, "info"],
  ];
  for (const [p, want] of cases) assert.equal(kindOf(p), want, JSON.stringify(p));
});

test("login body", () => {
  assert.equal(loginMachine("box needs login; run hc machine login box"), "box");
  assert.equal(loginMachine("vps-1.eu needs login; run hc machine login vps-1.eu"), "vps-1.eu");
  assert.equal(loginMachine("box needs login; run hc machine login other"), null);
  assert.equal(loginMachine(""), null);
  assert.equal(loginMachine(undefined), null);
});

test("agent event from title", () => {
  assert.deepEqual(agentEvent("Claude Code needs you"), { name: "Claude Code", event: "wait" });
  assert.deepEqual(agentEvent("manager-2 finished"), { name: "manager-2", event: "done" });
  assert.equal(agentEvent("Build complete"), null);
  assert.equal(agentEvent(""), null);
});

const AG = [
  { address: "t2k", pane: "p1", status: "blocked", app: "codex", program: { key: "codex", name: "Codex" }, seq: 3 },
  { address: "t7p", pane: "p2", status: "done", app: "claude-code", program: { key: "claude", name: "Claude Code" }, seq: 5 },
  { address: "t4g", pane: "p3", status: "working", app: "claude-code", program: { key: "claude", name: "Claude Code" }, seq: 9 },
  { address: "t12", pane: "p4", status: "done", app: "claude-code", program: { key: "claude", name: "Claude Code" }, seq: 1 },
];
const TERMS = [{ address: "t12", name: "manager" }, { address: "t2k" }];

test("find agent", () => {
  assert.equal(findAgent({ title: "x", action: { name: "agent.focus", args: { terminal: "t4g" } } }, AG)?.address, "t4g");
  assert.equal(findAgent({ title: "x", action: { args: { pane: "p2" } } }, AG)?.address, "t7p");
  assert.equal(findAgent({ title: "manager finished" }, AG, TERMS)?.address, "t12");
  // program name: several; status that fits the event wins, then newest
  assert.equal(findAgent({ title: "Claude Code finished" }, AG, TERMS)?.address, "t7p");
  assert.equal(findAgent({ title: "Codex needs you" }, AG, TERMS)?.address, "t2k");
  assert.equal(findAgent({ title: "Kiro finished" }, AG, TERMS), null);
  assert.equal(findAgent({ title: "Build complete" }, AG, TERMS), null);
  assert.equal(findAgent({}, null, null), null);
});

test("agent word", () => {
  assert.equal(agentWord(AG[0]), "codex");
  assert.equal(agentWord(AG[1]), "claude");
  assert.equal(agentWord({ app: "claude-code", program: { key: "agent", name: "Claude Code" } }), "claude");
  assert.equal(agentWord(null, "Kiro"), "kiro");
});

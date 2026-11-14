import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootLines, layoutMods, daemonsByProgram, parseTelemetry, stepFor, cellsFor } from "../mods/ph-boot/bootlines.js";

const demo = JSON.parse(readFileSync(new URL("../tools/scenarios/demo.json", import.meta.url)));
const text = (l) => l.parts.map((p) => p.text).join("");
const FONTS = [["ShareTech", "Share Tech Mono"], ["VT323", "VT323"]];

test("layoutMods finds blocks, pane headers and the toast", () => {
  const tree = { toast: "ph-toast", children: [{ content: { mod: "ph-title" } },
    { content: { tab: "active", pane: { header: { content: { mod: "ph-pane" } } } } }, { content: { mod: "ph-title" } }] };
  assert.deepEqual(layoutMods(tree).sort(), ["ph-pane", "ph-title", "ph-toast"]);
  assert.deepEqual(layoutMods(null), []);
});

test("daemonsByProgram groups by program, most first", () => {
  const by = daemonsByProgram([{ program: { name: "codex" } }, { app: "claude" }, { program: { name: "codex" } }, {}]);
  assert.deepEqual(by, [["codex", 2], ["agent", 1], ["claude", 1]]);
});

test("parseTelemetry reads /proc text and tolerates nulls", () => {
  const t = parseTelemetry({
    cpuinfo: "processor\t: 0\nmodel\t: x\n\nprocessor\t: 1\n",
    meminfo: "MemTotal:       65536000 kB\nMemFree: 1 kB\n",
    route: "Iface\tDestination\tGateway\nwlan0\t0000A8C0\t00000000\neth0\t00000000\t0100A8C0\n",
    speed: "1000\n",
  });
  assert.deepEqual(t, { cpus: 2, memGiB: 63, iface: "eth0", speed: 1000 });
  assert.deepEqual(parseTelemetry(), { cpus: null, memGiB: null, iface: null, speed: null });
  assert.equal(parseTelemetry({ speed: "-1" }).speed, null);
});

test("demo scenario: real counts, one red WAIT line, ends with the hand-over", () => {
  const lines = bootLines({ layout: "phosphor", tree: { content: { mod: "ph-side" } }, fontsWanted: FONTS,
    fontsHave: ["Share Tech Mono", "VT323"], spaces: demo.spaces, agents: demo.agents, terminals: demo.panes,
    telemetry: { cpus: 16, memGiB: 31, iface: "eth0", speed: 2500 } });
  const all = lines.map(text);
  assert.match(all[0], /Loaded layout phosphor · 1 mod · fonts ShareTech\/VT323/);
  assert.equal(all[1], "Restored 5 nodes · 8 tabs · 3 terminals");
  assert.match(all[2], /Attached 5 daemons · agent ×3, codex ×1, opencode ×1/);
  const waits = lines.filter((l) => l.tag === "[WAIT]");
  assert.equal(waits.length, 1);
  assert.match(text(waits[0]), /^codex@t2k needs input · api-gateway/);
  assert.match(all.at(-2), /Telemetry \/proc · 16 cpu · 31 GiB · eth0 up 2.5 Gb\/s/);
  assert.equal(lines.at(-1).last, true);
  assert.equal(lines.filter((l) => l.last).length, 1);
});

test("zero agents, missing fonts, no telemetry", () => {
  const lines = bootLines({ layout: null, fontsWanted: FONTS, fontsHave: [], spaces: [{ tabs: [{}] }], agents: [], terminals: [] });
  assert.equal(lines[0].tag, "[FAIL]");
  assert.match(text(lines[0]), /missing ShareTech\/VT323/);
  assert.equal(text(lines[1]), "Restored 1 node · 1 tab · 0 terminals");
  assert.match(text(lines[2]), /No daemons attached/);
  assert.ok(!lines.some((l) => l.tag === "[WAIT]"));
  assert.match(text(lines.at(-2)), /sampling/);
});

test("many blocked agents: oldest first, capped, rest summarised", () => {
  const agents = Array.from({ length: 7 }, (_, i) => ({ address: `t${i}`, status: "blocked", seq: 10 - i, app: "claude",
    space_name: "s", tab_index: 3, tab_name: "a-very-long-tab-name-that-goes-on" }));
  const lines = bootLines({ agents, spaces: [], terminals: [] });
  const waits = lines.filter((l) => l.tag === "[WAIT]").map(text);
  assert.equal(waits.length, 4);
  assert.match(waits[0], /^claude@t6 needs input · s › 03:a-very-long/);
  assert.equal(waits[3], "4 more daemons need you");
});

test("pace fits ~1.1 s and the bar fills", () => {
  assert.equal(stepFor(6), 160);
  assert.equal(stepFor(10), 110);
  assert.equal(stepFor(40), 60);
  const n = 7, total = n * stepFor(n);
  assert.ok(total >= 900 && total <= 1200, `log takes ${total} ms`);
  assert.equal(cellsFor(0, 6), 0);
  assert.equal(cellsFor(3, 6), 20);
  assert.equal(cellsFor(6, 6), 40);
  assert.equal(cellsFor(9, 6), 40);
});

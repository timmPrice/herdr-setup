import test from "node:test";
import assert from "node:assert/strict";
import { Hist, Events, Host, MIN, parseStat, parseMem, parseNet, parseLoad, parseUptime, fmtBytes, fmtMem, fmtUptime, splitDump, progOf } from "../mods/ph-telemetry/model.js";

const T0 = 1000 * MIN; // minute-aligned epoch

test("histogram: max per minute, carry forward, 60-min window", () => {
  const h = new Hist();
  assert.ok(h.sample(2, T0));
  assert.ok(h.sample(3, T0 + 10_000));
  assert.ok(h.sample(1, T0 + 20_000));            // last changes, bin keeps max
  assert.equal(h.bins[1000], 3);
  let s = h.series(T0 + 5 * MIN);
  assert.equal(s.length, 60);
  assert.deepEqual(s.slice(-6), [3, 3, 3, 3, 3, 3]); // carried (value of the newest bin)
  assert.equal(s[0], 0);                            // before first sample
  h.sample(0, T0 + 70 * MIN);
  assert.equal(h.bins[1000], undefined);            // dropped
  s = h.series(T0 + 70 * MIN);
  assert.equal(s.at(-1), 0);
  const r = Hist.load(h.dump());
  assert.deepEqual(r.series(T0 + 70 * MIN), s);
  assert.equal(Hist.load("nope").series(T0).length, 60);
});

test("histogram: carry-in from before the window", () => {
  const h = new Hist();
  h.sample(2, T0);
  const s = h.series(T0 + 90 * MIN);  // bin is older than window but still present (not pruned yet)
  assert.ok(s.every((v) => v === 2));
});

test("events: first observation silent, then diffs", () => {
  const e = new Events();
  const a = (address, status, name = "claude") => ({ address, status, program: { name } });
  assert.ok(e.observe([a("t1", "working"), a("t2", "idle")], 1));
  assert.equal(e.list.length, 0);
  assert.ok(!e.observe([a("t1", "working"), a("t2", "idle")], 2));
  e.observe([a("t1", "blocked"), a("t2", "idle"), a("t3", "working", "codex")], 3);
  assert.equal(e.list.length, 2);
  assert.ok(e.list.some((x) => x.addr === "t1" && x.from === "working" && x.to === "blocked"));
  assert.ok(e.list.some((x) => x.addr === "t3" && x.from === null && x.prog === "codex"));
  e.observe([a("t1", "blocked"), a("t3", "working", "codex")], 4);
  assert.deepEqual([e.list[0].addr, e.list[0].to, e.list[0].prog], ["t2", "gone", "claude"]);
  const r = Events.load(e.dump());
  assert.equal(r.list.length, 3);
  assert.ok(!r.observe([a("t1", "blocked"), a("t3", "working", "codex")], 5));
  const c = new Events([], null, 2);
  c.observe([a("x", "idle")], 1);
  for (let i = 0; i < 5; i++) c.observe([a("x", i % 2 ? "idle" : "working")], 2 + i);
  assert.equal(c.list.length, 2);
  assert.equal(progOf({ app: "zsh" }), "zsh");
});

const STAT1 = "cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 50 0 50 400 0 0 0 0 0 0\ncpu1 50 0 50 400 0 0 0 0 0 0\nintr 1\n";
const STAT2 = "cpu  150 0 150 900 0 0 0 0 0 0\ncpu0 1\ncpu1 1\n";
const NET1 = "Inter-|   Receive\n face |bytes packets\n    lo: 999 1 0 0 0 0 0 0 999 1 0 0 0 0 0 0\n  eth0: 1000 1 0 0 0 0 0 0 500 1 0 0 0 0 0 0\nveth1: 77 1 0 0 0 0 0 0 77 1 0 0 0 0 0 0\n";
const NET2 = NET1.replace("eth0: 1000", "eth0: 4000").replace("0 500 1", "0 2000 1");
const MEMI = "MemTotal:       65536000 kB\nMemFree:  1000 kB\nMemAvailable:   45536000 kB\n";

test("proc parsers", () => {
  assert.deepEqual(parseStat(STAT1), { busy: 200, total: 1000, ncpu: 2 });
  assert.deepEqual(parseMem(MEMI), { total: 65536000 * 1024, used: 20000000 * 1024 });
  assert.deepEqual(parseNet(NET1), { rx: 1000, tx: 500 });
  assert.deepEqual(parseLoad("1.42 0.98 0.77 2/1234 5678\n"), [1.42, 0.98, 0.77]);
  assert.equal(parseUptime("280320.55 1000.0\n"), 280320.55);
  assert.equal(parseStat(""), null);
  assert.equal(parseMem("x"), null);
  assert.equal(parseNet(""), null);
});

test("host deltas", () => {
  const h = new Host();
  const base = { meminfo: MEMI, loadavg: "1 2 3 1/1 1", uptime: "100 1" };
  let s = h.feed({ ...base, stat: STAT1, netdev: NET1 }, 0);
  assert.equal(s.cpu, null);
  assert.equal(s.net, null);
  s = h.feed({ ...base, stat: STAT2, netdev: NET2 }, 2000);
  assert.equal(s.cpu, 100 / 200);
  assert.deepEqual(s.net, { rx: 1500, tx: 750 });
  assert.equal(s.ncpu, 2);
});

test("formatters", () => {
  assert.equal(fmtBytes(84 * 1024), "84K");
  assert.equal(fmtBytes(1.2 * 1024 * 1024), "1.2M");
  assert.equal(fmtBytes(0), "0B");
  assert.equal(fmtBytes(null), "--");
  assert.equal(fmtMem({ used: 18.4 * 1024 ** 3, total: 62 * 1024 ** 3 }), "18.4/62G");
  assert.equal(fmtUptime(3 * 86400 + 7 * 3600 + 12 * 60 + 5), "3d 07:12");
  assert.equal(fmtUptime(59), "00:00");
  assert.deepEqual(splitDump("@@/proc/a\nx\ny\n@@/proc/b\nz"), { "/proc/a": "x\ny\n", "/proc/b": "z\n" });
});

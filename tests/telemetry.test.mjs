import test from "node:test";
import assert from "node:assert/strict";
import { Hist, Events, Host, MIN, parseStat, parseMem, parseNet, parseLoad, parseUptime, fmtBytes, fmtRate, fmtMem, fmtUptime, splitDump, progOf, hostFields, cells, wantFast } from "../mods/ph-telemetry/model.js";

const T0 = 1000 * MIN; // minute-aligned epoch

test("events: silent on restart (no prev persisted), even with an empty first agents()", () => {
  const a = (address, status) => ({ address, status, program: { name: "claude" } });
  const e = new Events();
  e.observe([a("t1", "working"), a("t2", "idle")], 1);
  e.observe([a("t1", "blocked"), a("t2", "idle")], 2);
  assert.equal(e.list.length, 1);
  const saved = e.dump();
  assert.ok(!JSON.parse(saved).prev, "prev is not persisted");
  // restart: agents() empty on the first render, then filled in
  let r = Events.load(saved);
  assert.ok(!r.observe([], 10));
  assert.ok(!r.observe([a("t1", "blocked"), a("t2", "idle")], 11));
  assert.equal(r.list.length, 1);
  // restart after a reboot: all-new addresses, old ones gone → still nothing logged
  r = Events.load(saved);
  assert.ok(!r.observe([a("t7", "idle"), a("t8", "working")], 20));
  assert.equal(r.list.length, 1);
  // then real changes log with their own time
  assert.ok(r.observe([a("t7", "working"), a("t8", "working")], 25));
  assert.deepEqual([r.list[0].addr, r.list[0].t, r.list[0].from, r.list[0].to], ["t7", 25, "idle", "working"]);
  // old saves with prev/names still load (list only)
  const old = Events.load(JSON.stringify({ list: [{ t: 1, addr: "x", to: "done" }], prev: { x: "done" }, names: {} }));
  assert.equal(old.prev, null);
  assert.equal(old.list.length, 1);
});

test("histogram: a gap (app closed) carries the last count, not the minute's max", () => {
  const h = new Hist();
  h.sample(5, T0);
  h.sample(0, T0 + 5_000);                       // same minute: max 5, ends at 0
  const r = Hist.load(h.dump());                 // restart 30 min later
  r.sample(0, T0 + 30 * MIN);
  const s = r.series(T0 + 30 * MIN);
  assert.equal(s[59 - 30], 5);                   // the sampled minute shows its max
  assert.ok(s.slice(59 - 29).every((v) => v === 0), "gap shows 0, the count when the app closed");
  // a gap after a minute that ended at 3 carries 3
  const g = new Hist();
  g.sample(6, T0); g.sample(3, T0 + 1000);
  g.sample(3, T0 + 10 * MIN);
  const gs = g.series(T0 + 10 * MIN);
  assert.deepEqual(gs.slice(-11), [6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  // carry-in from before the window uses that bin's end count
  assert.ok(new Hist({ [1000]: 4 }, 2, { [1000]: 2 }).series(T0 + 90 * MIN).every((v) => v === 2));
  // pre-`ends` saves load and carry 0 into gaps
  const legacy = Hist.load(JSON.stringify({ bins: { [1000]: 4 }, last: 4 }));
  assert.deepEqual(legacy.series(T0 + 2 * MIN).slice(-3), [4, 0, 0]);
  // ends are pruned with bins
  g.sample(0, T0 + 80 * MIN);
  assert.deepEqual(Object.keys(g.ends), [String(1080)]);
});

test("histogram: max per minute, carry forward, 60-min window", () => {
  const h = new Hist();
  assert.ok(h.sample(2, T0));
  assert.ok(h.sample(3, T0 + 10_000));
  assert.ok(h.sample(1, T0 + 20_000));            // last changes, bin keeps max
  assert.equal(h.bins[1000], 3);
  let s = h.series(T0 + 5 * MIN);
  assert.equal(s.length, 60);
  assert.deepEqual(s.slice(-6), [3, 1, 1, 1, 1, 1]); // max in its minute, then carries the last count
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
  assert.ok(new Hist({ [1000]: 2 }).series(T0 + 90 * MIN).every((v) => v === 0)); // no end count → 0
});

test("events: first observation silent, then diffs", () => {
  const e = new Events();
  const a = (address, status, name = "claude") => ({ address, status, program: { name } });
  assert.ok(!e.observe([a("t1", "working"), a("t2", "idle")], 1)); // seeding is silent and stores nothing
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
  const c = new Events([], 2);
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
  assert.deepEqual(parseNet(NET1), { rx: 1000, tx: 500, ifs: { eth0: { rx: 1000, tx: 500 } } });
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

test("host NET: per-interface deltas (new interface, counter reset)", () => {
  const h = new Host();
  const base = { stat: STAT1, meminfo: MEMI, loadavg: "1 2 3 1/1 1", uptime: "100 1" };
  const dev = (ifs) => "h1\nh2\n" + ifs.map(([n, rx, tx]) => `${n}: ${rx} 1 0 0 0 0 0 0 ${tx} 1 0 0 0 0 0 0`).join("\n") + "\n";
  h.feed({ ...base, netdev: dev([["eth0", 1000, 1000]]) }, 0);
  // a USB NIC appears with large counters: no spike
  let s = h.feed({ ...base, netdev: dev([["eth0", 3000, 2000], ["enx1", 9e9, 9e9]]) }, 1000);
  assert.deepEqual(s.net, { rx: 2000, tx: 1000 });
  // eth0 resets (driver reload) while enx1 moves: only enx1 counts
  s = h.feed({ ...base, netdev: dev([["eth0", 10, 10], ["enx1", 9e9 + 4096, 9e9]]) }, 2000);
  assert.deepEqual(s.net, { rx: 4096, tx: 0 });
  // lo is never counted
  s = h.feed({ ...base, netdev: dev([["lo", 1e12, 1e12], ["eth0", 10, 10], ["enx1", 9e9 + 4096, 9e9]]) }, 3000);
  assert.deepEqual(s.net, { rx: 0, tx: 0 });
});

test("host fields: formatted view values and redraw key stability", () => {
  assert.deepEqual(hostFields(null), { cpu: "--", cpuK: 0, mem: "--", memK: 0, load: "--", loadK: 0, load515: "--", rx: "--", tx: "--", up: "--" });
  const snap = (rx, cpu) => ({ cpu, mem: { used: 8 * 1024 ** 3, total: 16 * 1024 ** 3 }, net: { rx, tx: 300 }, load: [1.5, 1, 0.5], up: 3600, ncpu: 4 });
  const f = hostFields(snap(2100, 0.123));
  assert.deepEqual(f, { cpu: "12%", cpuK: 1, mem: "8.0/16G", memK: 5, load: "1.50", loadK: 4, load515: "1.00 0.50", rx: "2K", tx: "<1K", up: "01:00" });
  // idle NET jitter (bytes/s wobble) gives the same key → no redraw
  const key = (s) => JSON.stringify(hostFields(s));
  assert.equal(key(snap(200, 0.123)), key(snap(900, 0.121)));
  assert.equal(key(snap(2100, 0.12)), key(snap(2400, 0.12)));
  assert.notEqual(key(snap(200, 0.12)), key(snap(5000, 0.12)));
  assert.equal(cells(null), 0);
  assert.equal(cells(1.7), 10);
});

test("formatters", () => {
  assert.equal(fmtBytes(84 * 1024), "84K");
  assert.equal(fmtBytes(1.2 * 1024 * 1024), "1.2M");
  assert.equal(fmtBytes(0), "0B");
  assert.equal(fmtBytes(null), "--");
  assert.equal(fmtRate(0), "<1K");
  assert.equal(fmtRate(1023), "<1K");
  assert.equal(fmtRate(4.4 * 1024), "4K");
  assert.equal(fmtRate(37.4 * 1024), "37K");
  assert.equal(fmtRate(123 * 1024), "120K");
  assert.equal(fmtRate(999 * 1024), "1.0M");
  assert.equal(fmtRate(1.24 * 1024 ** 2), "1.2M");
  assert.equal(fmtRate(45.3 * 1024 ** 2), "45M");
  assert.equal(fmtRate(null), "--");
  assert.equal(fmtMem({ used: 18.4 * 1024 ** 3, total: 62 * 1024 ** 3 }), "18.4/62G");
  assert.equal(fmtUptime(3 * 86400 + 7 * 3600 + 12 * 60 + 5), "3d 07:12");
  assert.equal(fmtUptime(59), "00:00");
  assert.deepEqual(splitDump("@@/proc/a\nx\ny\n@@/proc/b\nz"), { "/proc/a": "x\ny\n", "/proc/b": "z\n" });
});

test("host cadence: 5 s only while shown and some agent is RUN", () => {
  assert.equal(wantFast([{ status: "idle" }, { status: "done" }, { status: "blocked" }], true), false);
  assert.equal(wantFast([], true), false);
  assert.equal(wantFast(undefined, true), false);
  assert.equal(wantFast([{ status: "idle" }, { status: "working" }], true), true);
  assert.equal(wantFast([{ status: "working" }], false), false);
});

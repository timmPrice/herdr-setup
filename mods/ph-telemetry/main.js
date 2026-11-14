// ph-telemetry: the sidebar's bottom block.
//   03 // EVENTS 記録     status changes observed from agents() (only when the block is tall enough)
//   03|04 // TELEMETRY 計測  per-state counters, 60-min working histogram, host CPU/MEM/LOAD/NET/uptime from /proc
// Nothing animates: values change in place. Calm and full look the same (there is no motion to drop).
// /proc is read on a 5 s timer, never in render; the read is skipped while the block is hidden.
// A tick only notifies (= redraws the whole window) when something it shows actually changed.
import { View, div, PathBuilder } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, terminals, layout, settings, readTextFile, exec } from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_JP, FONT_TERM, STATES, KANJI, alpha } from "./lib/palette.js";
import { plate, outline } from "./lib/plate.js";
import { Hist, Events, Host, clock, hostFields, splitDump } from "./model.js";

const TICK = 5000;
const PROC = { stat: "/proc/stat", meminfo: "/proc/meminfo", netdev: "/proc/net/dev", loadavg: "/proc/loadavg", uptime: "/proc/uptime" };
const PAD = 10;
// Telemetry section height, summed from the fixed heights below (header 8+22, counters 8+48,
// histogram 8+14+4+34 at its 6-row max, host 8+3*18+2, footer 5+14 = 229) plus slack.
// Fits a 240 px block; events get whatever is above it.
const TELE_H = 234;
const EV_ROW = 18;
const EV_MIN = 22 + 8 + 3 * EV_ROW; // show EVENTS only if at least 3 rows fit

const COUNTERS = ["working", "blocked", "done", "idle"];

function store(key, val) { try { localStorage.setItem(key, val); } catch { /* render without persistence */ } }
function fetch_(key) { try { return localStorage.getItem(key); } catch { return null; } }

/** True if a node with one of `ids` is hidden in the shown layout (as far as layout() tells). */
function hiddenIn(node, ids) {
  if (!node || typeof node !== "object") return false;
  if (ids.includes(node.id) && node.hidden === true) return true;
  return (node.children ?? []).some((c) => hiddenIn(c, ids));
}

export default class PhTelemetry extends View {
  init(_props, cx) {
    this.size = null;
    this.hist = Hist.load(fetch_("hist"));
    this.events = Events.load(fetch_("events"));
    this.host = new Host();
    this.snap = null;
    this.useExec = false;
    this.busy = false;
    this.drawnKey = null; // viewKey() of the last render
    this.refresh(cx);
    cx.timer.every(TICK, (cx) => this.refresh(cx));
  }

  shown() {
    try { return !hiddenIn(layout(), ["sidebar", "telemetry"]); } catch { return true; }
  }

  /** Updates the model from agents(): histogram sample + events diff (also runs while hidden). */
  observe(list, now) {
    const working = list.filter((a) => a.status === "working").length;
    if (this.hist.sample(working, now)) store("hist", this.hist.dump());
    if (this.events.observe(list, now)) store("events", this.events.dump());
  }

  /** Everything visible that a tick can change, as a string; equal keys → identical frame. */
  viewKey(list, now) {
    const counts = ["working", "blocked", "done", "idle"].map((k) => list.filter((a) => a.status === k).length);
    const ev = this.events.list[0];
    return JSON.stringify([hostFields(this.snap), this.hist.series(now), counts, list.length, ev ? [ev.t, ev.addr, ev.to] : null]);
  }

  /** Notify only if the frame would differ from the one last drawn, and only while shown. */
  notifyIfChanged(cx) {
    if (!this.shown()) return;
    if (this.viewKey(agents(), Date.now()) !== this.drawnKey) cx.notify();
  }

  refresh(cx) {
    // The histogram needs a sample each minute even when nothing changes status; events are diffed here
    // too so changes made while the block is hidden (render not running) keep their own tick's time.
    this.observe(agents(), Date.now());
    if (this.busy || !this.shown()) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const texts = await this.readProc();
        if (texts) this.snap = this.host.feed(texts);
      } catch { /* keep the last values */ }
      this.busy = false;
      this.notifyIfChanged(cx);
    });
  }

  async readProc() {
    if (!this.useExec) {
      const keys = Object.keys(PROC);
      const vals = await Promise.all(keys.map((k) => readTextFile(PROC[k]).catch(() => null)));
      if (vals.every((v) => v)) return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
      this.useExec = true; // readTextFile can't read /proc here: one sh per tick instead
    }
    const script = Object.values(PROC).map((p) => `echo @@${p}; cat ${p}`).join("; ");
    const r = await exec("sh", ["-c", script], { timeout: 2000 });
    const d = splitDump(r.stdout);
    return Object.fromEntries(Object.entries(PROC).map(([k, p]) => [k, d[p] ?? null]));
  }

  render(cx) {
    const list = agents();
    const now = Date.now();
    this.observe(list, now);
    this.drawnKey = this.viewKey(list, now);

    // on_size_change reports zoomed px (504x288 for a 420x240 block at zoom 1.2, seen live); layout px are unzoomed.
    let z = 1;
    try { z = Number(settings()?.zoom) || 1; } catch { /* zoom 1 */ }
    const W = Math.max(160, Math.floor((this.size?.width ?? 420 * z) / z));
    const H = Math.floor((this.size?.height ?? 240 * z) / z);
    const evH = H - TELE_H;
    const showEvents = evH >= EV_MIN;

    return v_flex().id("root").size_full().bg(P.void).font_family(FONT_UI).text_size(13).text_color(P.fg).overflow_hidden()
      .on_size_change((size, cx) => {
        if (Math.round(size.width) !== Math.round(this.size?.width ?? -1) || Math.round(size.height) !== Math.round(this.size?.height ?? -1)) {
          this.size = size; cx.notify();
        }
      })
      .when(showEvents, (el) => el.child(this.eventsView(W, evH)))
      .child(this.teleView(W, list, now, showEvents ? "04" : "03"));
  }

  // ---------- pieces ----------

  header(n, label, kanji, right = null) {
    return h_flex().h(22).mx(PAD).mt(8).bg(P.panel).items_center().flex_none()
      .child(div().w(3).h_full().bg(P.amber))
      .child(div().pl(8).text_color(P.amber).child(n))
      .child(div().px(6).text_color(P.grey).child("//"))
      .child(div().text_color(P.dim2).child(label))
      .child(div().pl(6).font_family(FONT_JP).text_size(12).text_color(P.dim).child(kanji))
      .child(div().flex_1())
      .when(right != null, (el) => el.child(div().pr(8).text_color(P.dim).child(right)));
  }

  eventsView(W, h) {
    const rows = Math.max(0, Math.floor((h - 22 - 14) / EV_ROW));
    const list = this.events.list.slice(0, rows);
    return v_flex().h(h).flex_none().overflow_hidden()
      .child(this.header("03", "EVENTS", KANJI.events))
      .child(v_flex().px(PAD + 4).pt(6)
        .when(list.length === 0, (el) => el.child(div().h(EV_ROW).text_color(P.dim).child("no status changes yet")))
        .children(list.map((e, i) => this.eventRow(e, i))));
  }

  eventRow(e, i) {
    const to = e.to === "gone" ? null : STATES[e.to] ?? STATES.shell;
    const tag = e.to === "gone" ? "[ -- ]" : to.tag;
    const color = e.to === "gone" ? P.grey : to.color;
    const name = (s) => s === "gone" ? "GONE" : (STATES[s] ?? STATES.shell).short;
    const what = e.from === null ? "spawned" : null;
    return h_flex().id(`ev-${i}`).h(EV_ROW).gap(8).items_center().whitespace_nowrap().overflow_hidden()
      .child(div().flex_none().font_family(FONT_NUM).text_size(17).text_color(P.dim).child(clock(e.t)))
      .child(div().flex_none().w(46).font_family(FONT_TERM).text_size(11).text_color(color).child(tag))
      .child(div().flex_none().text_color(P.fg).child(`${e.prog ?? "?"}@${e.addr}`))
      .child(what
        ? div().text_color(P.dim).child(what)
        : h_flex().gap(4).text_color(P.dim)
          .child(div().child(name(e.from)))
          .child(div().font_family(FONT_TERM).text_size(11).child("→"))
          .child(div().text_color(color).child(name(e.to))));
  }

  teleView(W, list, now, n) {
    const count = (k) => list.filter((a) => a.status === k).length;
    const sp = spaces();
    const tabs = sp.reduce((s, x) => s + (x.tabs?.length ?? 0), 0);
    let terms = 0;
    try { terms = terminals().length; } catch { /* optional */ }
    const two = (v) => String(v).padStart(2, "0");
    return v_flex().h(TELE_H).flex_none().overflow_hidden()
      .child(this.header(n, "TELEMETRY", KANJI.telemetry))
      .child(this.counters(W, count))
      .child(this.histogram(W, now))
      .child(this.hostView(W))
      .child(h_flex().h(19).flex_none().px(PAD + 2).pt(5).gap(14).items_center().text_size(11).text_color(P.dim)
        .child(this.stat("TABS", two(tabs)))
        .child(this.stat("SPACES", two(sp.length)))
        .child(this.stat("TERMS", two(terms)))
        .child(this.stat("AGENTS", two(list.length))));
  }

  stat(label, value) {
    return h_flex().gap(5).items_center().child(div().child(label)).child(div().text_color(P.fg).child(value));
  }

  counters(W, count) {
    const gap = 8, h = 48;
    const w = Math.floor((W - 2 * PAD - 3 * gap) / 4);
    return h_flex().px(PAD).pt(8).gap(gap).flex_none().children(COUNTERS.map((k) => {
      const s = STATES[k], v = count(k), on = v > 0;
      const col = on ? s.color : P.grey;
      const box = div().id(`ct-${k}`).relative().w(w).h(h).flex_none();
      if (k === "blocked" && on) box.child(plate(w, h, alpha(P.red, 0.16), { cut: 8 }));
      else box.child(plate(w, h, P.panel, { cut: 8 }));
      return box
        .child(outline(w, h, on ? alpha(col, k === "blocked" ? 1 : 0.55) : P.line, { cut: 8 }))
        .child(div().absolute().inset_0().flex().flex_col().items_center().justify_center()
          .child(div().font_family(FONT_NUM).text_size(30).line_height("28px").text_color(on ? s.color : P.dim).child(String(v).padStart(2, "0")))
          .child(h_flex().gap(4).items_center().text_size(10).text_color(on ? s.color : P.dim)
            .child(div().child(s.short))
            .child(div().font_family(FONT_JP).child(s.kanji))));
    }));
  }

  histogram(W, now) {
    const series = this.hist.series(now);
    const peak = Math.max(0, ...series);
    const rows = Math.min(6, Math.max(4, peak));
    const gw = W - 2 * PAD;
    const pitch = gw / 60, cw = Math.max(1, pitch - 1.5), ch = 4, rg = 2;
    const gh = rows * ch + (rows - 1) * rg;
    const lit = (v) => v <= 0 ? 0 : peak <= rows ? v : Math.max(1, Math.round((v * rows) / peak));
    const on = PathBuilder.fill(), off = PathBuilder.fill();
    let anyOn = false;
    series.forEach((v, i) => {
      const k = lit(v), x = i * pitch;
      for (let r = 0; r < rows; r++) {
        const y = gh - ch - r * (ch + rg);
        const pb = r < k ? on : off;
        if (r < k) anyOn = true;
        pb.move_to(x, y).line_to(x + cw, y).line_to(x + cw, y + ch).line_to(x, y + ch).close();
      }
    });
    const grid = div().relative().w(gw).h(gh).flex_none()
      .child(window.paint_path(off.build(), P.panel2).absolute().left(0).top(0).w(gw).h(gh));
    if (anyOn) grid.child(window.paint_path(on.build(), P.aqua).absolute().left(0).top(0).w(gw).h(gh));
    return v_flex().px(PAD).pt(8).gap(4).flex_none()
      .child(h_flex().h(14).items_center().text_size(11).text_color(P.dim)
        .child(div().child("WORKING · LAST 60 MIN"))
        .child(div().flex_1())
        .child(div().child(`peak ${peak}`)))
      .child(grid);
  }

  gauge(k, cells = 10) {
    return h_flex().gap(1).items_center().flex_none().children(Array.from({ length: cells }, (_, i) =>
      div().w(4).h(9).bg(i < k ? P.dim2 : P.panel2)));
  }

  hostView(W) {
    const f = hostFields(this.snap);
    const num = (t) => div().font_family(FONT_NUM).text_size(18).line_height("18px").text_color(P.fg).child(t);
    const lab = (t) => div().w(34).flex_none().text_size(11).text_color(P.dim).child(t);
    const half = Math.floor((W - 2 * PAD) / 2);
    const row = () => h_flex().h(18).items_center();
    return v_flex().px(PAD + 2).pt(8).gap(1).flex_none()
      .child(row()
        .child(h_flex().w(half).items_center().gap(6).child(lab("CPU")).child(this.gauge(f.cpuK)).child(num(f.cpu)))
        .child(h_flex().items_center().gap(6).child(lab("MEM")).child(this.gauge(f.memK)).child(num(f.mem))))
      .child(row()
        .child(h_flex().w(half).items_center().gap(6).child(lab("LOAD")).child(this.gauge(f.loadK)).child(num(f.load)))
        .child(h_flex().items_center().gap(6).child(lab("5/15"))
          .child(num(f.load515))))
      .child(row()
        .child(h_flex().w(half).items_center().gap(6).child(lab("NET"))
          .child(div().font_family(FONT_TERM).text_size(10).text_color(P.dim).child("↓")).child(num(f.rx))
          .child(div().font_family(FONT_TERM).text_size(10).text_color(P.dim).child("↑")).child(num(f.tx)))
        .child(h_flex().items_center().gap(6).child(lab("UP")).child(num(f.up))));
  }
}


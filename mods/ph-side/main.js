// PHOSPHOR sidebar, top part: 01 // NODES 節点 (spaces) and 02 // DAEMONS 常駐 (agents, most urgent first).
// Motion only where status says so: RUN rows get signal bars + █ cursor, WAIT rows blink their hazard edge
// and red tint (opacity, 700 ms). Calm: everything still (solid cursor, flat bars, solid red edge).
// Time-in-state comes from lib/since.js, persisted per copy in localStorage.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, agents, run, setAgentOrder, exec, settings, window as appWindow } from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_JP, FONT_TERM, KANJI, stateOf, alpha } from "./lib/palette.js";
import { plate, outline, hazard } from "./lib/plate.js";
import { isCalm, blink, cursor, bars } from "./lib/motion.js";
import { Since, tabSeed } from "./lib/since.js";
import {
  isCompact, pad2, fmtClock, progName, barLevel, pipsBySpace, fitPips, homeNode, ordered, clockKey, gitBits,
} from "./model.js";

const STORE = "ph-side.since";
const HEAD_H = 24;
const NODE_H = 24;
const ROW_H = 44;
const ROW_GAP = 5;
const PAD = 8;
const GIT_EVERY = 30000;

export default class PhSide extends View {
  init(_props, cx) {
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch {}
    this.since = Since.load(saved);
    this.w = 0;           // logical px (what .w()/.h() take), i.e. measured size / zoom
    this.h = 0;
    this.rawW = 0;        // on_size_change reports zoomed px; divide by settings().zoom
    this.rawH = 0;
    this.git = {};        // space id → { ahead, behind }
    this.gitAt = 0;
    this.gitBusy = false;
    this.lastClock = "";
    this.lastFocus = null;
    this.scroll = ScrollHandle.new();
    // Clocks tick once a second, but only redraw when a shown readout changed.
    cx.timer.every(1000, (cx) => {
      const k = clockKey(agents(), this.since, Date.now());
      if (k !== this.lastClock) cx.notify();
      if (Date.now() - this.gitAt > GIT_EVERY) this.refreshGit(cx);
    });
    this.refreshGit(cx);
  }

  // Ahead/behind per local space folder: a ref-only read, every 30 s while the window is active.
  refreshGit(cx) {
    if (this.gitBusy) return;
    let active = true;
    try { active = appWindow()?.active !== false; } catch {}
    if (!active && this.gitAt) return;
    this.gitBusy = true;
    this.gitAt = Date.now();
    const list = spaces().filter((s) => !s.machine && s.folder && s.branch);
    cx.spawn(async (cx) => {
      const next = {};
      await Promise.all(list.map(async (s) => {
        try {
          const r = await exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd: s.folder, timeout: 3000 });
          if (r.code === 0) {
            const [ahead, behind] = r.stdout.trim().split(/\s+/).map(Number);
            next[s.id] = { ahead: ahead || 0, behind: behind || 0 };
          }
        } catch {}
      }));
      const changed = JSON.stringify(next) !== JSON.stringify(this.git);
      this.git = next;
      this.gitBusy = false;
      if (changed) cx.notify();
    });
  }

  render() {
    const now = Date.now();
    const sp = spaces();
    const all = agents();
    try {
      if (this.since.observe(all, now, tabSeed(sp))) localStorage.setItem(STORE, this.since.dump());
    } catch {}
    const list = ordered(all);
    try { setAgentOrder(list.map((a) => a.address)); } catch {}
    this.lastClock = clockKey(all, this.since, now);
    this.resize();        // picks up a zoom change
    const calm = isCalm();
    const compact = isCompact(this.w);
    const W = Math.max(40, (this.w || 300) - 2 * PAD);

    // Keep the focused agent in view when focus moves to another one.
    const fi = list.findIndex((a) => a.focused);
    const fa = fi >= 0 ? list[fi].address : null;
    if (fa && fa !== this.lastFocus) { try { this.scroll.scroll_to_item(fi); } catch {} }
    this.lastFocus = fa;

    const pips = pipsBySpace(all);
    const nodesMax = Math.max(NODE_H * 3, Math.round((this.h || 600) * 0.4));
    const nodesH = Math.min(nodesMax, sp.length * NODE_H + 6);

    return v_flex().id("ph-side").size_full().bg(P.void).font_family(FONT_UI).text_size(13).text_color(P.fg)
      .overflow_hidden()
      .on_size_change((size, cx) => {
        this.rawW = size.width; this.rawH = size.height;
        if (this.resize()) cx.notify();
      })
      .child(this.head("01", "NODES", KANJI.nodes, sp.length, W, compact))
      .child(v_flex().id("ph-nodes").flex_none().h(nodesH).overflow_y_scrollbar().px(PAD).pb(6)
        .children(sp.map((s) => this.node(s, pips.get(s.id) ?? [], W, compact))))
      .child(this.head("02", "DAEMONS", KANJI.daemons, list.length, W, compact))
      .child(v_flex().id("ph-daemons").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).px(PAD).pb(6)
        .when(list.length === 0, (el) => el.child(this.empty(compact)))
        .children(list.map((a) => compact
          ? this.daemonCompact(a, now, W, calm)
          : this.daemon(a, sp, now, W, calm))));
  }

  // Logical size from the last measured size and zoom; true when it changed.
  resize() {
    let z = 1;
    try { z = Number(settings()?.zoom) || 1; } catch {}
    const w = this.rawW / z, h = this.rawH / z;
    if (Math.round(w) === Math.round(this.w) && Math.round(h) === Math.round(this.h)) return false;
    this.w = w; this.h = h;
    return true;
  }

  // "▌01 // NODES 節点 ............ 05"
  head(num, label, kanji, count, W, compact) {
    const w = W + 2 * PAD;
    return div().relative().flex_none().w(w).h(HEAD_H).mt(6).mb(4)
      .child(plate(w, HEAD_H, P.panel, { cut: 8, corners: "tr" }))
      .child(div().absolute().left(0).top(0).w(3).h(HEAD_H).bg(P.amber))
      .child(h_flex().absolute().left(0).top(0).w(w).h(HEAD_H).pl(compact ? 7 : 12).pr(compact ? 6 : 12).gap(compact ? 4 : 6).items_center()
        .child(div().flex_none().text_color(P.amber).child(num))
        .when(!compact, (el) => el
          .child(div().flex_none().text_color(P.grey).child("//"))
          .child(div().flex_none().text_color(P.dim2).child(label)))
        .when(!compact || w >= 70, (el) => el.child(div().flex_none().font_family(FONT_JP).text_size(12).text_color(P.dim).child(kanji)))
        .child(div().flex_1())
        .when(!compact || w >= 100, (el) => el.child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(P.amber).child(pad2(count)))));
  }

  // One space: index, name, branch / ahead / behind, one pip per agent. Active = inverse amber plate.
  node(s, statuses, W, compact) {
    const on = s.active;
    const ink = on ? P.void : null;
    const g = this.git[s.id];
    const pipRoom = compact ? Math.max(0, Math.floor((W - 26) / 10)) : Math.max(1, Math.min(12, Math.floor(W * 0.3 / 10)));
    const { shown, more } = fitPips(statuses, pipRoom);
    const pipEls = shown.map((st, i) => div().flex_none().w(8).h(8).bg(stateOf(st).color)
      .when(on, (el) => el.border(1).border_color(P.void)).id(`pip-${s.id}-${i}`));
    let row = h_flex().id(`ph-node-${s.id}`).relative().flex_none().w(W).h(NODE_H).cursor_pointer()
      .on_click(() => run("space.select", { id: s.id }))
      .when(!on, (el) => el.hover((st) => st.bg(P.panel)));
    if (on) row = row.child(plate(W, NODE_H, P.amber, { cut: 0 }));
    const body = h_flex().absolute().left(0).top(0).w(W).h(NODE_H).px(compact ? 4 : 8).gap(compact ? 4 : 8).items_center()
      .child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(ink ?? P.dim2).child(pad2(s.index)));
    if (compact) {
      return row.child(body.child(h_flex().flex_1().min_w(0).gap(2).justify_end().children(pipEls)));
    }
    const bits = gitBits(s.branch, g);
    return row.child(body
      .child(div().flex_shrink(1).min_w(0).truncate().text_size(14).text_color(ink ?? (statuses.length ? P.fg : P.dim2)).child(s.name))
      .child(h_flex().flex_1().min_w(0).gap(5).items_center().overflow_hidden()
        .children(bits.map((b) => div().flex_none().text_size(12)
          .font_family(b.kind === "branch" ? FONT_UI : FONT_TERM)
          .text_color(ink ?? (b.kind === "behind" ? P.dim2 : P.dim))
          .when(b.kind === "branch", (el) => el.flex_shrink(1).min_w(0).truncate())
          .child(b.text))))
      .child(h_flex().flex_none().gap(2).items_center()
        .children(pipEls)
        .when(more > 0, (el) => el.child(div().font_family(FONT_NUM).text_size(16).text_color(ink ?? P.dim2).child(`+${more}`)))));
  }

  // Two-line daemon row.
  daemon(a, sp, now, W, calm) {
    const st = stateOf(a.status);
    const blocked = st.key === "blocked", working = st.key === "working", idle = st.key === "idle";
    const edge = blocked ? 6 : 3;
    const nameInk = idle ? P.dim2 : P.fg;
    const tag = blocked
      ? div().relative().flex_none().w(46).h(17)
        .child(blink(plate(46, 17, P.red, { cut: 0 }), true, { calm }))
        .child(div().absolute().left(0).top(0).w(46).h(17).flex().items_center().justify_center()
          .font_family(FONT_TERM).text_size(12).font_weight(700).text_color(P.void).child(st.tag))
      : div().flex_none().font_family(FONT_TERM).text_size(12).text_color(st.color).child(st.tag);

    let row = div().id(`ph-daemon-${a.address}`).relative().flex_none().w(W).h(ROW_H).mb(ROW_GAP).cursor_pointer()
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .hover((s) => s.opacity(0.92));
    // Background plate (red tint + red outline when blocked; both blink together).
    if (blocked) {
      row = row
        .child(blink(div().absolute().left(0).top(0).w(W).h(ROW_H)
          .child(plate(W, ROW_H, alpha(P.red, 0.16), { cut: 8, corners: "br" }))
          .child(outline(W, ROW_H, alpha(P.red, 0.75), { cut: 8, corners: "br" })), true, { from: 0.45, calm }))
        .child(blink(hazard(edge, ROW_H, P.red, { calm, cut: 0, stripe: 2, interval: 6 }), true, { calm }));
    } else {
      row = row
        .child(plate(W, ROW_H, a.focused ? P.panel2 : P.panel, { cut: 8, corners: "br" }))
        .child(div().absolute().left(0).top(0).w(edge).h(ROW_H).bg(st.color).opacity(idle ? 0.6 : 1));
    }
    const line1 = h_flex().w_full().h(20).gap(7).items_center()
      .child(tag)
      .child(h_flex().flex_shrink(1).min_w(0).overflow_hidden().text_size(14)
        .child(div().flex_none().text_color(nameInk).child(progName(a)))
        .child(div().flex_none().text_color(P.grey).child("@"))
        .child(div().flex_none().text_color(a.focused ? P.amber : nameInk).child(a.address)))
      .child(div().flex_none().font_family(FONT_JP).text_size(12).text_color(st.color).child(st.kanji))
      .child(div().flex_1())
      .child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(st.color)
        .child(fmtClock(this.since.elapsed(a.address, now))))
      .child(bars(barLevel(a.status), st.color, { on: working, calm, h: 12, bw: 3, gap: 2, off: P.grey }));
    const line2 = h_flex().w_full().h(18).gap(8).items_center()
      .child(h_flex().flex_1().min_w(0).gap(2).items_center()
        .child(div().flex_shrink(1).min_w(0).truncate().text_size(12).text_color(idle ? P.dim : P.dim2).child(a.title || "—"))
        .when(working, (el) => el.child(cursor(true, { color: P.aqua, size: 12, calm }).flex_none())))
      .child(div().flex_none().max_w(Math.round(W * 0.45)).truncate().text_size(11).text_color(P.dim).child(homeNode(a, sp)));
    return row.child(v_flex().absolute().left(0).top(0).w(W).h(ROW_H).pl(edge + 9).pr(10).py(3).justify_center()
      .child(line1).child(line2));
  }

  // Rail row (< 160 px): edge + short tag + address, one line.
  daemonCompact(a, now, W, calm) {
    const st = stateOf(a.status);
    const blocked = st.key === "blocked";
    const H = 22;
    let row = div().id(`ph-daemon-${a.address}`).relative().flex_none().w(W).h(H).mb(3).cursor_pointer()
      .on_click(() => run("agent.focus", { terminal: a.address }));
    row = blocked
      ? row.child(blink(plate(W, H, alpha(P.red, 0.2), { cut: 0 }), true, { from: 0.45, calm }))
        .child(blink(hazard(4, H, P.red, { calm, cut: 0, stripe: 2, interval: 5 }), true, { calm }))
      : row.child(plate(W, H, a.focused ? P.panel2 : P.panel, { cut: 0 }))
        .child(div().absolute().left(0).top(0).w(3).h(H).bg(st.color));
    return row.child(h_flex().absolute().left(0).top(0).w(W).h(H).pl(7).pr(3).gap(4).items_center().overflow_hidden()
      .child(div().flex_none().font_family(FONT_TERM).text_size(11).text_color(st.color).child(st.short))
      .when(W >= 70, (el) => el.child(div().flex_shrink(1).min_w(0).truncate().text_size(12)
        .text_color(a.focused ? P.amber : P.fg).child(a.address)))
      .when(W >= 120, (el) => el.child(div().flex_1()).child(div().flex_none().font_family(FONT_NUM).text_size(16)
        .text_color(st.color).child(fmtClock(this.since.elapsed(a.address, now))))));
  }

  empty(compact) {
    return div().px(compact ? 2 : 10).py(6).text_size(12).text_color(P.dim)
      .child(compact ? "--" : "-- no daemons running");
  }
}

// PHOSPHOR sidebar, top part: 01 // NODES 節点 (spaces) and 02 // DAEMONS 常駐 (agents, most urgent first).
// Motion only where status says so: RUN rows get signal bars + █ cursor, WAIT rows blink their hazard edge
// and red tint (opacity, 700 ms). Calm: everything still (solid cursor, flat bars, solid red edge).
// Time-in-state is shown in minutes (model.js Clock, persisted in localStorage, kept across restarts);
// one timer, aligned to the minute, redraws only when a shown readout changed. Nothing else ticks.
//
// NODES: click = select, right-click = the space menu, drag = reorder (space.move), + = new space,
//        worktree spaces drawn under their checkout.
// DAEMONS: click = focus, right-click = pin/unpin (pinned first, also for agent.next/prev);
//          sub-agents (pane-less `hc run` children from terminals()) as indented rows under their parent,
//          click = focus (if it has a pane) or peek. A parent sorts by its most urgent sub-agent.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import {
  spaces, agents, terminals, panes, run, setAgentOrder, exec, settings, layout, openOverlay, window as appWindow,
} from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_JP, FONT_TERM, KANJI, stateOf, alpha } from "./lib/palette.js";
import { everyMinute } from "./lib/tick.js";
import { plate, outline, hazard } from "./lib/plate.js";
import { isCalm, blink, cursor, bars } from "./lib/motion.js";
import { tabSeed } from "./lib/since.js";
import {
  isCompact, pad2, fmtMin, Clock, progName, barLevel, pipsBySpace, fitPips, homeNode, gitBits,
  kidStatus, treeText, kidName, daemonList, timed, minuteKey, place, nestSpaces, findNode,
} from "./model.js";

const STORE = "ph-side.since";
const HEAD_H = 24;
const NODE_H = 24;
const ROW_H = 44;
const SUB_H = 22;
const ROW_GAP = 5;
const GIT_EVERY = 60000;

export default class PhSide extends View {
  init(_props, cx) {
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch {}
    this.clock = Clock.load(saved);
    this.w = 0;           // logical px (what .w()/.h() take)
    this.h = 0;
    this.rawW = 0;        // last on_size_change size (may be zoomed px, see resize())
    this.rawH = 0;
    this.git = {};        // place (cwd) → { branch, ahead, behind, repo, linked } | null
    this.gitAt = 0;
    this.gitBusy = false;
    this.shownKey = "";   // minute readouts last drawn
    this.lastFocus = null;
    this.lastActive = null;
    this.pressed = null;  // node drag: space id pressed
    this.over = null;     // node drag: space id under the pointer
    this.scroll = ScrollHandle.new();
    this.nodeScroll = ScrollHandle.new();
    this.tick(cx);
    this.refreshGit(cx);
  }

  // Once a minute, on the minute: redraw only if a readout changed; look at git while the window is in front.
  // Shared aligned tick (lib/tick.js): lands in the same frame as the other mods' minute notifies.
  tick(cx) {
    everyMinute(cx, (cx) => {
      const now = Date.now();
      if (this.readoutKey(now) !== this.shownKey) cx.notify();
      if (now - this.gitAt >= GIT_EVERY - 1000) this.refreshGit(cx);
    });
  }

  readoutKey(now) {
    let list = [], all = [];
    try { list = agents(); all = terminals(); } catch {}
    return minuteKey(timed(list, all).map((a) => a.address), this.clock, now);
  }

  // Git per space, measured where its first terminal is now (the branch shown is that one's too).
  // Ref-only reads; skipped while the window is in the background.
  refreshGit(cx) {
    if (this.gitBusy) return;
    let active = true;
    try { active = appWindow()?.active !== false; } catch {}
    if (!active && this.gitAt) return;
    this.gitBusy = true;
    this.gitAt = Date.now();
    let ps = [];
    try { ps = panes(); } catch {}
    const places = [...new Set(spaces().filter((s) => !s.machine).map((s) => place(s, ps)).filter(Boolean))];
    cx.spawn(async (cx) => {
      const next = {};
      await Promise.all(places.map(async (cwd) => {
        try {
          const o = { cwd, timeout: 3000 };
          const [common, branch, counts] = await Promise.all([
            exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"], o),
            exec("git", ["symbolic-ref", "-q", "--short", "HEAD"], o),
            exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], o),
          ]);
          if (common.code !== 0) { next[cwd] = null; return; }
          const [top, repo] = common.stdout.split("\n");
          const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
          next[cwd] = {
            branch: branch.code === 0 ? branch.stdout.trim() : "(detached)",
            ahead: ahead || 0, behind: behind || 0, repo, linked: repo !== `${top}/.git`,
          };
        } catch {}
      }));
      const changed = JSON.stringify(next) !== JSON.stringify(this.git);
      this.git = next;
      this.gitBusy = false;
      if (changed) cx.notify();
    });
  }

  render(cx) {
    const now = Date.now();
    const sp = spaces();
    const list = agents();
    let all = [], ps = [];
    try { all = terminals() ?? []; } catch {}
    try { ps = panes() ?? []; } catch {}
    const watched = timed(list, all);
    try {
      if (this.clock.track(watched, now, tabSeed(sp))) localStorage.setItem(STORE, this.clock.dump());
    } catch {}
    this.shownKey = minuteKey(watched.map((a) => a.address), this.clock, now);
    const rows = daemonList(list, all, this.clock);
    try { setAgentOrder(rows.map((r) => r.a.address)); } catch {}
    const listed = new Map(list.map((a) => [a.address, a.status]));

    // A space whose place has no git answer yet: look now (a new space, a cd).
    const placeOf = new Map(sp.map((s) => [s.id, place(s, ps)]));
    if (cx && [...placeOf.entries()].some(([id, p]) => p && !(p in this.git) && !sp.find((s) => s.id === id)?.machine)
      && now - this.gitAt > 5000) this.refreshGit(cx);

    this.resize();
    const calm = isCalm();
    const compact = isCompact(this.w);
    const pad = this.w && this.w < 80 ? 2 : 8;
    const W = Math.max(20, (this.w || 300) - 2 * pad);

    // The flat child list of DAEMONS (parent rows + their sub-agent rows), to keep the focused one in view.
    const items = [];
    for (const r of rows) {
      items.push({ kind: "agent", r });
      if (!compact) for (const s of r.subs) items.push({ kind: "sub", s });
    }
    const fi = items.findIndex((it) => it.kind === "agent" && it.r.a.focused);
    const fa = fi >= 0 ? items[fi].r.a.address : null;
    if (fa && fa !== this.lastFocus) { try { this.scroll.scroll_to_item(fi); } catch {} }
    this.lastFocus = fa;

    const nodes = nestSpaces(sp, (s) => this.git[placeOf.get(s.id)] ?? null);
    const ai = nodes.findIndex((n) => n.s.active);
    const activeId = ai >= 0 ? nodes[ai].s.id : null;
    if (activeId && activeId !== this.lastActive) { try { this.nodeScroll.scroll_to_item(ai); } catch {} }
    this.lastActive = activeId;

    const pips = pipsBySpace(list);
    const nodesMax = Math.max(NODE_H * 3, Math.round((this.h || 600) * 0.4));
    const nodesH = Math.min(nodesMax, nodes.length * NODE_H + 6);

    return v_flex().id("ph-side").size_full().bg(P.void).font_family(FONT_UI).text_size(13).text_color(P.fg)
      .overflow_hidden()
      .on_size_change((size, cx) => {
        this.rawW = size.width; this.rawH = size.height;
        if (this.resize()) cx.notify();
      })
      .child(this.head("01", "NODES", KANJI.nodes, sp.length, W, pad, compact, true))
      .child(v_flex().id("ph-nodes").flex_none().h(nodesH).overflow_y_scrollbar().track_scroll(this.nodeScroll).px(pad).pb(6)
        .on_mouse_up("left", (_e, cx) => { if (this.pressed !== null) { this.pressed = null; this.over = null; cx.notify(); } })
        .children(nodes.map((n) => this.node(n, this.git[placeOf.get(n.s.id)] ?? null, pips.get(n.s.id) ?? [], W, compact, sp))))
      .child(this.head("02", "DAEMONS", KANJI.daemons, rows.length, W, pad, compact, false))
      .child(v_flex().id("ph-daemons").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).px(pad).pb(6)
        .when(rows.length === 0, (el) => el.child(this.empty(compact)))
        .children(items.map((it) => it.kind === "sub"
          ? this.subRow(it.s, listed, now, W)
          : compact ? this.daemonCompact(it.r, now, W, calm) : this.daemon(it.r, sp, now, W, calm))));
  }

  // Logical size. Width: the sidebar's layout size (logical, whatever the zoom). Height: the measured
  // height scaled by the same factor the measured width is off by (on_size_change has been seen to
  // report zoomed px, the docs say logical; this works either way). True when it changed.
  resize() {
    let lw = null;
    try { lw = findNode(layout(), "sidebar")?.size?.px ?? null; } catch {}
    let k;
    if (lw > 0 && this.rawW > 0) k = this.rawW / lw;
    else { k = 1; try { k = Number(settings()?.zoom) || 1; } catch {} }
    if (!(k > 0.5 && k < 4)) k = 1;
    const w = lw > 0 ? lw : this.rawW / k, h = this.rawH / k;
    if (Math.round(w) === Math.round(this.w) && Math.round(h) === Math.round(this.h)) return false;
    this.w = w; this.h = h;
    return true;
  }

  // "▌01 // NODES 節点 ......... 05 [+]"
  head(num, label, kanji, count, W, pad, compact, plus) {
    const w = W + 2 * pad;
    const add = div().id("ph-space-new").flex_none().w(18).h(18).flex().items_center().justify_center()
      .border(1).border_color(P.grey).text_color(P.dim2).font_family(FONT_TERM).text_size(13).cursor_pointer()
      .hover((s) => s.border_color(P.dim2).text_color(P.fg)).tooltip("New space")
      .on_click(() => run("space.new")).child("+");
    return div().relative().flex_none().w(w).h(HEAD_H).mt(6).mb(4)
      .child(plate(w, HEAD_H, P.panel, { cut: 8, corners: "tr" }))
      .child(div().absolute().left(0).top(0).w(3).h(HEAD_H).bg(P.amber))
      .child(h_flex().absolute().left(0).top(0).w(w).h(HEAD_H).pl(compact ? 7 : 12).pr(compact ? 4 : 10).gap(compact ? 4 : 6).items_center()
        .child(div().flex_none().text_color(P.amber).child(num))
        .when(!compact, (el) => el
          .child(div().flex_none().text_color(P.grey).child("//"))
          .child(div().flex_none().text_color(P.dim2).child(label)))
        .when(!compact || w >= 70, (el) => el.child(div().flex_none().font_family(FONT_JP).text_size(12).text_color(P.dim).child(kanji)))
        .child(div().flex_1())
        .when(!compact || w >= 100, (el) => el.child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(P.amber).child(pad2(count))))
        .when(plus && (!compact || w >= 50), (el) => el.child(add)));
  }

  // One space: index, name, branch / ahead / behind, one pip per agent. Active = inverse amber plate.
  // Click selects, right-click opens the space menu, drag onto another node moves it there.
  node({ s, tree }, g, statuses, W, compact, sp) {
    const on = s.active;
    const ink = on ? P.void : null;
    const pipRoom = compact ? Math.max(0, Math.floor((W - 26) / 10)) : Math.max(1, Math.min(12, Math.floor(W * 0.3 / 10)));
    const { shown, more } = fitPips(statuses, pipRoom);
    const pipEls = shown.map((st, i) => div().flex_none().w(8).h(8).bg(stateOf(st).color)
      .when(on, (el) => el.border(1).border_color(P.void)).id(`pip-${s.id}-${i}`));
    const from = this.pressed === null ? -1 : sp.findIndex((x) => x.id === this.pressed);
    const here = sp.findIndex((x) => x.id === s.id);
    const dropping = this.pressed !== null && this.over === s.id && this.pressed !== s.id;
    let row = h_flex().id(`ph-node-${s.id}`).relative().flex_none().w(W).h(NODE_H).cursor_pointer()
      .when(!on, (el) => el.hover((st) => st.bg(P.panel)))
      .when(this.pressed === s.id && this.over !== s.id, (el) => el.opacity(0.5))
      .on_mouse_down("left", () => { this.pressed = s.id; this.over = s.id; })
      .on_mouse_move((_e, cx) => {
        const src = sp.find((x) => x.id === this.pressed);
        const over = src && (src.machine ?? null) === (s.machine ?? null) ? s.id : null;
        if (this.pressed !== null && this.over !== over) { this.over = over; cx.notify(); }
      })
      .on_mouse_up("left", (_e, cx) => {
        const src = this.pressed, over = this.over;
        this.pressed = null; this.over = null;
        if (src !== null && over === s.id && src !== s.id) {
          const index = spaces().findIndex((x) => x.id === s.id);
          if (index !== -1) run("space.move", { id: src, index: index + 1 });
        } else if (src === s.id) run("space.select", { id: s.id });
        cx.notify();
      })
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }));
    if (on) row = row.child(plate(W, NODE_H, P.amber, { cut: 0 }));
    if (dropping) row = row.child(div().absolute().left(0).w(W).h(2).bg(P.amber).when(from < here, (el) => el.bottom(0)).when(from > here, (el) => el.top(0)));
    const body = h_flex().absolute().left(0).top(0).w(W).h(NODE_H).px(compact ? 4 : 8).gap(compact ? 4 : 8).items_center()
      .child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(ink ?? P.dim2).child(pad2(s.index)));
    if (compact) {
      return row.child(body.child(h_flex().flex_1().min_w(0).gap(2).justify_end().children(pipEls)));
    }
    const bits = gitBits(g?.branch ?? s.branch, g);
    return row.child(body
      .when(Boolean(tree), (el) => el.child(div().flex_none().font_family(FONT_TERM).text_size(12).text_color(ink ?? P.grey).child(tree)))
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

  pinToggle(a) {
    return (_e, cx) => { run("terminal.pin", { terminal: a.address, pinned: !a.pinned }); cx?.notify?.(); };
  }

  // Two-line daemon row. Right-click pins/unpins.
  daemon({ a }, sp, now, W, calm) {
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
      .on_mouse_down("right", this.pinToggle(a))
      .tooltip(a.pinned ? "Right-click: unpin" : "Right-click: pin to the top")
      .hover((s) => s.opacity(0.92));
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
      .when(Boolean(a.pinned), (el) => el.child(this.pinMark()))
      .child(h_flex().flex_shrink(1).min_w(0).overflow_hidden().text_size(14)
        .child(div().flex_none().text_color(nameInk).child(progName(a)))
        .child(div().flex_none().text_color(P.grey).child("@"))
        .child(div().flex_none().text_color(a.focused ? P.amber : nameInk).child(a.address)))
      .child(div().flex_none().font_family(FONT_JP).text_size(12).text_color(st.color).child(st.kanji))
      .child(div().flex_1())
      .child(div().flex_none().font_family(FONT_NUM).text_size(20).text_color(st.color)
        .child(fmtMin(this.clock.elapsed(a.address, now))))
      .child(bars(barLevel(a.status), st.color, { on: working, calm, h: 12, bw: 3, gap: 2, off: P.grey }));
    const line2 = h_flex().w_full().h(18).gap(8).items_center()
      .child(h_flex().flex_1().min_w(0).gap(2).items_center()
        .child(div().flex_shrink(1).min_w(0).truncate().text_size(12).text_color(idle ? P.dim : P.dim2).child(a.title || "—"))
        .when(working, (el) => el.child(cursor(true, { color: P.aqua, size: 12, calm }).flex_none())))
      .child(div().flex_none().max_w(Math.round(W * 0.45)).truncate().text_size(11).text_color(P.dim).child(homeNode(a, sp)));
    return row.child(v_flex().absolute().left(0).top(0).w(W).h(ROW_H).pl(edge + 9).pr(10).py(3).justify_center()
      .child(line1).child(line2));
  }

  pinMark() {
    return div().flex_none().px(3).h(14).flex().items_center().border(1).border_color(P.dim2)
      .font_family(FONT_TERM).text_size(9).text_color(P.dim2).child("PIN");
  }

  // A sub-agent under its parent: tree glyphs, short tag, name, minutes in state. Still (no loops).
  subRow(s, listed, now, W) {
    const k = s.t;
    const status = kidStatus(k, listed);
    const st = stateOf(status);
    const blocked = st.key === "blocked";
    const hasPane = listed.has(k.address);
    return h_flex().id(`ph-sub-${k.address}`).relative().flex_none().w(W).h(SUB_H).mt(-2).mb(ROW_GAP).pl(10).pr(10).gap(6)
      .items_center().cursor_pointer()
      .when(blocked, (el) => el.bg(alpha(P.red, 0.14)))
      .hover((x) => x.bg(P.panel))
      .tooltip(hasPane ? `Focus ${k.address}` : `Peek ${k.address}`)
      .on_click(() => run(hasPane ? "agent.focus" : "terminal.peek", { terminal: k.address }))
      .child(div().flex_none().font_family(FONT_TERM).text_size(12).text_color(P.grey).child(treeText(s.lines)))
      .child(div().flex_none().w(36).font_family(FONT_TERM).text_size(11)
        .text_color(st.color).when(blocked, (el) => el.font_weight(700)).child(st.short))
      .child(div().flex_shrink(1).min_w(0).truncate().text_size(12).text_color(st.key === "idle" ? P.dim2 : P.fg).child(kidName(k)))
      .child(div().flex_none().text_size(11).text_color(P.dim).child(`@${k.address}`))
      .child(div().flex_1())
      .child(div().flex_none().font_family(FONT_NUM).text_size(17).text_color(st.color).child(fmtMin(this.clock.elapsed(k.address, now))));
  }

  // Rail row (< 160 px): edge + short tag + address, one line. The edge shows the most urgent of it and its sub-agents.
  daemonCompact({ a, eff }, now, W, calm) {
    const st = stateOf(eff);
    const blocked = st.key === "blocked";
    const H = 22;
    let row = div().id(`ph-daemon-${a.address}`).relative().flex_none().w(W).h(H).mb(3).cursor_pointer()
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", this.pinToggle(a));
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
        .text_color(st.color).child(fmtMin(this.clock.elapsed(a.address, now))))));
  }

  empty(compact) {
    return div().px(compact ? 2 : 10).py(6).text_size(12).text_color(P.dim)
      .child(compact ? "--" : "-- no daemons running");
  }
}

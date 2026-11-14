// ph-status: PHOSPHOR's 22 px vim-style status line (layout block `status`). Still: nothing moves here.
//
//  left : amber NORMAL block (cut corner) · daemons N · RUN n WAIT n OK n IDLE n (state colours, zero = grey;
//         WAIT is clickable while > 0 → ph-kit.respond = jump to the oldest blocked agent)
//         · focused pane: addr @machine › prog  ~/cwd  git:branch ↑ahead ↓behind +dirty
//  right: key hints from keys() (palette = cmd, clickable; respond = jump-to-WAIT) // MOTION ON|CALM // HH:MM
//
// Data: agents()/panes()/focused()/spaces() re-render by themselves. Git ahead/dirty comes from
// `git status --porcelain=v2 --branch` in the focused cwd (on the space's machine). There is no poll:
// render() checks (in JS, no redraw) whether a read is due — the focused cwd changed, or the last read is
// older than 15 s (60 s on another machine) — and if so starts one on a 0 ms timer. Renders already come
// with every focus/pane/agent change and the minute clock. A read that fails is not retried until the
// cwd changes. The view redraws only when the shown result changes. The clock redraws on the minute.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, panes, focused, spaces, run, exec, home, keys } from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_TERM, STATES } from "./lib/palette.js";
import { intensity } from "./lib/motion.js";
import { plate } from "./lib/plate.js";
import { parseGitStatus, shortPath, counts, clock, msToNextMinute, gitSuffix, gitKeyOf, needGit, keyFor } from "./status.js";

const H = 22;
const KEY_PALETTE = "ctrl-shift-p";   // fallback; keys.json global → app.palette
const KEY_RESPOND = "ctrl-shift-u";   // fallback; keys.json layout:phosphor → ph-kit.respond
const ORDER = ["working", "blocked", "done", "idle"]; // RUN WAIT OK IDLE

export default class PhStatus extends View {
  init(_props, cx) {
    this.now = new Date();
    this.git = null;      // { key, branch, ahead, behind, dirty } of the last finished read
    this.st = { key: null, at: 0, busy: false, errKey: null }; // see needGit
    this.queued = false;  // a 0 ms timer to start a read is pending
    try { this.home = home(); } catch { this.home = null; }
    // clock: once on the next minute, then every minute
    cx.timer.after(msToNextMinute(this.now), (cx) => {
      this.now = new Date(); cx.notify();
      cx.timer.every(60000, (cx) => { this.now = new Date(); cx.notify(); });
    });
  }

  // where the keyboard is: { addr, prog, cwd, branch, machine }
  where() {
    let f = null, ps = [], ss = [];
    try { f = focused(); ps = panes() ?? []; ss = spaces() ?? []; } catch { /* nothing yet */ }
    if (!f) return null;
    const pane = (f.pane && ps.find((p) => p.pane === f.pane)) || (f.terminal && ps.find((p) => p.terminal === f.terminal)) || null;
    const machine = ss.find((s) => s.id === f.space)?.machine ?? null;
    const addr = f.terminal ?? pane?.terminal ?? null;
    if (!addr && !pane) return null;
    return {
      addr, machine,
      prog: pane?.program?.key && pane.program.key !== "program" ? pane.program.key : pane?.program?.name ?? pane?.mod ?? "",
      cwd: f.cwd ?? pane?.cwd ?? null,
      branch: pane?.branch ?? null,
    };
  }

  // from render: start a git read on a 0 ms timer if one is due (deduplicated; no notify here)
  wantGit(w, cx) {
    if (this.queued || !needGit(this.st, gitKeyOf(w), Date.now(), Boolean(w?.machine))) return;
    this.queued = true;
    cx.timer.after(0, (cx) => { this.queued = false; this.lookGit(cx); });
  }

  lookGit(cx) {
    const w = this.where();
    const key = gitKeyOf(w);
    if (!needGit(this.st, key, Date.now(), Boolean(w?.machine))) return;
    this.st = { ...this.st, key, at: Date.now(), busy: true };
    cx.spawn(async (cx) => {
      let g = null, failed = false;
      try {
        const r = await exec("git", ["status", "--porcelain=v2", "--branch"], { cwd: w.cwd, on: w.machine, timeout: 3000 });
        if (r.code === 0) g = { key, ...parseGitStatus(r.stdout) };
        else failed = true;   // not a repo (or git refused): nothing to show until the cwd changes
      } catch { failed = true; } // exec error / timeout / machine unreachable: don't retry this cwd
      this.st = { ...this.st, busy: false, errKey: failed ? key : (this.st.errKey === key ? null : this.st.errKey) };
      const old = this.git;
      if (!(g === null && old === null) && JSON.stringify(old) !== JSON.stringify(g)) { this.git = g; cx.notify(); }
      // focus moved while this read ran: read the new cwd now instead of at the next stale point
      if (gitKeyOf(this.where()) !== key) this.lookGit(cx);
    });
  }

  sep() {
    return div().flex_none().text_color(P.grey).child("//");
  }

  keycap(k, label, color = P.grey) {
    return h_flex().flex_none().gap(5).items_center()
      .child(div().px(4).border(1).border_color(color).font_family(FONT_TERM).text_size(11).text_color(color === P.grey ? P.dim2 : color).child(k))
      .child(div().text_color(P.dim).child(label));
  }

  count(k, n) {
    const s = STATES[k];
    const on = n > 0;
    let el = h_flex().flex_none().gap(4).items_center()
      .child(div().text_color(on ? s.color : P.grey).child(s.short))
      .child(div().font_family(FONT_NUM).text_size(17).text_color(on ? s.color : P.grey).child(String(n)));
    if (k === "blocked" && on) {
      el = el.id("ph-status-wait").px(4).cursor_pointer().hover((st) => st.bg(P.panel2))
        .tooltip(`jump to the oldest WAIT (${this.keyRespond})`)
        .on_click((_e, cx) => { cx.stop_propagation(); run("ph-kit.respond"); });
    }
    return el;
  }

  focus(w) {
    if (!w) return div().flex_none().text_color(P.dim).child("no pane");
    const branch = w.branch ?? this.git?.branch ?? null;
    const suffix = this.git && this.git.key === gitKeyOf(w) ? gitSuffix(this.git) : "";
    return h_flex().min_w(0).gap(8).items_center().overflow_hidden()
      .when(Boolean(w.addr), (el) => el.child(div().flex_none().text_color(P.amber).child(w.addr)))
      .when(Boolean(w.machine), (el) => el.child(div().flex_none().text_color(P.dim2).child(`@${w.machine}`)))
      .when(Boolean(w.prog), (el) => el
        .child(div().flex_none().font_family(FONT_TERM).text_size(11).text_color(P.dim).child("›"))
        .child(div().flex_none().text_color(P.fg).child(w.prog)))
      .when(Boolean(w.cwd), (el) => el.child(div().min_w(0).truncate().text_color(P.dim2).child(shortPath(w.cwd, this.home))))
      .when(Boolean(branch), (el) => el.child(h_flex().flex_none()
        .child(div().text_color(P.dim).child("git:"))
        .child(div().text_color(P.fg).child(branch))))
      .when(Boolean(suffix), (el) => el.child(div().flex_none().font_family(FONT_TERM).text_size(11).text_color(P.dim2).child(suffix)));
  }

  render(cx) {
    let list = [], ks = [];
    try { list = agents() ?? []; } catch { /* nothing yet */ }
    const c = counts(list);
    const calm = intensity() === "calm";
    try { ks = keys() ?? []; } catch { /* no keys yet */ }
    const keyPalette = keyFor(ks, "app.palette", "global", KEY_PALETTE);
    this.keyRespond = keyFor(ks, "ph-kit.respond", "layout:phosphor", KEY_RESPOND);
    const w = this.where();
    this.wantGit(w, cx);
    return h_flex().id("ph-status").size_full().items_center().gap(14).bg(P.void).border_t(1).border_color(P.line)
      .font_family(FONT_UI).text_size(12).text_color(P.dim2).overflow_hidden()
      // NORMAL: amber plate, bottom-right corner cut
      .child(div().relative().flex_none().w(84).h(H)
        .child(plate(84, H, P.amber, { cut: 8, corners: "br" }))
        .child(div().absolute().left(0).top(0).w(84).h(H).flex().items_center().pl(10)
          .text_color(P.void).child("NORMAL")))
      .child(h_flex().flex_none().gap(5).items_center()
        .child(div().text_color(P.dim).child("daemons"))
        .child(div().font_family(FONT_NUM).text_size(17).text_color(P.fg).child(String(list.length))))
      .child(h_flex().flex_none().gap(10).items_center().children(ORDER.map((k) => this.count(k, c[k]))))
      .child(this.sep())
      .child(div().flex_1().min_w(0).child(this.focus(w)))
      .child(this.keycap(keyPalette, "cmd").id("ph-status-palette").cursor_pointer().tooltip("command palette")
        .on_click((_e, cx) => { cx.stop_propagation(); run("app.palette"); }))
      .child(this.keycap(this.keyRespond, "jump-to-WAIT", c.blocked > 0 ? P.red : P.grey))
      .child(this.sep())
      .child(h_flex().flex_none().gap(5)
        .child(div().text_color(P.dim).child("MOTION"))
        .child(div().text_color(calm ? P.fg : P.dim2).child(calm ? "CALM" : "ON")))
      .child(this.sep())
      .child(div().flex_none().pr(12).font_family(FONT_NUM).text_size(18).text_color(P.fg).child(clock(this.now)));
  }
}

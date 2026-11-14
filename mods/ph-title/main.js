// PHOSPHOR title bar (24px, in a window_drag block; layout titlebar:"none").
//   left   HERDR/OS wordmark plate + version, TTY tag, dim shell echo
//   centre while an agent is blocked: red alert strip 要求 N DAEMON(S) NEEDS YOU … <key> RESPOND (click = respond)
//          otherwise a dim summary  // 5 daemons · 1 RUN · 1 OK · 1 IDLE
//   right  UPLINK (machines' state), clock (VT323), Linux window buttons
// Also opens the once-per-run boot overlay (ph-boot) unless calm: that block belongs to the boot builder.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, window as win, openOverlay, agents, keys, machines, updates } from "herdr";
import { P, FONT_MARK, FONT_JP, FONT_UI, FONT_NUM, FONT_TERM, STATES, alpha } from "./lib/palette.js";
import { isCalm, blink } from "./lib/motion.js";
import { plate, outline, hazard } from "./lib/plate.js";
import { summary, alertText, clockText, respondKey, uplink } from "./text.js";

const H = 24;

export default class PhTitle extends View {
  init(_props, cx) {
    // sessionStorage lives for this run of the app only: boot shows once per run, not per layout switch.
    let shown = null;
    try { shown = sessionStorage.getItem("ph.boot"); } catch {}
    if (!shown && !isCalm()) {
      try { sessionStorage.setItem("ph.boot", String(Date.now())); } catch {}
      cx.timer.after(0, () => openOverlay({ mod: "ph-boot", kind: "window", frame: "none", width: 1, height: 1, at: { x: 0, y: 0 } }));
    }
    // Clock: one redraw per second in full (the mockup shows seconds), once a minute in calm.
    // Chained after() calls aligned to the boundary, so the readout never lags or drifts.
    this.now = new Date();
    const tick = (cx) => {
      this.now = new Date();
      cx.notify();
      cx.timer.after(this.wait(), tick);
    };
    cx.timer.after(this.wait(), tick);
  }

  wait() {
    const ms = Date.now();
    const step = isCalm() ? 60000 : 1000;
    return step - (ms % step) + 5;
  }

  respond(blocked) {
    try { run("ph-kit.respond"); return; } catch {}
    const a = blocked.slice().sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0))[0];
    if (a) run("agent.focus", { terminal: a.address });
  }

  left() {
    let ver = null;
    try { ver = updates()?.app?.version ?? null; } catch {}
    return h_flex().h_full().flex_none().items_center()
      // Wordmark plate: amber = "you are here". Cut corner bottom-right, as in the mockup.
      .child(div().relative().w(132).h(H).flex_none()
        .child(plate(132, H, P.amber, { cut: 8, corners: "br" }))
        .child(h_flex().absolute().left(0).top(0).w(132).h(H).pl(10).gap(6).items_center().text_color(P.void)
          .child(div().font_family(FONT_MARK).text_size(13).child("HERDR/OS"))
          .child(div().font_family(FONT_JP).text_size(12).child("端末"))))
      .when(Boolean(ver), (el) => el.child(div().pl(8).font_family(FONT_NUM).text_size(16).text_color(P.dim).child(`v${ver}`)))
      .child(h_flex().pl(10).gap(5).items_center().text_size(12).text_color(P.dim)
        .child(div().px(4).border(1).border_color(P.line).text_color(P.dim2).child("TTY0"))
        .child(div().child("·"))
        .child(div().child("phosphor")))
      .child(h_flex().pl(14).gap(0).items_center().text_size(12).text_color(P.grey).flex_none()
        .child(div().child("root@herdr:~# watch --daemons")));
  }

  alert(blocked, calm) {
    const t = alertText(blocked, respondKey(keys()));
    const band = (id, corners) => blink(div().id(id).relative().w(44).h(H - 4).flex_none()
      .child(hazard(44, H - 4, P.red, { calm, cut: 6, corners, stripe: 3, interval: 7 })), true, { calm });
    return h_flex().id("ph-alert").h(H - 4).flex_1().min_w(0).max_w(1500).items_center().cursor_pointer()
      .bg(alpha(P.red, 0.12)).border(1).border_color(alpha(P.red, 0.75)).hover((s) => s.bg(alpha(P.red, 0.2)))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { cx.stop_propagation(); this.respond(blocked); })
      .child(band("ph-alert-l", "tl"))
      .child(h_flex().flex_1().min_w(0).px(10).gap(8).items_center().text_size(12.5).overflow_hidden()
        .child(div().flex_none().font_family(FONT_TERM).text_size(10).text_color(P.red).child("▲"))
        .child(div().flex_none().font_family(FONT_JP).text_size(13).text_color(P.red).child("要求"))
        .child(div().flex_none().text_color(P.red).child(t.head))
        .child(div().flex_none().text_color(P.grey).child("//"))
        .child(div().flex_none().text_color(P.fg).child(t.who))
        .child(div().flex_1().min_w(0).truncate().text_color(P.dim2).child(t.what))
        .child(div().flex_none().text_color(alpha(P.red, 0.8)).child(t.key))
        .child(div().flex_none().text_color(P.red).child("RESPOND ›")))
      .child(band("ph-alert-r", "br"));
  }

  quiet(list) {
    const s = summary(list);
    return h_flex().gap(6).items_center().text_size(12).text_color(P.grey)
      .child(div().child("//"))
      .child(div().text_color(P.dim).child(s.total))
      .children(s.parts.map((p) => h_flex().gap(6)
        .child(div().child("·"))
        .child(div().text_color(STATES[p.key].color).child(`${p.n} ${STATES[p.key].short}`))));
  }

  right(w) {
    const up = uplink(machines());
    const btn = (id, label, cmd) => div().id(id).relative().w(30).h(18).flex_none().cursor_pointer()
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { cx.stop_propagation(); run(cmd); })
      .child(outline(30, 18, id === "ph-close" ? alpha(P.red, 0.6) : P.grey, { cut: 5, corners: "br" }))
      .child(div().absolute().left(0).top(0).w(30).h(18).flex().items_center().justify_center()
        .font_family(FONT_TERM).text_size(11).text_color(P.dim2)
        .hover((s) => s.text_color(id === "ph-close" ? P.red : P.fg)).child(label));
    return h_flex().h_full().flex_none().gap(14).pr(6).items_center()
      .child(h_flex().gap(5).items_center().text_size(12)
        .child(div().text_color(P.dim).child("UPLINK"))
        .child(div().text_color(up.ok ? P.dim2 : P.red).child(up.label)))
      .child(div().font_family(FONT_NUM).text_size(21).text_color(P.fg).child(clockText(this.now, isCalm())))
      // Linux: window().buttons can be false (some WMs) yet titlebar:none leaves no buttons at all, so draw them.
      .when(Boolean(w?.buttons || w?.platform === "linux"), (el) => el.child(h_flex().gap(4).items_center()
        .child(btn("ph-min", "_", "window.minimize"))
        .child(btn("ph-max", w.maximized ? "❐" : "□", "window.maximize"))
        .child(btn("ph-close", "×", "window.close"))));
  }

  render() {
    const w = win();
    const calm = isCalm();
    const list = agents() ?? [];
    const blocked = list.filter((a) => a.status === "blocked");
    return h_flex().id("ph-title").size_full().items_center().bg(P.void).border_b(1).border_color(P.line)
      .font_family(FONT_UI).text_color(P.fg)
      .child(this.left())
      .child(h_flex().flex_1().min_w(0).h_full().px(16).items_center().justify_center()
        .child(blocked.length ? this.alert(blocked, calm) : this.quiet(list)))
      .child(this.right(w));
  }
}

// PHOSPHOR title bar (24px, in a window_drag block; layout titlebar:"none").
//   left   HERDR/OS wordmark plate + version, TTY tag, dim shell echo
//   centre while an agent is blocked: red alert strip 要求 N DAEMON(S) NEEDS YOU … <key> RESPOND (click = respond)
//          otherwise a dim summary  // 5 daemons · 1 RUN · 1 OK · 1 IDLE
//   right  UPLINK (machines' state), clock (VT323), Linux window buttons
// Also opens the once-per-run boot overlay (ph-boot) unless calm: that block belongs to the boot builder.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, window as win, openOverlay, agents, spaces, keys, machines, updates, layout, settings } from "herdr";
import { P, FONT_MARK, FONT_JP, FONT_UI, FONT_NUM, FONT_TERM, STATES, alpha } from "./lib/palette.js";
import { isCalm, blink } from "./lib/motion.js";
import { plate, outline, hazard } from "./lib/plate.js";
import { Since, tabSeed, oldestBlocked } from "./lib/since.js";
import { summary, alertText, clockText, respondKey, uplink } from "./text.js";

let bootOpened = false; // sessionStorage is per mod copy (tested live); ph-boot owns the real per-process guard

const H = 24;

export default class PhTitle extends View {
  init(_props, cx) {
    if (!bootOpened && !isCalm()) {
      bootOpened = true;
      cx.timer.after(0, () => openOverlay({ mod: "ph-boot", kind: "window", frame: "none", width: 1, height: 1, at: { x: 0, y: 0 } }));
    }
    // Same tracker as ph-kit.respond, so the strip names the agent the click/key will focus.
    this.since = new Since();
    // Clock: HH:MM in every intensity (idle = still), one redraw a minute via chained after() calls
    // aligned to the minute boundary. render() reads the time itself, so any redraw (e.g. a calm/full
    // switch) shows the current minute and nothing goes stale.
    const tick = (cx) => {
      cx.notify();
      cx.timer.after(untilNextMinute(), tick);
    };
    cx.timer.after(untilNextMinute(), tick);
  }

  respond(target) {
    try { run("ph-kit.respond"); return; } catch {}
    if (target) run("agent.focus", { terminal: target.address });
  }

  left(w) {
    let ver = null;
    try { ver = updates()?.app?.version ?? null; } catch {}
    // macOS with titlebar:none: the traffic lights sit in this row, so clear them (as the shipped tabs mod does).
    let lights = 0;
    try {
      const tl = layout()?.traffic_lights;
      if (w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && tl) lights = (tl[0] + 64) / (settings()?.zoom || 1);
    } catch {}
    // The wordmark + version never shrink; only the TTY tag and the echo give way (fast: shrink 50 vs the centre's 1).
    return [h_flex().h_full().flex_none().pl(lights).items_center()
      // Wordmark plate: amber = "you are here". Cut corner bottom-right, as in the mockup.
      .child(div().relative().w(132).h(H).flex_none()
        .child(plate(132, H, P.amber, { cut: 8, corners: "br" }))
        .child(h_flex().absolute().left(0).top(0).w(132).h(H).pl(10).gap(6).items_center().text_color(P.void)
          .child(div().font_family(FONT_MARK).text_size(13).child("HERDR/OS"))
          .child(div().font_family(FONT_JP).text_size(12).child("端末"))))
      .when(Boolean(ver), (el) => el.child(div().pl(8).flex_none().font_family(FONT_NUM).text_size(16).text_color(P.dim).child(`v${ver}`)))
      ,
      // TTY tag and echo shrink (then vanish) before the summary/UPLINK/clock are touched.
      h_flex().h_full().flex_shrink(50).min_w(0).overflow_hidden().items_center()
      .child(h_flex().pl(10).gap(5).flex_shrink(1).min_w(0).overflow_hidden().items_center().text_size(12).text_color(P.dim)
        .child(div().flex_none().px(4).border(1).border_color(P.line).text_color(P.dim2).child("TTY0"))
        .child(div().child("·"))
        .child(div().min_w(0).truncate().child("phosphor")))
      .child(h_flex().pl(14).gap(0).items_center().text_size(12).text_color(P.grey).flex_shrink(4).min_w(0).overflow_hidden()
        .child(div().min_w(0).truncate().child("root@herdr:~# watch --daemons")))];
  }

  alert(blocked, target, calm) {
    const t = alertText(blocked, respondKey(keys()), target);
    const band = (id, corners) => blink(div().id(id).relative().w(44).h(H - 4).flex_none()
      .child(hazard(44, H - 4, P.red, { calm, cut: 6, corners, stripe: 3, interval: 7 })), true, { calm });
    return h_flex().id("ph-alert").h(H - 4).flex_1().min_w(0).max_w(1500).items_center().cursor_pointer()
      .bg(alpha(P.red, 0.12)).border(1).border_color(alpha(P.red, 0.75)).hover((s) => s.bg(alpha(P.red, 0.2)))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { cx.stop_propagation(); this.respond(target); })
      .child(band("ph-alert-l", "tl"))
      // Narrow: the what-part goes first, then the agent name and head truncate; key + RESPOND stay.
      .child(h_flex().flex_1().min_w(0).px(10).gap(8).items_center().text_size(12.5).overflow_hidden()
        .child(div().flex_none().font_family(FONT_TERM).text_size(10).text_color(P.red).child("▲"))
        .child(div().flex_none().font_family(FONT_JP).text_size(13).text_color(P.red).child("要求"))
        .child(div().flex_shrink(1).min_w(0).truncate().text_color(P.red).child(t.head))
        .child(div().flex_none().text_color(P.grey).child("//"))
        .child(div().flex_shrink(2).min_w(0).truncate().text_color(P.fg).child(t.who))
        .child(div().flex_1().flex_shrink(100).min_w(0).truncate().text_color(P.dim2).child(t.what))
        .child(div().flex_none().text_color(alpha(P.red, 0.8)).child(t.key))
        .child(div().flex_none().text_color(P.red).child("RESPOND ›")))
      .child(band("ph-alert-r", "br"));
  }

  quiet(list) {
    const s = summary(list);
    return h_flex().min_w(0).overflow_hidden().gap(6).items_center().text_size(12).text_color(P.grey)
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
      .child(div().font_family(FONT_NUM).text_size(21).text_color(P.fg).child(clockText(new Date(), true)))
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
    this.since.observe(list, Date.now(), tabSeed(spaces()));
    const blocked = list.filter((a) => a.status === "blocked");
    const target = oldestBlocked(list, this.since);
    return h_flex().id("ph-title").size_full().items_center().bg(P.void).border_b(1).border_color(P.line)
      .font_family(FONT_UI).text_color(P.fg)
      .children(this.left(w))
      .child(h_flex().flex_auto().min_w(0).h_full().px(16).items_center().justify_center().overflow_hidden()
        .child(blocked.length ? this.alert(blocked, target, calm) : this.quiet(list)))
      .child(this.right(w));
  }
}

/** ms until just past the next minute boundary. */
function untilNextMinute(ms = Date.now()) { return 60000 - (ms % 60000) + 5; }

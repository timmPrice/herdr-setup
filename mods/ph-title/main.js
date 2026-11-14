// STUB (feature: title builder). Custom title bar in a window_drag block: HERDR/OS wordmark, window buttons.
// Also opens the once-per-run boot overlay (ph-boot) unless calm.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, window as win, openOverlay } from "herdr";
import { P, FONT_MARK, FONT_JP, FONT_UI } from "./lib/palette.js";
import { isCalm } from "./lib/motion.js";

export default class PhTitle extends View {
  init(_props, cx) {
    // sessionStorage lives for this run of the app only: boot shows once per run, not per layout switch.
    let shown = null;
    try { shown = sessionStorage.getItem("ph.boot"); } catch {}
    if (!shown && !isCalm()) {
      try { sessionStorage.setItem("ph.boot", String(Date.now())); } catch {}
      cx.timer.after(0, () => openOverlay({ mod: "ph-boot", kind: "window", frame: "none", width: 1, height: 1, at: { x: 0, y: 0 } }));
    }
  }

  render() {
    const w = win();
    const stop = (_e, cx) => cx.stop_propagation();
    const btn = (id, label, cmd) => div().id(id).w(28).h_full().flex().items_center().justify_center()
      .text_color(P.dim2).hover((s) => s.bg(P.panel2).text_color(P.fg))
      .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run(cmd); }).child(label);
    return h_flex().id("ph-title").size_full().items_center().bg(P.void).border_b(1).border_color(P.line).font_family(FONT_UI).text_size(13)
      .child(h_flex().h_full().px(10).gap(6).items_center().bg(P.amber).text_color(P.void)
        .child(div().font_family(FONT_MARK).text_size(14).child("HERDR/OS"))
        .child(div().font_family(FONT_JP).text_size(12).child("端末")))
      .child(div().flex_1())
      // Linux: window().buttons can be false (some WMs) yet titlebar:none leaves no buttons at all, so draw them.
      .when(Boolean(w?.buttons || w?.platform === "linux"), (el) => el
        .child(btn("ph-min", "_", "window.minimize"))
        .child(btn("ph-max", w.maximized ? "▫" : "□", "window.maximize"))
        .child(btn("ph-close", "×", "window.close")));
  }
}

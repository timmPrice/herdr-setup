// nk-toast (skeleton stub): notifications for the neo-kyoto layout (root "toast": "nk-toast").
// Props from the app: { title, body, level, icon, action, timeout, overlay }.
// Behaves like the shipped toast: click runs the action and dismisses. Also closes itself
// after `timeout` ms (default 6000). The hanko-toast feature replaces this file.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme } from "herdr";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };
const DEFAULT_TIMEOUT = 6000;

export default class NkToast extends View {
  init(_props, cx) {
    const p = props() ?? {};
    const ms = typeof p.timeout === "number" && p.timeout > 0 ? p.timeout : DEFAULT_TIMEOUT;
    if (p.overlay) cx.timer.after(ms, () => closeOverlay(p.overlay));
  }

  render(cx) {
    const t = theme();
    const p = props() ?? {};
    return h_flex()
      .id("nk-toast")
      .size_full()
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(18).h(18).flex_none() : div().size(8).rounded(4).flex_none().bg(t[DOT[p.level] ?? "accent"]))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().font_semibold().text_size(13).text_color(t.foreground).child(p.title ?? ""))
          .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? ""))),
      );
  }
}

// STUB (feature: status builder). Toast: title + body, click runs the action. Like the shipped toast it
// never closes itself on timeout: Herdr closes it.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay, run } from "herdr";
import { P, FONT_UI } from "./lib/palette.js";

const COLOR = { error: P.red, warning: P.red, success: P.green, info: P.amber };

export default class PhToast extends View {
  render() {
    const p = props() ?? {};
    return h_flex().id("ph-toast").size_full().px(16).gap(12).items_center().bg(P.panel)
      .border(1).border_color(COLOR[p.level] ?? P.amber).font_family(FONT_UI).cursor_pointer()
      .on_click(() => { if (p.action?.name) run(p.action.name, p.action.args ?? {}); closeOverlay(p.overlay); })
      .child(v_flex().flex_1().overflow_hidden()
        .child(div().truncate().text_size(13).text_color(P.fg).child(p.title ?? ""))
        .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(P.dim2).child(p.body))));
  }
}

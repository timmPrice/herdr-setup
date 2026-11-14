// STUB (feature: pane header builder). Title + split/zoom/close; amber when focused.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run } from "herdr";
import { P, FONT_UI, stateOf } from "./lib/palette.js";

export default class PhPane extends View {
  render() {
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const pane = p.pane, st = stateOf(p.status);
    const btn = (id, label, cmd, args) => div().id(`${id}-${pane}`).px(4).text_color(P.dim)
      .hover((s) => s.text_color(P.fg)).on_click((_e, cx) => { cx.stop_propagation(); run(cmd, args); }).child(label);
    return h_flex().id(`ph-head-${pane}`).size_full().px(8).gap(8).items_center().bg(P.pane)
      .border_b(1).border_color(P.line).font_family(FONT_UI).text_size(12.5)
      .on_click(() => run("pane.focus", { pane }))
      .child(div().text_color(st.color).child(st.tag))
      .child(div().text_color(p.focused ? P.amber : P.dim2).child(p.terminal ?? p.mod ?? ""))
      .child(div().flex_1().truncate().text_color(P.fg).child(p.title || p.program?.name || "shell"))
      .child(btn("ph-r", "⇥", "pane.split", { direction: "right", pane }))
      .child(btn("ph-d", "⤓", "pane.split", { direction: "down", pane }))
      .child(btn("ph-z", p.zoomed ? "▭" : "▢", "pane.zoom", { pane }))
      .child(btn("ph-x", "×", "pane.close", { pane }));
  }
}

// STUB (feature: status builder). Vim-style status line: counts per state.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents } from "herdr";
import { P, FONT_UI, STATES } from "./lib/palette.js";
import { intensity } from "./lib/motion.js";

export default class PhStatus extends View {
  render() {
    const list = agents();
    return h_flex().id("ph-status").size_full().gap(14).items_center().bg(P.void).border_t(1).border_color(P.line)
      .font_family(FONT_UI).text_size(12)
      .child(div().h_full().px(10).flex().items_center().bg(P.amber).text_color(P.void).child("NORMAL"))
      .children(["blocked", "done", "working", "idle"].map((k) =>
        div().text_color(STATES[k].color).child(`${STATES[k].short} ${list.filter((a) => a.status === k).length}`)))
      .child(div().flex_1())
      .child(div().pr(10).text_color(P.dim).child(`MOTION ${intensity() === "calm" ? "CALM" : "ON"}`));
  }
}

// STUB (feature: telemetry builder). Per-state counters only.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents } from "herdr";
import { P, FONT_UI, FONT_NUM, STATES } from "./lib/palette.js";

export default class PhTelemetry extends View {
  render() {
    const list = agents();
    const n = (k) => list.filter((a) => a.status === k).length;
    return v_flex().id("ph-telemetry").size_full().bg(P.void).border_t(1).border_color(P.line).font_family(FONT_UI).text_size(13)
      .child(div().px(10).pt(8).text_color(P.dim).child("03 // TELEMETRY 計測"))
      .child(h_flex().px(10).pt(6).gap(14).children(["working", "blocked", "done", "idle"].map((k) =>
        v_flex().child(div().font_family(FONT_NUM).text_size(26).text_color(STATES[k].color).child(String(n(k)).padStart(2, "0")))
          .child(div().text_size(11).text_color(P.dim).child(STATES[k].short)))));
  }
}

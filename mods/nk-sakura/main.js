// nk-sakura (skeleton stub): floating block, top right of the work area.
// Layout: floating { "id": "sakura", "content": { "mod": "nk-sakura", "props": { "intensity": "full" } } }
// The sakura feature replaces this file. Props: { intensity: "calm" | "full" } (default "full").

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { props } from "herdr";

const PINK = "#d3869b";
const GREY = "#928374";

export default class NkSakura extends View {
  render(cx) {
    const intensity = props()?.intensity === "calm" ? "calm" : "full";
    return h_flex()
      .id("nk-sakura")
      .px(10)
      .py(4)
      .gap(6)
      .items_center()
      .text_size(11)
      .child(div().size(8).rounded(4).bg(PINK))
      .child(div().text_color(GREY).child(`sakura · ${intensity}`));
  }
}

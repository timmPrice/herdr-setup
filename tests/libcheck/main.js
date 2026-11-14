// check.sh renders this once with `herdr-app check` (in a temp copy with lib/) so every lib helper
// is exercised by the real runtime, not just node stubs.
import { View, div } from "gpui-kit";
import { P } from "./lib/palette.js";
import { plate, outline, hazard, glowRule, glowOutline } from "./lib/plate.js";
import { blink, cursor, bars } from "./lib/motion.js";
import { Since, fmtDur } from "./lib/since.js";

export default class LibCheck extends View {
  render() {
    const box = (el) => div().relative().w(80).h(20).child(el);
    return div().id("root").size_full().flex().flex_col().gap(4)
      .child(box(plate(80, 20, P.aqua)))
      .child(box(outline(80, 20, P.amber, { corners: "tl tr br bl" })))
      .child(box(hazard(80, 20, P.red)))
      .child(box(hazard(80, 20, P.red, { calm: true })))
      .child(box(glowRule(80, P.amber)))
      .child(box(glowOutline(80, 20, P.amber, { calm: false })))
      .child(blink(div().child("WAIT"), true, { calm: false }))
      .child(cursor(true, { calm: false, color: P.aqua }))
      .child(bars(2, P.aqua, { on: true, calm: false }))
      .child(div().child(fmtDur(new Since().elapsed("t1"))));
  }
}

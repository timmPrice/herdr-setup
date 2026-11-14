// STUB (feature: sidebar builder). NODES (spaces) + DAEMONS (agents, most urgent first), plain.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, run, setAgentOrder } from "herdr";
import { P, FONT_UI, stateOf, byUrgency } from "./lib/palette.js";

export default class PhSide extends View {
  render() {
    const list = agents().slice().sort(byUrgency);
    try { setAgentOrder(list.map((a) => a.address)); } catch {}
    const head = (t) => div().px(10).pt(8).pb(4).text_color(P.dim).child(t);
    return v_flex().id("ph-side").size_full().bg(P.void).font_family(FONT_UI).text_size(13).overflow_y_scrollbar()
      .child(head("01 // NODES 節点"))
      .children(spaces().map((s) => div().id(`ph-node-${s.id}`).px(10).py(2)
        .text_color(s.active ? P.amber : P.dim2).on_click(() => run("space.select", { id: s.id }))
        .child(`${String(s.index + 1).padStart(2, "0")} ${s.name}`)))
      .child(head("02 // DAEMONS 常駐"))
      .children(list.map((a) => {
        const st = stateOf(a.status);
        return h_flex().id(`ph-agent-${a.address}`).px(10).py(2).gap(6)
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .child(div().text_color(st.color).child(st.tag))
          .child(div().flex_1().truncate().text_color(a.focused ? P.amber : P.fg).child(`${a.program?.name ?? a.app ?? "agent"}@${a.address}`));
      }));
  }
}

// STUB (feature: title builder). Tab bar: select/new/close tabs, Files/Changes panel buttons.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, run, layout, openOverlay } from "herdr";
import { P, FONT_UI } from "./lib/palette.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}

export default class PhTabs extends View {
  render() {
    const space = spaces().find((s) => s.active);
    const stop = (_e, cx) => cx.stop_propagation();
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    const panelBtn = (id, label) => {
      const on = panel && !panel.hidden && body?.active === id;
      return div().id(`ph-panel-${id}`).px(8).text_color(on ? P.amber : P.dim2).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(label);
    };
    return h_flex().id("ph-tabs").size_full().px(6).gap(4).items_center().bg(P.void).border_b(1).border_color(P.line)
      .font_family(FONT_UI).text_size(12.5)
      .children((space?.tabs ?? []).map((t) => h_flex().id(`ph-tab-${t.id}`).h(20).px(8).items_center()
        .bg(t.active ? P.amber : P.panel).text_color(t.active ? P.void : P.dim2)
        .on_mouse_down("left", stop).on_click(() => run("tab.select", { id: t.id }))
        .child(`${String(t.index).padStart(2, "0")}:${t.named ? t.name : "tab"}`)))
      .child(div().id("ph-tab-new").px(8).text_color(P.dim2).on_mouse_down("left", stop)
        .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })).child("+"))
      .child(div().flex_1())
      .child(panelBtn("files", "FILES"))
      .child(panelBtn("changes", "CHANGES"));
  }
}

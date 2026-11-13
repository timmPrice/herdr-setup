// nk-pane (skeleton stub): pane header for the neo-kyoto layout.
// Layout: "header": { "content": { "mod": "nk-pane", "props": { "intensity": "full" } } }
// Props from the app: { pane, terminal, intensity }. Shows the pane's name, folder and a
// status dot; click focuses the pane. The kanji-headers feature replaces this file.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class NkPane extends View {
  render(cx) {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const dot = t[p.status] ?? null;
    return h_flex()
      .id(`nk-pane-${p.pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .when(Boolean(dot), (el) => el.child(div().size(7).flex_none().rounded(4).bg(dot)))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(p.focused ? t.accent : t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)));
  }
}

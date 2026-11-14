// PHOSPHOR tab bar (26px, window_drag block): "1:build 2:review 3:ops +" terminal-style.
// Active tab = amber cut-corner plate; blocked = red marker (blinks in full), done = green, working = aqua (still).
// Right: NODE / git / PANES readout, FILES / CHANGES panel buttons.
// Mouse behaviour follows the shipped tabs mod (~/.config/herdr-app/mods/tabs): click selects, drag onto
// another tab moves it, double-click renames, right-click opens the tab menu, wheel = prev/next,
// plus middle-click closes. The side panel is remembered per space, as in the shipped mod.
import { View, div } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, layout, openOverlay, shared } from "herdr";
import { P, FONT_UI, FONT_TERM, FONT_NUM } from "./lib/palette.js";
import { isCalm, blink } from "./lib/motion.js";
import { plate, outline } from "./lib/plate.js";
import { tabLabel, estWidth } from "./text.js";

const TH = 20;

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}

export default class PhTabs extends View {
  init() {
    this.pressed = null;
    this.widths = {};
    this.scroll = ScrollHandle.new();
    try { this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}"); } catch { this.panels = {}; }
  }

  // Copied from the shipped tabs mod: the side panel is remembered per space. Switching shows that
  // space's choice (closed if it never had one); opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    try { localStorage.setItem("panels", JSON.stringify(this.panels)); } catch {}
  }

  marker(c, calm) {
    const color = c.status === "blocked" ? P.red : c.status === "done" ? P.green : c.status === "working" ? P.aqua : null;
    if (!color) return null;
    // On the amber plate a red/green square needs a dark rim to stay readable.
    const sq = div().id(`ph-mark-${c.id}`).size(7).flex_none().bg(color).border(1).border_color(c.active ? P.void : color);
    return c.status === "blocked" ? blink(sq, true, { calm }) : sq;
  }

  tab(c, i, shown, space, active, calm) {
    const pane = panes().find((p) => p.tab === c.id && p.program?.agent) ?? panes().find((p) => p.tab === c.id);
    const label = tabLabel(c, pane?.program?.name);
    const w = this.widths[c.id] ?? estWidth(label, c);
    const fg = c.active ? P.void : c.status === "blocked" ? P.fg : P.dim2;
    const mark = this.marker(c, calm);
    return div().id(`ph-tab-${c.id}`).relative().h(TH).flex_none().cursor_pointer()
      .on_size_change((size, cx) => {
        const nw = Math.round(size.width);
        if (nw > 0 && nw !== this.widths[c.id]) { this.widths[c.id] = nw; cx.notify(); }
        if (i <= active && active >= 0) this.scroll.scroll_to_item(active);
      })
      .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
      .on_mouse_up("left", () => {
        const from = this.pressed; this.pressed = null;
        if (from !== null && from !== i && shown[from]) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex((x) => x.id === c.id) + 1 });
        else run("tab.select", { id: c.id });
      })
      .on_mouse_down("middle", (_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); })
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
      .child(c.active ? plate(w, TH, P.amber, { cut: 6, corners: "tl br" })
        : outline(w, TH, c.status === "blocked" ? P.red : P.line, { cut: 6, corners: "tl br" }))
      .child(h_flex().h(TH).px(10).gap(6).items_center().text_size(13).text_color(fg)
        .hover((s) => s.text_color(c.active ? P.void : P.fg))
        .child(div().whitespace_nowrap().max_w(220).truncate().child(c.zoomed ? `${label} [Z]` : label))
        .when(Boolean(mark), (el) => el.child(mark))
        .when(c.active, (el) => el.child(div().id(`ph-close-${c.id}`).font_family(FONT_TERM).text_size(11).text_color(P.void)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child("×"))));
  }

  // Shrinks before the tab scroller is squeezed: the branch goes first, then the space name truncates.
  readout(space) {
    const n = space ? panes().filter((p) => space.tabs.some((t) => t.id === p.tab)).length : 0;
    const sep = () => div().flex_none().text_color(P.line).child("//");
    return h_flex().flex_shrink(1).min_w(0).overflow_hidden().gap(8).items_center().text_size(12).text_color(P.dim)
      .child(h_flex().flex_shrink(1).min_w(0).overflow_hidden().gap(5).child(div().flex_none().child("NODE"))
        .child(div().flex_none().font_family(FONT_NUM).text_size(16).text_color(P.dim2).child(String(space?.index ?? 0).padStart(2, "0")))
        .child(div().min_w(0).max_w(220).truncate().text_color(P.dim2).child(space?.name ?? "-")))
      .when(Boolean(space?.branch), (el) => el.child(h_flex().flex_shrink(20).min_w(0).overflow_hidden().gap(8)
        .child(sep()).child(div().flex_none().child("git:")).child(div().min_w(0).max_w(200).truncate().text_color(P.dim2).child(space.branch))))
      .child(sep())
      .child(h_flex().flex_none().gap(5).child(div().child("PANES"))
        .child(div().font_family(FONT_NUM).text_size(16).text_color(P.dim2).child(String(n).padStart(2, "0"))));
  }

  render() {
    const calm = isCalm();
    const space = spaces().find((s) => s.active);
    const shown = space?.tabs ?? [];
    const active = shown.findIndex((t) => t.active);
    if (shown[active]?.id !== this.selected || active !== this.selectedIndex) {
      this.selected = shown[active]?.id; this.selectedIndex = active;
      if (active >= 0) this.scroll.scroll_to_item(active);
    }
    const stop = (_e, cx) => cx.stop_propagation();
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    const panelBtn = (id, label) => {
      const on = panel && !panel.hidden && body?.active === id;
      return div().id(`ph-panel-${id}`).relative().w(72).h(TH).flex_none().cursor_pointer().on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        })
        .child(outline(72, TH, on ? P.amber : P.line, { cut: 5, corners: "br" }))
        .child(div().absolute().left(0).top(0).w(72).h(TH).flex().items_center().justify_center().text_size(12)
          .text_color(on ? P.amber : P.dim2).hover((s) => s.text_color(on ? P.amber : P.fg)).child(label));
    };
    return h_flex().id("ph-tabs").size_full().min_w(0).px(6).gap(10).items_center().bg(P.void).border_b(1).border_color(P.line)
      .font_family(FONT_UI)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("ph-tab-scroll").flex_1().min_w(200).h_full().items_center().gap(4).overflow_x_scrollbar().track_scroll(this.scroll)
        .on_size_change((_s, cx) => { if (active >= 0) { this.scroll.scroll_to_item(active); cx.notify(); } })
        .children(shown.map((c, i) => this.tab(c, i, shown, space, active, calm)))
        .child(div().id("ph-tab-new").h(TH).px(8).flex_none().flex().items_center().cursor_pointer().text_size(14).text_color(P.dim)
          .hover((s) => s.text_color(P.fg)).on_mouse_down("left", stop)
          .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })).child("+")))
      .child(this.readout(space))
      .when(enabled.includes("files"), (el) => el.child(panelBtn("files", "FILES")))
      .when(enabled.includes("changes"), (el) => el.child(panelBtn("changes", "CHANGES")));
  }
}

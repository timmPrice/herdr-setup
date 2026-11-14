// ph-pane: the PHOSPHOR pane header (one copy per pane; keep it cheap).
// Layout: "header": { "content": { "mod": "ph-pane", "props": { "intensity": "full" } }, "height": 26 }
// Props from the app: { pane, terminal } plus the layout's { intensity, bars? }.
//   bars: "focused" (default: only the focused RUN pane's signal bars move) | "all" (every RUN pane).
//
// Left → right: cut-corner status plate (tag + kanji), addr │ prog │ cwd │ git:branch (cwd elides
// first), THINKING / NEEDS YOU label, time-in-state (VT323), 3-bar signal glyph, split/zoom/close.
// Focused: amber address + stacked-stroke glow rule along the terminal-facing edge. Unfocused: grey.
// Blocked: hazard plate (blinks; solid in calm) + red rule + "NEEDS YOU · <respond key>".
// Done: still green plate. Idle: dim, flat bars. Shell: [ SH ] 端末, no timer/bars.
//
// Cost: the only motion is the bars loop (RUN, focused pane) and the WAIT plate blink. The timer
// re-renders this copy on wall-clock boundaries (every copy ticks in the same frame): each second
// while RUN/WAIT in full intensity, otherwise once a minute (coarse format, so idle stays still).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, spaces, props, run, home, layout, keys } from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_JP, FONT_TERM, stateOf, alpha } from "./lib/palette.js";
import { plate, outline, hazard, glowRule } from "./lib/plate.js";
import { intensity, blink, bars } from "./lib/motion.js";
import { Since, tabSeed } from "./lib/since.js";
import { paneFrame, fmtLive, fmtCoarse, pickRespondKey } from "./fmt.js";

const ICONS = "mods/ph-pane/icons";
const PLATE_W = 84;
const PLATE_H = 20;
const RULE_W = 6000; // wider than any pane; the header clips it
const RULE_H = 6;

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : h && cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

/** The key bound to ph-kit.respond (see pickRespondKey). */
function respondKey() {
  try { return pickRespondKey(keys()); } catch { return pickRespondKey([]); }
}

const sep = () => div().flex_none().text_color(P.grey).child("│");

export default class PhPane extends View {
  init(_props, cx) {
    this.since = new Since();
    this.loaded = new Set();
    this.live = false; // tick each second (true) or each minute
    this.gen = 0;
    this.tick(cx, this.gen);
  }

  // Wall-clock aligned re-render, so all header copies redraw in the same frame. A new chain
  // (gen + 1) replaces the old one when the cadence changes.
  tick(cx, gen) {
    const step = this.live ? 1000 : 60000;
    const wait = step - (Date.now() % step) + 5;
    cx.timer.after(wait, (cx) => {
      if (gen !== this.gen) return;
      cx.notify();
      this.tick(cx, gen);
    });
  }

  me() {
    const id = props()?.pane;
    return panes().find((p) => p.pane === id);
  }

  // Time-in-state for this pane's agent. Per-address localStorage key (copies share the store).
  elapsed(agent, now) {
    const addr = agent.address;
    const key = `since:${addr}`;
    if (!this.loaded.has(addr)) {
      this.loaded.add(addr);
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { saved = null; }
      if (saved && typeof saved.at === "number") this.since.map[addr] = saved;
    }
    const others = Object.keys(this.since.map).filter((k) => k !== addr);
    for (const k of others) { delete this.since.map[k]; this.loaded.delete(k); }
    if (this.since.observe([agent], now, tabSeed(spaces()))) {
      try { localStorage.setItem(key, JSON.stringify(this.since.map[addr])); } catch {}
    }
    return this.since.elapsed(addr, now);
  }

  statusPlate(st, focused, calm, pane) {
    const label = h_flex()
      .absolute().left(0).top(0).w(PLATE_W).h(PLATE_H)
      .pl(7).gap(6).items_center()
      .child(div().font_family(FONT_TERM).text_size(11.5).font_weight(700).child(st.short))
      .child(div().font_family(FONT_JP).text_size(12.5).child(st.kanji));

    let box = div().id(`ph-plate-${pane}`).relative().flex_none().w(PLATE_W).h(PLATE_H);
    if (st.key === "blocked") {
      // Solid red plate, dark hazard stripes on top that blink (full) / none (calm). The label never
      // fades: dark bold text on red stays readable mid-blink and in calm.
      const shape = { cut: 7, corners: "br" };
      box = box.child(plate(PLATE_W, PLATE_H, st.color, shape));
      if (!calm) {
        const stripes = div().id(`ph-haz-${pane}`).absolute().left(0).top(0).w(PLATE_W).h(PLATE_H)
          .child(hazard(PLATE_W, PLATE_H, alpha(P.void, 0.42), { ...shape, stripe: 4, interval: 9, base: alpha(P.void, 0) }));
        box = box.child(blink(stripes, true, { calm, from: 0.15 }));
      }
      return box.child(label.text_color(P.void).font_weight(700));
    }
    const fill = alpha(st.color, focused ? 0.2 : 0.11);
    const edge = alpha(st.color, focused ? 0.85 : 0.45);
    return box
      .child(plate(PLATE_W, PLATE_H, fill, { cut: 7, corners: "br" }))
      .child(outline(PLATE_W, PLATE_H, edge, { cut: 7, corners: "br" }))
      .child(label.text_color(st.key === "idle" ? P.dim : st.color));
  }

  button(id, icon, command, args, iconColor) {
    return div()
      .id(id)
      .flex_none()
      .p(3)
      .text_color(iconColor)
      .hover((s) => s.bg(P.panel2).text_color(P.fg))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`${ICONS}/${icon}.svg`).size(14));
  }

  render(cx) {
    const p = this.me();
    if (!p) return div();
    const pane = p.pane;
    const pr = props() ?? {};
    const calm = intensity() === "calm";
    const now = Date.now();

    const isMod = !p.terminal;
    const agent = isMod ? null : agents().find((a) => a.pane === pane) ?? null;
    const st = stateOf(agent?.status ?? p.status);
    const focused = Boolean(p.focused);
    const blocked = st.key === "blocked";
    const working = st.key === "working";
    const idle = st.key === "idle";

    const live = !calm && (working || blocked);
    if (live !== this.live) {
      this.live = live;
      this.gen++;
      if (cx?.timer) this.tick(cx, this.gen);
    }

    const addr = agent?.address ?? p.terminal ?? p.mod ?? "";
    const prog = isMod ? (p.mod ?? "mod") : (agent?.app || p.program?.name || p.program?.key || "shell");
    const dir = folder(p.cwd);
    const bottom = paneFrame(layout())?.header?.position === "bottom";

    const textMain = idle ? P.dim : P.fg;
    const textSub = idle ? P.dim : focused ? P.dim2 : P.dim;
    const addrColor = focused ? P.amber : idle ? P.dim : P.dim2;

    // Middle: addr │ prog │ cwd │ git:branch. cwd shrinks/elides first, then the branch.
    const middle = h_flex()
      .flex_1().min_w(0).overflow_hidden().gap(7).items_center()
      .child(div().flex_none().text_color(addrColor).font_weight(700).child(addr))
      .child(sep())
      // Shrink weights: cwd gives way ~40x faster than prog/branch, so it elides first (down to "…"),
      // then prog and branch ellipsize. Everything has a floor, so nothing hard-clips.
      .child(div().flex_shrink(1).min_w(40).max_w(140).truncate().text_color(textMain).child(prog))
      .when(Boolean(dir), (el) => el.child(sep()).child(div().flex_shrink(40).min_w(16).truncate().text_color(textMain).child(dir)))
      .when(Boolean(p.branch), (el) =>
        el.child(sep()).child(
          h_flex().flex_shrink(1).min_w(64).max_w(220).overflow_hidden().items_center()
            .child(div().flex_none().text_color(P.dim).child("git:"))
            .child(div().flex_shrink(1).min_w(0).truncate().text_color(idle ? P.dim : st.key === "shell" ? P.dim2 : P.fg).child(p.branch)),
        ));

    // Right: label, time-in-state, signal bars.
    let right = h_flex().flex_none().gap(10).items_center();
    if (blocked) {
      right = right.child(div().flex_none().text_color(P.red).child(`NEEDS YOU · ${respondKey()}`));
    } else if (working && focused) {
      right = right.child(div().flex_none().text_color(P.orange).text_size(11.5).child("THINKING"));
    }
    if (agent) {
      const ms = this.elapsed(agent, now);
      right = right.child(
        div().flex_none().min_w(44).font_family(FONT_NUM).text_size(19).text_color(idle ? P.dim : st.color)
          .child(live ? fmtLive(ms) : fmtCoarse(ms)),
      );
      const moving = working && (focused || pr.bars === "all");
      const level = idle ? 0 : 3;
      right = right.child(
        div().id(`ph-bars-${pane}-${moving ? "m" : "s"}`).flex_none()
          .child(bars(level, st.color, { on: moving, off: idle ? P.grey : P.line, h: 12, bw: 3, gap: 2, calm })),
      );
    }

    const iconColor = focused ? P.dim2 : P.dim;
    const buttons = h_flex().flex_none().gap(1).items_center().ml(4)
      .child(this.button(`ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }, iconColor))
      .child(this.button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }, iconColor))
      .child(this.button(`ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }, iconColor))
      .child(this.button(`ph-x-${pane}`, "close", "pane.close", { pane }, iconColor));

    // The rule along the terminal-facing edge: amber glow when focused, red when blocked.
    const ruleColor = blocked ? P.red : focused ? P.amber : null;
    const ruleBox = (el) => (bottom ? el.top(-RULE_H / 2 + 1) : el.bottom(-RULE_H / 2 + 1));
    const rule = ruleColor
      ? ruleBox(div().absolute().left(0).w_full().h(RULE_H).overflow_hidden())
          .child(focused ? glowRule(RULE_W, ruleColor, { h: RULE_H, calm }) : div().absolute().left(0).top(RULE_H / 2 - 1).w_full().h(2).bg(ruleColor))
      : null;

    const row = h_flex()
      .absolute().inset_0()
      .pl(4).pr(4).gap(10).items_center()
      .child(this.statusPlate(st, focused, calm, pane))
      .child(middle)
      .child(right)
      .child(buttons);

    return div()
      .id(`ph-head-${pane}`)
      .relative()
      .size_full()
      .overflow_hidden()
      .bg(focused ? P.panel : P.pane)
      .when(bottom, (el) => el.border_t(1))
      .when(!bottom, (el) => el.border_b(1))
      .border_color(ruleColor ? alpha(ruleColor, 0.35) : P.line)
      .font_family(FONT_UI)
      .text_size(13)
      .on_click(() => run("pane.focus", { pane }))
      .child(row)
      .when(Boolean(rule), (el) => el.child(rule));
  }
}

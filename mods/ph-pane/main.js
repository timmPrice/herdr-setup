// ph-pane: the PHOSPHOR pane header (one copy per pane; keep it cheap).
// Layout: "header": { "content": { "mod": "ph-pane" }, "height": 26 }
// Props from the app: { pane, terminal }. Intensity: shared("ph.intensity") via lib/motion (read in render).
//
// Left → right: cut-corner status plate (tag + kanji), addr │ prog │ cwd │ git:branch (cwd elides
// first), THINKING / NEEDS YOU label, time-in-state (VT323), 3-bar signal glyph, split/zoom/close.
// Focused: amber address + stacked-stroke glow rule along the terminal-facing edge. Unfocused: grey.
// Blocked: hazard plate (stripes blink on the focused pane; static unfocused; none in calm) + red rule
// + "NEEDS YOU · <respond key>". Done: still green plate. Idle: dim, flat bars. Shell: [ SH ] 端末,
// no timer/bars. Mod pane: neutral [ MOD ] plate, mod name only.
//
// Cost (project rule): time-in-state is shown at minute resolution (<1m · 3m · 1h04m · 2d03h). Only
// the focused pane of the tab on screen, while RUN/WAIT, runs a timer: one re-render per wall-clock
// minute. Unfocused panes and copies in hidden tabs run no timer and no loops; their readout refreshes
// whenever the app re-renders them (status / focus / cwd changes). Signal bars move only on the
// focused RUN pane; the WAIT stripes blink only on the focused WAIT pane (see motionPlan in fmt.js).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, spaces, props, run, home, layout, keys, focused as focusInfo } from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_JP, FONT_TERM, stateOf, alpha } from "./lib/palette.js";
import { everyMinute } from "./lib/tick.js";
import { plate, outline, hazard, glowRule } from "./lib/plate.js";
import { intensity, blink } from "./lib/motion.js";
import { Since, tabSeed } from "./lib/since.js";
import { paneFrame, fmtMin, motionPlan, pickRespondKey } from "./fmt.js";

const ICONS = "mods/ph-pane/icons";
const PLATE_W = 84;
const PLATE_H = 20;
const RULE_W = 20000; // wider than any pane at any zoom (5120 px at zoom 0.25); the header clips it
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

// Mod panes (pane.split {mod}) have no status: a neutral plate instead of the shell's [ SH ] 端末.
const MOD_STATE = { key: "mod", short: "MOD", kanji: "拡張", color: P.dim2 };

/**
 * 3-bar signal glyph (local copy of lib bars() with stable per-bar ids, so a re-render keeps each
 * loop's phase). level 0..3 lit; the height loop runs only while `on`.
 */
function sigBars(idBase, level, color, { on = false, off = P.line, h = 12, bw = 3, gap = 2 } = {}) {
  const row = div().id(idBase).flex_none().flex().flex_row().items_end().h(h).gap(gap);
  return row.children([0, 1, 2].map((i) => {
    const full = Math.round(h * (i + 1) / 3);
    let b = div().id(`${idBase}-${i}`).w(bw).h(full).bg(i < level ? color : off);
    if (on && i < level) b = b.loop("height", { from: Math.max(2, full * 0.35), to: full, period: 600 + i * 170, easing: "ease-in-out" });
    return b;
  }));
}

export default class PhPane extends View {
  init(_props, cx) {
    this.since = new Since();
    this.loadedAddr = null;
    this.ticking = false; // per-minute timer chain running (focused RUN/WAIT pane on screen only)
    this.gen = 0;
  }

  // Per-minute re-render aligned to the wall clock. Turning it off bumps gen: the pending callback
  // (at most one, within a minute) sees a stale gen and ends the chain without rendering.
  setTicking(on, cx) {
    if (on === this.ticking) return;
    this.ticking = on;
    this.gen++;
    if (on && cx?.timer) this.tick(cx, this.gen);
  }

  tick(cx, gen) {
    everyMinute(cx, (cx) => {
      if (gen !== this.gen) return false;
      cx.notify();
    });
  }

  me() {
    const id = props()?.pane;
    return panes().find((p) => p.pane === id);
  }

  // Time-in-state for this pane's agent. localStorage is per mod copy, so one fixed key holds only
  // this pane's current agent: { addr, status, at } (no keys pile up as agents come and go).
  elapsed(agent, now) {
    const addr = agent.address;
    if (this.loadedAddr !== addr) {
      this.loadedAddr = addr;
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem("since") ?? "null"); } catch { saved = null; }
      this.since.map = saved && saved.addr === addr && typeof saved.at === "number"
        ? { [addr]: { status: saved.status ?? null, at: saved.at } } : {};
    }
    if (this.since.observe([agent], now, tabSeed(spaces()))) {
      const e = this.since.map[addr];
      try { localStorage.setItem("since", JSON.stringify({ addr, status: e.status, at: e.at })); } catch {}
    }
    return this.since.elapsed(addr, now);
  }

  statusPlate(st, focused, calm, pane, blinking) {
    const label = h_flex()
      .absolute().left(0).top(0).w(PLATE_W).h(PLATE_H)
      .pl(7).gap(6).items_center()
      .child(div().font_family(FONT_TERM).text_size(11.5).font_weight(700).child(st.short))
      .child(div().font_family(FONT_JP).text_size(12.5).child(st.kanji));

    let box = div().id(`ph-plate-${pane}`).relative().flex_none().w(PLATE_W).h(PLATE_H);
    if (st.key === "blocked") {
      // Solid red plate, dark hazard stripes on top: blinking on the focused pane, static on others,
      // none in calm. The label never fades: dark bold text on red stays readable mid-blink.
      const shape = { cut: 7, corners: "br" };
      box = box.child(plate(PLATE_W, PLATE_H, st.color, shape));
      if (!calm) {
        const stripes = div().id(`ph-haz-${pane}`).absolute().left(0).top(0).w(PLATE_W).h(PLATE_H)
          .child(hazard(PLATE_W, PLATE_H, alpha(P.void, 0.42), { ...shape, stripe: 4, interval: 9, base: alpha(P.void, 0) }));
        box = box.child(blinking ? blink(stripes, true, { calm, from: 0.15 }) : stripes.opacity(0.6));
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
    const calm = intensity() === "calm";
    const now = Date.now();

    const isMod = !p.terminal;
    const agent = isMod ? null : agents().find((a) => a.pane === pane) ?? null;
    const st = isMod ? MOD_STATE : stateOf(agent?.status ?? p.status);
    const focused = Boolean(p.focused);
    const blocked = st.key === "blocked";
    const working = st.key === "working";
    const idle = st.key === "idle" || isMod;

    let shownTab = false;
    try { shownTab = focusInfo()?.tab === p.tab; } catch { shownTab = false; }
    const plan = motionPlan({ state: agent ? st.key : "shell", focused, shownTab, calm });
    this.setTicking(plan.timer, cx);

    const addr = isMod ? "" : agent?.address ?? p.terminal ?? "";
    const prog = isMod ? (p.mod ?? "mod") : (agent?.app || p.program?.name || p.program?.key || "shell");
    const dir = folder(p.cwd);
    const bottom = paneFrame(layout())?.header?.position === "bottom";

    const textMain = idle ? P.dim : P.fg;
    const textSub = idle ? P.dim : focused ? P.dim2 : P.dim;
    const addrColor = focused ? P.amber : idle ? P.dim : P.dim2;

    // Middle: addr │ prog │ cwd │ git:branch. cwd shrinks/elides first, then prog and the branch.
    const middle = h_flex()
      .flex_1().min_w(0).overflow_hidden().gap(7).items_center()
      .when(Boolean(addr), (el) => el.child(div().flex_none().text_color(addrColor).font_weight(700).child(addr)).child(sep()))
      // Shrink weights: cwd gives way ~40x faster than prog/branch, so it elides first (down to "…"),
      // then prog and branch ellipsize. Floors stay small (prog 28, cwd 16, branch 0) so their sum fits
      // a narrow pane: the branch shrinks to "git:…" (or just "git:") instead of being clipped away.
      .child(div().flex_shrink(1).min_w(28).max_w(140).truncate().text_color(textMain).child(prog))
      .when(Boolean(dir), (el) => el.child(sep()).child(div().flex_shrink(40).min_w(16).truncate().text_color(textMain).child(dir)))
      .when(Boolean(p.branch), (el) =>
        el.child(sep()).child(
          h_flex().flex_shrink(1).min_w(0).max_w(220).overflow_hidden().items_center()
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
          .child(fmtMin(ms)),
      );
      const level = idle ? 0 : 3;
      // Re-keyed when motion toggles, so a stopped loop doesn't leave a bar mid-height.
      right = right.child(sigBars(`ph-bars-${pane}-${plan.bars ? "m" : "s"}`, level, st.color, { on: plan.bars, off: idle ? P.grey : P.line }));
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
      .child(this.statusPlate(st, focused, calm, pane, plan.blink))
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

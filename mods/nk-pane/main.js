// nk-pane: the neo-kyoto pane header, a kanji neon status sign.
// Layout: "header": { "content": { "mod": "nk-pane", "props": { "intensity": "full" } }, "height": 30 }
// Props from the app: { pane, terminal } plus the layout's { intensity: "full" | "calm" }.
//
// Left: a neon sign chip with the agent's status kanji (稼働 working, 待機 idle, 警告 blocked,
// 完了 done) in DotGothic16; a plain shell gets just a small dot. Then the name, folder and
// git branch, and on hover the split/zoom/close buttons of the shipped `pane` mod.
// Motion (all native, nothing on idle/done):
//   working: slow opacity pulse on the sign (both intensities)
//   blocked: full only: a neon-tube flicker; a dim copy of the kanji sits under a bright copy
//            whose text .frames() briefly drops one or both characters (unlit tube), irregularly.
//   calm:    no flicker, the working pulse only.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, layout, shared, setShared } from "herdr";
import { P, JP, kanji, statusColor } from "./palette.js";

const ICONS = "mods/nk-pane";
const OFF = "　"; // full-width space: keeps the other character in place
const FLICKER_MS = 60;

// Match the first visible tab frame, including the active child of a stack (from mods/pane).
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter((child) => !child.hidden);
    children = [visible.find((child) => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// One flicker cycle (56 frames x 60 ms = 3.4 s): lit almost all the time, with a stutter on
// the second tube, one quick full blink and one dropout of the first tube. Rotated per pane
// so several blocked panes don't blink in sync. Cached per (text, offset).
const flickerCache = new Map();
function flicker(text, offset) {
  const key = text + offset;
  let seq = flickerCache.get(key);
  if (seq) return seq;
  const [a, b] = [...text];
  const on = a + b;
  const dips = { 9: a + OFF, 11: a + OFF, 12: a + OFF, 30: OFF + OFF, 44: OFF + b };
  const base = Array.from({ length: 56 }, (_, i) => dips[i] ?? on);
  seq = base.slice(offset % base.length).concat(base.slice(0, offset % base.length));
  flickerCache.set(key, seq);
  return seq;
}

export default class NkPane extends View {
  init() {
    this.hovered = false;
    // Integration wiring: the root "toast" can't take props, so mirror this layout's
    // intensity into shared("nk.intensity"), which nk-toast reads. Set only on change.
    const want = props()?.intensity === "calm" ? "calm" : "full";
    if (shared("nk.intensity") !== want) setShared("nk.intensity", want);
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`${ICONS}/${icon}.svg`).size(14));
  }

  // The neon sign chip for an agent pane.
  sign(p, calm) {
    const st = p.status;
    const color = statusColor(st);
    const text = kanji(st);
    const focused = p.focused;
    const id = `nk-sign-${p.pane}`;
    const flickering = st === "blocked" && !calm;

    const label = flickering
      ? div()
          .relative()
          .child(div().text_color(color + "40").child(text)) // the unlit tube
          .child(
            div()
              .id(`${id}-tube`)
              .absolute()
              .top(0)
              .left(0)
              .text_color(color)
              .frames(flicker(text, hash(p.pane) % 56), FLICKER_MS),
          )
      : div().text_color(color).child(text);

    let chip = h_flex()
      .id(`${id}-${st}-${focused ? "f" : "u"}`) // re-keyed so the pulse restarts at the new range
      .flex_none()
      .h(20)
      .px(6)
      .items_center()
      .rounded(3)
      .border_1()
      .bg(color + (focused ? "33" : "1a"))
      .border_color(color + (focused ? "aa" : "55"))
      .font_family(JP)
      .text_size(40 / 3) // 16 device px at zoom 1.2: DotGothic16's native grid, so the dots stay crisp
      .child(label);

    // Focused: brighter, plus a faint outer ring (stacked translucent border = neon halo).
    // Unfocused: dimmed. Idle sits lowest.
    const rest = focused ? 1 : st === "idle" ? 0.5 : 0.72;
    if (st === "working") {
      chip = chip.loop("opacity", { from: rest * 0.55, to: rest, period: 2600, easing: "ease-in-out" });
    } else {
      chip = chip.opacity(rest);
    }
    if (!focused) return chip;
    return div().flex_none().p(1).rounded(4).border_1().border_color(color + "26").child(chip);
  }

  dot(p) {
    return div()
      .flex_none()
      .mx(3)
      .size(6)
      .rounded(3)
      .bg(p.focused ? P.fg : P.grey)
      .opacity(p.focused ? 0.8 : 0.6);
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const calm = (props()?.intensity ?? "full") === "calm";
    const pane = p.pane;
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const isAgent = Boolean(p.status);
    const dir = folder(p.cwd);
    const bottom = paneFrame(layout())?.header?.position === "bottom";

    return h_flex()
      .id(`nk-head-${pane}`)
      .size_full()
      .px(8)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, (el) => el.border_t(1))
      .when(!bottom, (el) => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => {
        this.hovered = hovered;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane }))
      .child(isAgent ? this.sign(p, calm) : this.dot(p))
      .child(
        div()
          .flex_none()
          .truncate()
          .max_w(260)
          .font_medium()
          .text_color(p.focused ? t.foreground : t.dim)
          .child(name),
      )
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .gap(6)
          .items_center()
          .text_color(t.dim)
          .when(Boolean(dir), (el) => el.child(div().flex_shrink(1).min_w(0).truncate().child(dir)))
          .when(Boolean(p.branch), (el) =>
            el.child(
              h_flex()
                .flex_none()
                .gap(3)
                .items_center()
                .opacity(0.8)
                .child(svg(`${ICONS}/git-branch.svg`).size(11).flex_none().text_color(t.dim))
                .child(div().truncate().max_w(180).child(p.branch)),
            ),
          ),
      )
      .when(this.hovered, (el) =>
        el
          .child(this.button(t, `nk-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
          .child(this.button(t, `nk-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
          .child(this.button(t, `nk-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
          .child(this.button(t, `nk-x-${pane}`, "close", "pane.close", { pane })),
      );
  }
}

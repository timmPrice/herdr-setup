// nk-sakura: a sakura tree in the top-right floating block that doubles as an agent dashboard.
//
// - Trunk/branches: one static SVG (tree-v1.svg, 280x220), drawn with image(). Static = free.
// - Blossoms: one tinted svg() per anchor. Limbs are spaces (agents grouped by space, one limb per
//   space in order), one blossom per agent in stable order; spare anchors are dim decorative buds.
// - Status: working = aqua, slow opacity pulse; idle = dim pink, still; blocked = orange + hanging
//   lantern (+ faster pulse in full); done = full pink bloom, still.
// - Full intensity: up to 6 drifting petals, one per working agent (none when nothing works).
//   Calm: no petals, no blocked pulse; only the slow working pulse moves.
// - Hover a blossom: name + kanji status beside it. Hover the tree: agent list in the open
//   bottom-left corner (else a one-line status summary). Click a blossom or row: agent.focus.
//
// Props: { intensity: "calm" | "full" (default "full"), demo?: true (fake agents, for testing) }.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, agents, run, fonts, placement } from "herdr";
import { P, statusColor, kanji, JP_FONT } from "./palette.js";

const DIR = "mods/nk-sakura";
const W = 280;
const H = 220;
const MAX_PETALS = 6;
const LIST_ROWS = 4;

// Hand-picked anchors in tree-v1.svg's units: [x, y, limb]. Limbs (in the order spaces get them):
// 0 centre, 1 left-upper, 2 right-upper, 3 left-low, 4 right-low.
const ANCHORS = [
  [152, 14, 0], [160, 26, 0], [140, 38, 0], [154, 40, 0], [194, 34, 0], [188, 48, 0],
  [38, 44, 1], [56, 50, 1], [58, 80, 1], [72, 74, 1], [108, 46, 1], [112, 58, 1], [98, 66, 1],
  [256, 26, 2], [248, 38, 2], [230, 20, 2], [236, 34, 2], [262, 76, 2], [248, 78, 2],
  [34, 102, 3], [50, 106, 3], [80, 94, 3], [86, 106, 3], [100, 142, 3], [112, 140, 3], [66, 116, 3],
  [276, 112, 4], [266, 122, 4], [266, 150, 4], [256, 148, 4],
];
const LIMBS = 5;

const BUD = "#9a737e"; // dim grey-pink
const URGENCY = { blocked: 0, done: 1, working: 2, idle: 3 };

const DEMO = [
  ["herdr", "build-nk-sakura", "working"], ["herdr", "build-nk-pane", "working"],
  ["herdr", "build-nk-toast", "blocked"], ["herdr", "manager-2", "idle"],
  ["api", "fix-auth", "done"], ["api", "tests", "working"], ["api", "docs", "idle"],
  ["notes", "draft", "done"], ["notes", "review", "blocked"],
].map(([space, tab, status], i) => ({
  address: `demo-${i}`, space, space_name: space, tab_name: tab, title: tab, status,
  program: { name: "Claude Code" }, app: "claude-code",
}));

const nameOf = (a) => {
  const n = (a.tab_name || a.title || a.program?.name || a.app || "agent").trim();
  return n.length > 18 ? n.slice(0, 17) + "…" : n;
};

// Agents → anchor indices. Spaces in order of first appearance (agents() is in space/tab/pane
// order, so this is stable), space i on limb i % LIMBS; overflow spills to any free anchor.
function assign(list) {
  const bySpace = new Map();
  for (const a of list) {
    if (!bySpace.has(a.space)) bySpace.set(a.space, []);
    bySpace.get(a.space).push(a);
  }
  const used = new Array(ANCHORS.length).fill(null);
  let s = 0;
  const spill = [];
  for (const group of bySpace.values()) {
    const limb = s++ % LIMBS;
    for (const a of group) {
      const i = ANCHORS.findIndex((p, k) => p[2] === limb && used[k] === null);
      if (i >= 0) used[i] = a;
      else spill.push(a);
    }
  }
  for (const a of spill) {
    const i = used.indexOf(null);
    if (i < 0) break;
    used[i] = a;
  }
  return used;
}

export default class NkSakura extends View {
  init() {
    this.hover = null; // address of the hovered blossom
    this.over = false; // pointer anywhere on the tree
  }

  render(cx) {
    const calm = props()?.intensity === "calm";
    const list = props()?.demo ? DEMO : agents();
    const slots = assign(list);
    const jp = fonts().includes(JP_FONT);
    const jpf = (el) => (jp ? el.font_family(JP_FONT) : el);
    const showList = this.over || Boolean(placement()?.hovered);

    const root = div()
      .id("nk-sakura")
      .relative()
      .w(W)
      .h(H)
      .flex_none()
      .on_hover((h, cx) => {
        this.over = h;
        if (!h) this.hover = null;
        cx.notify();
      })
;
    const kids = [image(`${DIR}/tree-v1.svg`).absolute().left(0).top(0).w(W).h(H)];

    // Blossoms and buds.
    let hovered = null;
    slots.forEach((a, i) => {
      const [x, y] = ANCHORS[i];
      if (!a) {
        kids.push(svg(`${DIR}/blossom.svg`).absolute().left(x - 4.5).top(y - 4.5).size(9)
          .text_color(BUD).opacity(0.6));
        return;
      }
      const st = a.status in URGENCY ? a.status : "unknown";
      const size = st === "done" ? 17 : st === "idle" ? 13 : 15;
      const color = st === "idle" ? P.pink : statusColor(st);
      let flower = svg(`${DIR}/blossom.svg`).size(size).text_color(color);
      if (st === "idle") flower = flower.opacity(0.6);
      if (st === "working") {
        flower = flower.loop("opacity", { from: 0.45, to: 1, period: 2200, easing: "ease-in-out" });
      } else if (st === "blocked" && !calm) {
        flower = flower.loop("opacity", { from: 0.5, to: 1, period: 700, easing: "ease-in-out" });
      }
      if (st === "blocked") {
        kids.push(svg(`${DIR}/lantern.svg`).absolute().left(x - 3).top(y + 5).w(6).h(12)
          .text_color(P.orange).opacity(0.9));
      }
      kids.push(
        div()
          .id(`b-${i}-${a.address}-${st}`)
          .absolute()
          .left(x - 9)
          .top(y - 9)
          .size(18)
          .flex()
          .items_center()
          .justify_center()
          .cursor_pointer()
          .on_hover((h, cx) => {
            if (h) this.hover = a.address;
            else if (this.hover === a.address) this.hover = null;
            cx.notify();
          })
          .on_click((_e, cx) => {
            cx.stop_propagation();
            this.focus(a);
          })
          .child(flower),
      );
      if (this.hover === a.address) hovered = [a, x, y, st];
    });

    // Falling petals (full only): one per working agent, at most MAX_PETALS. Nested wrappers so
    // left (sway) and top (fall) loop at different periods; opacity breathes on the petal.
    const working = list.filter((a) => a.status === "working").length;
    const petals = calm ? 0 : Math.min(MAX_PETALS, working);
    for (let k = 0; k < petals; k++) {
      const [x, y] = ANCHORS[(k * 7 + 3) % ANCHORS.length];
      const drop = 34 + ((k * 13) % 22);
      kids.push(
        div()
          .id(`petal-sway-${k}`)
          .absolute()
          .left(x)
          .top(y + 4)
          .size(9)
          .loop("left", { from: x - 6, to: x + 8, period: 3100 + k * 430, easing: "ease-in-out" })
          .child(
            div()
              .id(`petal-fall-${k}`)
              .relative()
              .top(0)
              .size(9)
              .loop("top", { from: 0, to: drop, period: 6200 + k * 570, easing: "ease-in-out" })
              .child(svg(`${DIR}/petal.svg`).id(`petal-${k}`).size(9).text_color(P.pink)
                .loop("opacity", { from: 0.15, to: 0.8, period: 3100 + k * 285, easing: "ease-in-out" })),
          ),
      );
    }

    // Hover label beside the blossom.
    if (hovered) {
      const [a, x, y, st] = hovered;
      const right = x < W / 2;
      const label = h_flex()
        .absolute()
        .top(Math.max(0, Math.min(H - 20, y - 9)))
        .gap(6)
        .px(6)
        .py(1)
        .rounded(4)
        .bg(P.bg1)
        .border(1)
        .border_color(statusColor(st) + "88")
        .text_size(11)
        .whitespace_nowrap()
        .child(jpf(div().text_color(statusColor(st)).child(kanji(st))))
        .child(div().text_color(P.fg).child(nameOf(a)));
      kids.push(right ? label.left(x + 12) : label.right(W - x + 12));
    }

    // Bottom-left corner: agent list on hover, else a quiet status summary.
    kids.push(showList ? this.list(list, jpf) : this.summary(list, jpf));
    return root.children(kids);
  }

  focus(a) {
    if (!String(a.address).startsWith("demo-")) run("agent.focus", { terminal: a.address });
  }

  summary(list, jpf) {
    const counts = {};
    for (const a of list) counts[a.status] = (counts[a.status] ?? 0) + 1;
    const parts = ["blocked", "done", "working", "idle"].filter((s) => counts[s]);
    return h_flex()
      .absolute()
      .left(4)
      .bottom(4)
      .gap(8)
      .text_size(11)
      .children(parts.map((s) =>
        jpf(div().text_color(statusColor(s)).opacity(s === "idle" ? 0.7 : 1).child(`${kanji(s)}${counts[s]}`))));
  }

  list(list, jpf) {
    const sorted = [...list].sort((a, b) => (URGENCY[a.status] ?? 4) - (URGENCY[b.status] ?? 4));
    const extra = sorted.length > LIST_ROWS ? sorted.length - (LIST_ROWS - 1) : 0;
    const rows = extra ? sorted.slice(0, LIST_ROWS - 1) : sorted;
    return v_flex()
      .absolute()
      .left(0)
      .bottom(0)
      .w(170)
      .p(2)
      .text_size(11)
      .children(rows.map((a) =>
        h_flex()
          .id(`row-${a.address}`)
          .gap(6)
          .px(4)
          .h(16)
          .rounded(3)
          .items_center()
          .cursor_pointer()
          .hover((s) => s.bg(P.bg1))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            this.focus(a);
          })
          .child(jpf(div().flex_none().text_color(statusColor(a.status)).child(kanji(a.status))))
          .child(div().flex_1().truncate().text_color(a.status === "idle" ? P.fg4 : P.fg).child(nameOf(a)))))
      .when(extra > 0, (el) => el.child(div().px(4).h(16).text_color(P.grey).child(`+${extra} more`)));
  }
}

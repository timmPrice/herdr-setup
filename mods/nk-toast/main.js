// nk-toast: notifications for the neo-kyoto layout (root "toast": "nk-toast").
// Props from the app: { title, body, level, icon, action, timeout, overlay }.
//
// A dark gruvbox card with a red hanko seal on the left: 完了 (done / agent finished),
// 警告 (warning, error, needs-you), 通知 (anything else). The seal SVGs are built from
// DotGothic16 outlines by tools/make_seals.py (kanji baked in as paths, OFL.txt alongside).
//
// Intensity: the root "toast" can't take props, so it is read from shared("nk.intensity")
// ("calm" | "full", default "full"); props().intensity wins if Herdr ever passes one.
//   full: the seal stamps in (big + transparent -> slams to size in ~180 ms) and the card
//         fades out just before it closes.
//   calm: no motion at all; it appears, then closes.
// Click runs the action (like the shipped toast) and closes. It always closes itself at `timeout`.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, shared } from "herdr";

const P = {
  bg: "#1d2021", hover: "#282828", fg: "#ebdbb2", muted: "#a89984",
  pink: "#d3869b", aqua: "#8ec07c", orange: "#fe8019", red: "#fb4934",
};
const KIND = {
  done: { seal: "mods/nk-toast/seal-done-v3.svg", tint: P.pink },   // 完了
  warn: { seal: "mods/nk-toast/seal-warn-v3.svg", tint: P.orange }, // 警告
  info: { seal: "mods/nk-toast/seal-info-v3.svg", tint: P.aqua },   // 通知
};
const DEFAULT_TIMEOUT = 6000;
const SEAL_W = 42, SEAL_H = 58; // px, final seal size (art is 72x100)
const STAMP_FROM = 1.3;         // the seal starts this much bigger
const SLAM_MS = 180;
const FADE_MS = 400;

const DONE_RE = /\b(finished|done|complete(d)?|succeeded|ready)\b/i;
const WARN_RE = /\b(needs?|blocked|waiting|failed|error|denied|stuck|attention)\b/i;

function kindOf(p) {
  const text = `${p.title ?? ""} ${p.body ?? ""}`;
  if (p.level === "error" || p.level === "warning") return "warn";
  if (p.level === "success" || DONE_RE.test(p.title ?? "")) return "done";
  if (WARN_RE.test(text)) return "warn";
  return "info";
}

function intensity() {
  const v = props()?.intensity ?? shared("nk.intensity");
  return v === "calm" ? "calm" : "full";
}

export default class NkToast extends View {
  init(_props, cx) {
    const p = props() ?? {};
    const ms = typeof p.timeout === "number" && p.timeout > 0 ? p.timeout : DEFAULT_TIMEOUT;
    this.calm = intensity() === "calm"; // fixed for this toast's life
    // stage 0: seal big + transparent; 1: stamped; 2: fading out
    this.stage = this.calm ? 1 : 0;
    if (!this.calm) {
      cx.timer.after(16, (cx) => { this.stage = 1; cx.notify(); });
      cx.timer.after(Math.max(SLAM_MS + 100, ms - FADE_MS), (cx) => { this.stage = 2; cx.notify(); });
    }
    if (p.overlay) cx.timer.after(ms, () => closeOverlay(p.overlay));
  }

  seal(kind) {
    const big = this.stage === 0;
    const k = big ? STAMP_FROM : 1;
    const w = Math.round(SEAL_W * k), h = Math.round(SEAL_H * k);
    // grow around the centre: left/top shift by half the extra size
    let el = image(KIND[kind].seal).absolute().w(w).h(h)
      .left(-Math.round((w - SEAL_W) / 2)).top(-Math.round((h - SEAL_H) / 2)).opacity(big ? 0 : 1);
    if (!this.calm) {
      // ease-in: it accelerates into the paper, like a stamp
      const slam = { duration: SLAM_MS, easing: "ease-in" };
      el = el.transition("width", slam).transition("height", slam).transition("left", slam)
        .transition("top", slam).transition("opacity", { duration: 120, easing: "ease-out" });
    }
    return div().id("nk-toast-seal-slot").relative().flex_none().w(SEAL_W).h(SEAL_H).child(el.id("nk-toast-seal"));
  }

  render(cx) {
    const p = props() ?? {};
    const kind = kindOf(p);
    const tint = KIND[kind].tint;
    const fading = this.stage === 2;
    let card = h_flex()
      .id("nk-toast")
      .size_full()
      .px(14)
      .gap(14)
      .items_center()
      .bg(P.bg)
      .border(1)
      .border_color(tint + "88")
      .rounded(8)
      .cursor_pointer()
      .hover((s) => s.bg(P.hover))
      .opacity(fading ? 0 : 1)
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        if (p.overlay) closeOverlay(p.overlay);
      })
      .child(this.seal(kind))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(2)
          .child(
            h_flex().gap(6).items_center().min_w(0)
              .when(Boolean(p.icon), (el) => el.child(image(p.icon).w(14).h(14).flex_none()))
              .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(13).text_color(P.fg).child(p.title ?? "")),
          )
          .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(P.muted).child(p.body ?? ""))),
      );
    if (!this.calm) card = card.transition("opacity", { duration: FADE_MS, easing: "ease-in" });
    return card;
  }
}

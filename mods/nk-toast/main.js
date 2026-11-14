// nk-toast: notifications for the neo-kyoto layout (root "toast": "nk-toast").
// Props from the app: { title, body, level, icon, action, timeout, overlay }.
//
// A dark gruvbox card with a red hanko seal on the left: 完了 (done / agent finished),
// 警告 (warning, error, needs-you), 通知 (anything else). The seal SVGs are built from
// Kosugi Maru outlines by tools/make_seals.py (kanji baked in as paths, LICENSE.txt + NOTICE.txt alongside).
//
// Intensity: the root "toast" can't take props, so it is read from shared("nk.intensity")
// ("calm" | "full", default "full"); props().intensity wins if Herdr ever passes one.
//   full: the seal stamps in (big + transparent -> slams to size in ~180 ms) and the card
//         fades out just before it closes.
//   calm: no motion at all; it appears, then closes.
// Click runs the action (like the shipped toast) and closes. Herdr itself closes every toast
// overlay at `timeout` (about 5 s when it's missing or null; measured, there is no sticky
// toast), so nk-toast closes a moment before that, mid-fade, and Herdr's frame never shows
// empty. Herdr's "<m> needs login; run hc machine login <m>" body becomes a
// command row with a Copy button, as in the shipped toast.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, shared, settings } from "herdr";
import { kindOf, loginMachine } from "./kind.js";

const P = {
  bg: "#1d2021", hover: "#282828", raised: "#3c3836", fg: "#ebdbb2", muted: "#a89984",
  pink: "#d3869b", aqua: "#8ec07c", orange: "#fe8019", red: "#fb4934",
};
const KIND = {
  done: { seal: "mods/nk-toast/seal-done-v4.svg", tint: P.pink },   // 完了
  warn: { seal: "mods/nk-toast/seal-warn-v4.svg", tint: P.orange }, // 警告
  info: { seal: "mods/nk-toast/seal-info-v4.svg", tint: P.aqua },   // 通知
};
const DEFAULT_TIMEOUT = 5000; // Herdr's own default (measured ~5 s)
const EARLY_MS = 60;          // close this much before Herdr would
const SEAL_MAX_H = 58, SEAL_MIN_H = 30, SEAL_RATIO = 0.72; // px; art is 72x100
const SEAL_PAD = 9;             // px kept free above and below the seal
const STAMP_FROM = 1.3;         // the seal starts this much bigger
const SLAM_MS = 180;
// The card fades over FADE_MS but the overlay closes halfway through: Herdr's own frame
// (border, shadow) can't fade, so it goes while the card is still half there.
const FADE_MS = 300;

function intensity() {
  const v = props()?.intensity ?? shared("nk.intensity");
  return v === "calm" ? "calm" : "full";
}

export default class NkToast extends View {
  init(_props, cx) {
    const p = props() ?? {};
    const ms = typeof p.timeout === "number" && p.timeout > 0 ? p.timeout : DEFAULT_TIMEOUT;
    const closeAt = Math.max(SLAM_MS + 100 + FADE_MS / 2, ms - EARLY_MS);
    this.calm = intensity() === "calm"; // fixed for this toast's life
    // stage 0: seal big + transparent; 1: stamped; 2: fading out
    this.stage = this.calm ? 1 : 0;
    if (!this.calm) {
      cx.timer.after(16, (cx) => { this.stage = 1; cx.notify(); });
      cx.timer.after(closeAt - FADE_MS / 2, (cx) => { this.stage = 2; cx.notify(); });
    }
    if (p.overlay) cx.timer.after(closeAt, () => closeOverlay(p.overlay));
  }

  seal(kind) {
    // fit the toast's height (Herdr sizes the overlay; it is about 60-80 px)
    const SEAL_H = Math.max(SEAL_MIN_H, Math.min(SEAL_MAX_H, Math.round((this.h ?? 76) - 2 * SEAL_PAD)));
    const SEAL_W = Math.round(SEAL_H * SEAL_RATIO);
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

  // the command and a Copy button; copying doesn't dismiss the toast
  loginRow(command) {
    return h_flex().gap(8).items_center().min_w(0)
      .child(div().flex_1().min_w(0).truncate().tooltip(command)
        .text_size(12).text_color(P.muted).child(command))
      .child(div().id("nk-toast-login-copy").flex_none().px(6).py(3).rounded(4).bg(P.raised)
        .text_size(12).text_color(P.fg).cursor_pointer().hover((s) => s.bg("#504945"))
        .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
        .child(this.copied ? "Copied" : "Copy"));
  }

  render(cx) {
    const p = props() ?? {};
    const kind = kindOf(p);
    const tint = KIND[kind].tint;
    const fading = this.stage === 2;
    const machine = loginMachine(p.body);
    const command = machine ? `hc machine login ${machine}` : null;
    let card = h_flex()
      .id("nk-toast")
      .size_full()
      .on_size_change((size, cx) => {
        const h = Math.round(size.height / (settings()?.zoom || 1)); // design px, like .h()
        if (h !== this.h) { this.h = h; cx.notify(); }
      })
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
              .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(13).text_color(P.fg).child(machine ? `${machine} needs a login: run` : p.title ?? "")),
          )
          .when(!machine && Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(P.muted).child(p.body ?? "")))
          .when(Boolean(machine), (el) => el.child(this.loginRow(command))),
      );
    if (!this.calm) card = card.transition("opacity", { duration: FADE_MS, easing: "linear" });
    return card;
  }
}

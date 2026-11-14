// ph-toast: PHOSPHOR notifications (layout root "toast": "ph-toast"). No sound, ever.
// Props from the app: { title, body, level, icon, action, timeout, overlay }.
//
// Kinds (kind.js, suffix first: "<name> needs you" / "<name> finished" are Herdr's agent toasts):
//  - WAIT  "[WAIT] codex@t2k.service needs input": red cut-corner plate, glow outline, a hazard band on
//          the left that blinks (opacity, 700 ms) until the toast closes; it slides in once.
//          Second line: what the agent is doing (its title); third: "ctrl-shift-u jump to pane" + where.
//  - OK    "[ OK ] Finished claude@t7p.service": green plate; the card types in once via a width
//          transition (350 ms), then sits still. Second line: “title” + where; third: pane/turn.
//  - warn without an agent (failures, login): red plate, no hazard band. login body → Copy row.
//  - info: plain panel, title + body.
// Calm (shared ph.intensity = calm): nothing moves. Hazard → solid band,
// glow → 1 px core, no slide/type-in/fade; it just appears, then closes.
//
// Timeout: Herdr closes every toast overlay itself at `timeout` (about 5 s when missing or null;
// measured for nk-toast, there is no sticky toast). ph-toast closes 60 ms before that, mid-fade
// in full, so Herdr's frame never shows empty.
// Click runs the action (else focuses the agent it found) and closes, like the shipped toast.

import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay, run, agents, terminals, settings } from "herdr";
import { P, FONT_UI, FONT_JP, FONT_TERM, STATES, alpha } from "./lib/palette.js";
import { isCalm, blink } from "./lib/motion.js";
import { plate, outline, hazard, glowOutline } from "./lib/plate.js";
import { kindOf, loginMachine, agentEvent, findAgent, agentWord } from "./kind.js";

const RESPOND_KEY = "ctrl-shift-u"; // keys.json "layout:phosphor" → ph-kit.respond (skeleton)
const DEFAULT_TIMEOUT = 5000;       // Herdr's own default (measured ~5 s)
const EARLY_MS = 60;                // close this much before Herdr would
const FADE_MS = 300;                // fade-out; the overlay closes halfway through it
const IN_MS = 350;                  // OK type-in (width) / WAIT slide-in
const CUT = 8;
const BAND_W = 12;                  // WAIT hazard band

export default class PhToast extends View {
  init(_props, cx) {
    const p = props() ?? {};
    const ms = typeof p.timeout === "number" && p.timeout > 0 ? p.timeout : DEFAULT_TIMEOUT;
    const closeAt = Math.max(IN_MS + 100 + FADE_MS / 2, ms - EARLY_MS);
    this.calm = isCalm(); // fixed for this toast's life
    this.w = 360; this.h = 76; // until on_size_change reports the overlay's size
    // stage 0: before entering; 1: shown; 2: fading out
    this.stage = this.calm ? 1 : 0;
    // look the agent up once: later renders keep the same one even if its status moves on
    this.agent = findAgent(p, safe(agents, []), safe(terminals, []));
    if (!this.calm) {
      cx.timer.after(16, (cx) => { this.stage = 1; cx.notify(); });
      cx.timer.after(closeAt - FADE_MS / 2, (cx) => { this.stage = 2; cx.notify(); });
    }
    if (p.overlay) cx.timer.after(closeAt, () => closeOverlay(p.overlay));
  }

  click(p) {
    if (p.action?.name) run(p.action.name, p.action.args ?? {});
    else if (this.agent) run("agent.focus", { terminal: this.agent.address });
    if (p.overlay) closeOverlay(p.overlay);
  }

  // the command and a Copy button; copying doesn't dismiss the toast
  loginRow(command) {
    return h_flex().gap(8).items_center().min_w(0)
      .child(div().flex_1().min_w(0).truncate().tooltip(command).font_family(FONT_TERM)
        .text_size(12).text_color(P.fgTerm).child(command))
      .child(div().id("ph-toast-login-copy").flex_none().px(6).py(1).border(1).border_color(P.grey)
        .bg(P.panel2).text_size(12).text_color(P.fg).cursor_pointer().hover((s) => s.bg(P.line))
        .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
        .child(this.copied ? "Copied" : "Copy"));
  }

  // "[WAIT]" chip: outlined in its colour (JetBrains Mono: Share Tech lacks nothing here, but tags are mono everywhere)
  tag(text, color, filled = false) {
    return div().flex_none().px(4).border(1).border_color(color).font_family(FONT_TERM).text_size(12)
      .bg(filled ? color : alpha(color, 0.12)).text_color(filled ? P.void : color).child(text);
  }

  key(text, color) {
    return div().flex_none().px(4).border(1).border_color(color).font_family(FONT_TERM).text_size(11)
      .text_color(color).child(text);
  }

  where(a) {
    if (!a) return null;
    const tab = a.tab_name && a.tab_name !== String(a.tab_index) ? `${pad2(a.tab_index)}:${a.tab_name}` : pad2(a.tab_index);
    return `${a.space_name ?? "?"} › ${tab}`;
  }

  content(p, kind) {
    const a = this.agent;
    const ev = agentEvent(p.title);
    const machine = loginMachine(p.body);
    const body = p.body ?? "";
    const line = (el) => h_flex().gap(6).items_center().min_w(0).overflow_hidden().child(el);
    const dimText = (s, c = P.dim) => div().flex_none().text_size(11).text_color(c).child(s);

    if (kind === "warn" && ev?.event === "wait") {
      const who = a ? `${agentWord(a)}@${a.address}` : ev.name;
      const what = a?.title || body;
      return v_flex().gap(3).min_w(0)
        .child(h_flex().gap(8).items_center().min_w(0)
          .child(this.tag(STATES.blocked.tag, P.red, true))
          .child(h_flex().flex_1().min_w(0).overflow_hidden().text_size(13)
            .child(div().flex_none().text_color(P.fg).font_weight(700).child(who))
            .child(div().min_w(0).truncate().text_color(P.dim2).child(".service"))
            .child(div().flex_none().text_color(P.dim2).child("\u00a0needs input")))
          .child(div().flex_none().font_family(FONT_JP).text_size(16).text_color(P.red).child(STATES.blocked.kanji)))
        .when(Boolean(what), (el) => el.child(div().truncate().font_family(FONT_TERM).text_size(12).text_color(P.fgTerm).child(what)))
        .child(line(this.key(RESPOND_KEY, P.red))
          .child(dimText("jump to pane", P.dim2))
          .when(Boolean(a), (el) => el.child(div().truncate().text_size(11).text_color(P.dim).child(`· ${this.where(a)}`))));
    }

    if (kind === "done" && ev?.event === "done") {
      const who = a ? `${agentWord(a)}@${a.address}` : ev.name;
      const title = a?.title ? `“${a.title}”` : body;
      const turn = a ? safe(terminals, []).find((t) => t?.address === a.address)?.turn : null;
      const meta = a ? [`pane ${a.address}`, typeof turn === "number" ? `turn ${turn}` : null].filter(Boolean).join(" · ") : "";
      return v_flex().gap(3).min_w(0)
        .child(h_flex().gap(8).items_center().min_w(0)
          .child(this.tag(STATES.done.tag, P.green))
          .child(h_flex().flex_1().min_w(0).overflow_hidden().text_size(13)
            .child(div().flex_none().text_color(P.fg).child("Finished "))
            .child(div().flex_none().text_color(P.fg).font_weight(700).child(who))
            .child(div().truncate().text_color(P.dim2).child(".service")))
          .child(div().flex_none().font_family(FONT_JP).text_size(16).text_color(P.green).child(STATES.done.kanji)))
        .child(h_flex().gap(10).min_w(0).overflow_hidden()
          .when(Boolean(title), (el) => el.child(div().truncate().font_family(FONT_TERM).text_size(12).text_color(P.fgTerm).child(title)))
          .when(Boolean(a), (el) => el.child(div().flex_none().text_size(11).text_color(P.dim).child(this.where(a)))))
        .child(h_flex().gap(6).min_w(0)
          .child(div().flex_1().truncate().text_size(11).text_color(P.dim).child(meta))
          .child(dimText("click view", P.dim)));
    }

    // generic: warn / done / info with the notify()'s own title + body
    const color = kind === "warn" ? P.red : kind === "done" ? P.green : null;
    const tagText = kind === "warn" ? (p.level === "error" ? "[FAIL]" : "[WARN]") : kind === "done" ? STATES.done.tag : null;
    return v_flex().gap(3).min_w(0)
      .child(h_flex().gap(8).items_center().min_w(0)
        .when(Boolean(tagText), (el) => el.child(this.tag(tagText, color)))
        .when(Boolean(p.icon), (el) => el.child(image(p.icon).w(14).h(14).flex_none()))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(P.fg)
          .child(machine ? `${machine} needs a login: run` : p.title ?? "")))
      .when(!machine && Boolean(body), (el) => el.child(div().truncate().text_size(12).text_color(P.dim2).child(body)))
      .when(Boolean(machine), (el) => el.child(this.loginRow(`hc machine login ${machine}`)));
  }

  render(cx) {
    const p = props() ?? {};
    const kind = kindOf(p);
    const ev = agentEvent(p.title);
    const isWait = kind === "warn" && ev?.event === "wait";
    const isDone = kind === "done";
    const color = kind === "warn" ? P.red : kind === "done" ? P.green : P.grey;
    const { w, h } = this;
    const calm = this.calm;
    const entering = this.stage === 0;
    const fading = this.stage === 2;

    // the drawn card: plate, glow outline, (WAIT) hazard band, text
    let card = div().id("ph-toast-card").absolute().top(0).h(h).overflow_hidden()
      .child(plate(w, h, P.void, { cut: CUT }))
      .child(plate(w, h, kind === "info" ? P.panel : alpha(color, 0.07), { cut: CUT }))
      .child(kind === "info" ? outline(w, h, P.grey, { cut: CUT }) : glowOutline(w, h, color, { cut: CUT, calm }));
    if (isWait) {
      const bh = h - 12;
      const band = div().id("ph-toast-band").absolute().left(6).top(6).w(BAND_W).h(bh)
        .child(hazard(BAND_W, bh, P.red, { calm, cut: 4, corners: "tl bl", stripe: 3, interval: 7 }));
      card = card.child(blink(band, true, { period: 700, from: 0.3, calm }));
    }
    card = card.child(div().absolute().top(0).left(isWait ? BAND_W + 16 : 14).w(w - (isWait ? BAND_W + 16 : 14) - 14).h(h)
      .flex().flex_col().justify_center().font_family(FONT_UI).child(this.content(p, kind)));

    // entry motion (full only): OK types in (width), WAIT slides in (left), others fade in
    if (isDone) card = card.w(entering ? 0 : w).left(0);
    else card = card.w(w).left(isWait && entering ? 24 : 0);
    card = card.opacity(fading ? 0 : entering && !isDone ? 0 : 1);
    if (!calm) {
      card = card.transition("width", { duration: IN_MS, easing: "ease-out" })
        .transition("left", { duration: 220, easing: "ease-out" })
        .transition("opacity", fading ? { duration: FADE_MS, easing: "linear" } : { duration: 180, easing: "ease-out" });
    }

    return div().id("ph-toast").relative().size_full().bg(P.void).cursor_pointer()
      .on_size_change((size, cx) => {
        const z = safe(() => settings()?.zoom, 1) || 1; // design px, like .w()/.h()
        const nw = Math.round(size.width / z), nh = Math.round(size.height / z);
        if (nw !== this.w || nh !== this.h) { this.w = nw; this.h = nh; cx.notify(); }
      })
      .on_click(() => this.click(p))
      .child(card);
  }
}

function pad2(n) { return typeof n === "number" ? String(n).padStart(2, "0") : String(n ?? "?"); }
function safe(fn, dflt) { try { const v = fn(); return v ?? dflt; } catch { return dflt; } }

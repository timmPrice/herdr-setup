// PHOSPHOR boot overlay: once per app run, a ~1.3 s boot log built from real data.
// Opened by ph-title's init as a frameless full-window overlay (kind "window", 1×1 share).
//
// - Lines append every ~160 ms (faster if there are many), the 40-cell bar fills, then it closes itself.
// - Any key, any click (or Esc) skips it at once.
// - Never in calm. Never twice per app run: module scope (survives layout switches) plus sessionStorage
//   (survives hot reload of this mod, gone when the app quits). ph-title has its own guard as well.
// - Timers here are a one-off, ~10 redraws in total; nothing loops after it closes.
import { View, div, image, PathBuilder } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {
  props, shared, spaces, agents, terminals, layout, fonts, focused, updates, settings,
  closeOverlay, run, readTextFile,
} from "herdr";
import { P, FONT_UI, FONT_NUM, FONT_MARK, FONT_JP, FONT_TERM, KANJI, alpha } from "./lib/palette.js";
import { isCalm, cursor } from "./lib/motion.js";
import { plate, glowOutline } from "./lib/plate.js";
import { bootLines, parseTelemetry, stepFor, cellsFor } from "./bootlines.js";

const RAN_KEY = "ph.boot.ran";
const HOLD = 260;            // ms the full bar stays up before closing
const CELLS = 40;
const LINE_H = 27;
const FONTS = [["ShareTech", FONT_UI], ["VT323", FONT_NUM], ["KosugiMaru", FONT_JP], ["Wordmark", FONT_MARK]];
const GLOW = "mods/ph-boot/wordmark-glow.png";

let ranThisModule = false;   // module scope: shared by every copy while this source version lives

function alreadyRan() {
  if (ranThisModule) return true;
  try { return !!sessionStorage.getItem(RAN_KEY); } catch { return false; }
}
function markRan() {
  ranThisModule = true;
  try { sessionStorage.setItem(RAN_KEY, String(Date.now())); } catch {}
}

async function readOr(path) {
  try { return await readTextFile(path); } catch { return null; }
}

export default class PhBoot extends View {
  init(_props, cx) {
    this.size = null;
    this.lines = [];          // frozen lines shown so far
    this.telemetry = null;
    this.closed = false;
    this.started = Date.now();
    this.bootId = (this.started & 0xffff).toString(16).toUpperCase().padStart(4, "0");
    this.skip = isCalm() || alreadyRan();
    if (this.skip) { cx.timer.after(0, () => this.close(false)); return; }
    markRan();
    this.returnPane = focused()?.pane ?? null;
    this.h = cx.focus_handle();
    try { this.version = updates()?.app?.version ?? null; } catch { this.version = null; }

    // /proc telemetry, off the UI thread; lines appended later pick it up.
    cx.spawn(async (cx) => {
      const [cpuinfo, meminfo, route] = await Promise.all(["/proc/cpuinfo", "/proc/meminfo", "/proc/net/route"].map(readOr));
      const t = parseTelemetry({ cpuinfo, meminfo, route });
      if (t.iface) t.speed = parseTelemetry({ speed: await readOr(`/sys/class/net/${t.iface}/speed`) }).speed;
      this.telemetry = t;
    });

    // Estimate the line count now for the pace; it is re-derived each tick from live data.
    this.step = stepFor(this.fresh().length);
    this.append();
    const tick = (cx) => {
      if (this.closed) return;
      if (this.append()) { cx.notify(); cx.timer.after(this.step, tick); }
      else { cx.notify(); cx.timer.after(HOLD, () => this.close(true)); }
    };
    cx.timer.after(this.step, tick);
    cx.timer.after(0, () => { try { this.h.focus(); } catch {} });
    // Safety: whatever happens, never stay up longer than 2.5 s.
    cx.timer.after(2500, () => this.close(true));
  }

  fresh() {
    let tree = null, name = null, have = [];
    try { tree = layout(); } catch {}
    try { name = shared("layout"); } catch {}
    try { have = fonts(); } catch {}
    return bootLines({
      layout: name, tree, fontsWanted: FONTS, fontsHave: have,
      spaces: spaces() ?? [], agents: agents() ?? [], terminals: terminals() ?? [], telemetry: this.telemetry,
    });
  }

  /** Freeze the next line from live data. Returns true while more lines remain. */
  append() {
    const f = this.fresh();
    if (this.lines.at(-1)?.last) return false;
    this.lines.push(f[Math.min(this.lines.length, f.length - 1)]);
    this.total = Math.max(f.length, this.lines.length);
    return !this.lines.at(-1).last;
  }

  close(refocus) {
    if (this.closed) return;
    this.closed = true;
    const id = props()?.overlay;
    if (id) closeOverlay(id);
    // Hand the keyboard back to the pane that had it (the overlay took it to catch skip keys).
    if (refocus && this.returnPane) { try { run("pane.focus", { pane: this.returnPane }); } catch {} }
  }

  scan(w, h) {
    const key = `${w}x${h}`;
    if (this.scanKey !== key) {
      let b = PathBuilder.fill();
      for (let y = 1; y < h; y += 3) b = b.move_to(0, y).line_to(w, y).line_to(w, y + 1).line_to(0, y + 1).close();
      this.scanPath = b.build();
      this.scanKey = key;
    }
    return window.paint_path(this.scanPath, alpha(P.amber, 0.022)).absolute().left(0).top(0).w(w).h(h);
  }

  render(cx) {
    const root = div().id("ph-boot").size_full().relative()
      .on_size_change((size, cx) => { this.size = size; cx.notify(); });
    if (this.skip || this.closed) return root;

    const skip = (_e, cx) => { cx.stop_propagation(); this.close(true); };
    // on_size_change reports zoomed px (seen live: 504x288 for a 420x240 block at zoom 1.2); element sizes are unzoomed.
    let z = 1;
    try { z = Number(settings()?.zoom) || 1; } catch {}
    const pxW = this.size?.width ?? 1600 * z, pxH = this.size?.height ?? 900 * z;
    const winW = pxW / z, winH = pxH / z;
    const W = Math.max(560, Math.min(1120, winW - 48));
    const pad = 36;
    const nLines = Math.max(this.total ?? 6, this.lines.length);
    const H = 96 + 18 + nLines * LINE_H + 14 + 40 + 46;
    const shown = this.lines.length;
    const filled = cellsFor(shown, nLines, CELLS);
    const pct = Math.round((100 * shown) / nLines);
    const now = new Date();
    const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
    const lay = (() => { try { return shared("layout"); } catch { return null; } })() ?? "?";
    const gap = 4, barW = W - 2 * pad - 92;
    const cellW = Math.max(4, Math.floor((barW + gap) / CELLS) - gap);

    const tagEl = (l) => {
      const box = div().relative().w(66).h(20).flex_none();
      if (l.tag === "[WAIT]") {
        return box.child(plate(66, 20, P.red, { cut: 4 }))
          .child(div().absolute().inset_0().flex().items_center().justify_center().font_family(FONT_TERM).text_size(15).font_weight(700).text_color(P.void).child("WAIT"));
      }
      return box.child(div().absolute().inset_0().flex().items_center().justify_center().font_family(FONT_TERM).text_size(15).text_color(l.color)
        .child(div().text_color(P.dim2).child("[")).child(div().flex_1().flex().justify_center().font_weight(700).child(l.tag.slice(1, -1).trim()))
        .child(div().text_color(P.dim2).child("]")));
    };
    const lineEl = (l, i) => h_flex().id(`l${i}`).h(LINE_H).gap(14).items_center().font_family(FONT_UI).text_size(18).text_color(P.fg)
      .child(tagEl(l))
      .child(h_flex().items_center().min_w(0).truncate().children(l.parts.map((p) => div().flex_none().when(!!p.color, (e) => e.text_color(p.color)).child(p.text))))
      .when(!!l.last, (e) => e.child(div().ml(4).child(cursor(true, { color: P.amber, size: 18, calm: false }))));

    const corner = (x, y, dx, dy) => window.paint_path(
      PathBuilder.stroke(2).move_to(x + dx * 26, y).line_to(x, y).line_to(x, y + dy * 26).build(), P.amber)
      .absolute().left(0).top(0).w(W).h(H);

    const header = h_flex().h(96).items_center().gap(20).border_b(1).border_color(P.line)
      .child(div().relative().h(64).flex().items_center()
        .child(image(GLOW).absolute().left(-24).top(-14).w(330).h(92).opacity(0.55))
        .child(div().font_family(FONT_MARK).text_size(46).text_color(P.amber).child("HERDR/OS")))
      .child(div().font_family(FONT_JP).text_size(40).text_color(P.amber).child(KANJI.boot))
      .child(v_flex().gap(4).font_family(FONT_UI).text_size(15).text_color(P.dim2)
        .child(h_flex().gap(8).child(div().text_color(P.fg).child("PHOSPHOR CONSOLE")).child("·").child("tty0"))
        .child(div().child([`herdr ${this.version ?? ""}`.trim(), `layout ${lay}`, `${Math.round(pxW)}×${Math.round(pxH)}`].join(" · "))))
      .child(div().flex_1())
      .child(v_flex().items_end().font_family(FONT_NUM).text_size(26).line_height(1)
        .child(div().text_color(P.dim2).child(`BOOT 0x${this.bootId}`))
        .child(div().text_color(P.amber).child(clock)));

    const bar = h_flex().h(40).items_center().gap(16)
      .child(h_flex().gap(gap).children(Array.from({ length: CELLS }, (_, i) => div().w(cellW).h(16).bg(i < filled ? P.amber : P.panel2))))
      .child(div().flex_1())
      .child(div().font_family(FONT_NUM).text_size(30).text_color(P.amber).child(`${pct}%`));

    const footer = h_flex().h(46).items_end().font_family(FONT_UI).text_size(14).text_color(P.dim)
      .child(div().child("once per run · 1.3 s · any key / click / esc skips"))
      .child(div().flex_1())
      .child(div().child("MOTION ON"));

    const panel = div().id("ph-boot-panel").relative().w(W).h(H).flex_none()
      .child(window.paint_path(PathBuilder.fill().add_polygon([[0, 18], [18, 0], [W, 0], [W, H - 18], [W - 18, H], [0, H]], true).build(), P.pane)
        .absolute().left(0).top(0).w(W).h(H))
      .child(this.scan(W, H))
      .child(glowOutline(W, H, P.amber, { cut: 18 }))
      .child(corner(W - 8, 8, -1, 1))
      .child(corner(8, H - 8, 1, -1))
      .child(v_flex().absolute().left(pad).top(0).w(W - 2 * pad).h(H)
        .child(header)
        .child(v_flex().pt(18).pb(14).children(this.lines.map(lineEl)))
        .child(bar)
        .child(footer));

    return root.bg(alpha(P.void, 0.9)).flex().items_center().justify_center()
      .track_focus(this.h)
      .on_key_down(skip)
      .on_mouse_down("left", skip)
      .on_mouse_down("right", skip)
      .on_mouse_down("middle", skip)
      .child(panel);
  }
}

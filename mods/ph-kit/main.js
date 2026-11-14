// ph-kit: PHOSPHOR's shared kit. Carries the fonts (fonts/: Share Tech Mono, VT323, Orbitron, Kosugi Maru
// subset) and sits in the layout as an invisible 0 px block so that it is always shown and can:
//  - own the calm/full switch: shared("ph.intensity") is the only place intensity lives (no layout props,
//    so switching never starts a mod over and no history is lost). Commands (keys.json, `herdr-app do`,
//    ./intensity.sh): ph-kit.calm, ph-kit.full, ph-kit.toggle (also "intensity[:calm|full|toggle]").
//    setShared re-renders every mod; each reads intensity() in render();
//  - answer the "respond" key: keys.json "ph-kit.respond" → agent.focus on the oldest blocked agent.
import { View, div } from "gpui-kit";
import { shared, setShared, agents, spaces, run, nextCommand, layout } from "herdr";
import { Since, tabSeed, oldestBlocked } from "./lib/since.js";
import { INTENSITY_KEY, intensityCommand, resolveIntensity } from "./lib/motion.js";
import { applyLook } from "./lib/look.js";

export default class PhKit extends View {
  init(_props, cx) {
    this.since = new Since();
    // A value set while the window was closed (or by hand) gets its look on start.
    cx.timer.after(0, () => this.syncLook());
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "respond") this.respond();
        else this.setIntensity(c);
        cx.notify();
      }
    });
  }

  setIntensity(cmd) {
    let cur;
    try { cur = shared(INTENSITY_KEY); } catch { cur = undefined; }
    const want = intensityCommand(cmd, cur);
    if (!want) return;
    if (want !== cur) setShared(INTENSITY_KEY, want);
    this.syncLook(want);
  }

  /** The scanline look follows the value (layout.set on the shown phosphor tree; mod props untouched). */
  syncLook(want = resolveIntensity(shared(INTENSITY_KEY))) {
    try {
      const next = applyLook(layout(), want);
      if (next) run("layout.set", { layout: next });
    } catch (e) {
      console.warn("ph-kit: couldn't set the " + want + " look: " + (e?.message ?? e));
    }
  }

  respond() {
    const list = agents();
    this.since.observe(list, Date.now(), tabSeed(spaces()));
    const a = oldestBlocked(list, this.since);
    if (a) run("agent.focus", { terminal: a.address });
  }

  render() {
    this.since.observe(agents(), Date.now(), tabSeed(spaces()));
    return div().id("ph-kit").size_full();
  }
}

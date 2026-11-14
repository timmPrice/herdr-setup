// ph-kit: PHOSPHOR's shared kit. Carries the fonts (fonts/: Share Tech Mono, VT323, Orbitron, Kosugi Maru
// subset) and sits in the layout as an invisible 0 px block so that it is always shown and can:
//  - mirror the layout's props.intensity into shared("ph.intensity") (intensity.sh edits the layout;
//    a block whose props change starts over, so init runs again), for mods without props (ph-toast);
//  - answer the "respond" key: keys.json "ph-kit.respond" → agent.focus on the oldest blocked agent.
import { View, div } from "gpui-kit";
import { props, shared, setShared, agents, spaces, run, nextCommand } from "herdr";
import { Since, tabSeed, oldestBlocked } from "./lib/since.js";

export default class PhKit extends View {
  init(_props, cx) {
    this.since = new Since();
    const want = props()?.intensity;
    if ((want === "calm" || want === "full") && shared("ph.intensity") !== want) setShared("ph.intensity", want);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "respond") this.respond();
        cx.notify();
      }
    });
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

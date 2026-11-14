// STUB (feature: boot builder). The once-per-run boot overlay (opened by ph-title). Renders nothing and
// closes itself at once.
import { View, div } from "gpui-kit";
import { props, closeOverlay } from "herdr";

export default class PhBoot extends View {
  init(_props, cx) {
    cx.timer.after(16, () => { const id = props()?.overlay; if (id) closeOverlay(id); });
  }
  render() { return div().id("ph-boot"); }
}

// One shared minute boundary for every PHOSPHOR mod. ph-title, ph-status, ph-side, ph-pane and
// ph-telemetry each re-arm a timer.after() to the next wall-clock minute plus the same small offset
// (never a drifting every(60000)), so their notifies land in the same frame: an idle window gets at
// most one coalesced redraw a minute.

/** Fixed offset past the minute boundary, so a clock read in render() is already on the new minute. */
export const MINUTE_OFFSET = 20;

/** Pure: ms from `now` (epoch ms) to the next minute boundary + MINUTE_OFFSET. 1 .. 60000 + offset. */
export function msToMinuteTick(now) {
  const r = 60000 - (now % 60000);
  return r + MINUTE_OFFSET;
}

/**
 * Calls fn(cx) on every aligned minute tick, re-aligning each time. fn returning false ends the chain.
 * cx is a view context with timer.after (the callback's cx is passed on).
 */
export function everyMinute(cx, fn) {
  const go = (cx) => { if (fn(cx) !== false) cx.timer.after(msToMinuteTick(Date.now()), go); };
  cx.timer.after(msToMinuteTick(Date.now()), go);
}

import test from "node:test";
import assert from "node:assert/strict";
import { msToMinuteTick, MINUTE_OFFSET, everyMinute } from "../lib/tick.js";

test("minute tick: next boundary + the shared offset, from anywhere in the minute", () => {
  assert.equal(msToMinuteTick(0), 60_000 + MINUTE_OFFSET);
  assert.equal(msToMinuteTick(59_000), 1_000 + MINUTE_OFFSET);
  for (const now of [1, 17_123, 1_700_000_000_123, 1_700_000_040_000 + MINUTE_OFFSET]) {
    const at = now + msToMinuteTick(now);
    assert.equal(at % 60_000, MINUTE_OFFSET);
    assert.ok(msToMinuteTick(now) > 0 && msToMinuteTick(now) <= 60_000 + MINUTE_OFFSET);
  }
  // fired on time: the next one is exactly a minute later (no drift, no double tick)
  assert.equal(msToMinuteTick(1_700_000_040_000 + MINUTE_OFFSET), 60_000);
});

test("everyMinute re-aligns each tick (no drift) and stops when fn returns false", () => {
  const realNow = Date.now;
  let clock = 1_700_000_000_000 + 12_345;
  const queue = [];
  const cx = { timer: { after: (ms, cb) => queue.push({ at: clock + ms, cb }) } };
  let n = 0;
  Date.now = () => clock;
  try {
    everyMinute(cx, () => ++n < 4);
    while (queue.length) {
      const { at, cb } = queue.shift();
      clock = at + 37; // every timer fires 37 ms late
      assert.equal(at % 60_000, MINUTE_OFFSET, "each tick aims at the boundary + offset");
      cb(cx);
    }
  } finally { Date.now = realNow; }
  assert.equal(n, 4);
});

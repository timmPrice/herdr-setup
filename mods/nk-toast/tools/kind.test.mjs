// node mods/nk-toast/tools/kind.test.mjs  (exits non-zero on a failure)
import { kindOf, loginMachine } from "../kind.js";

const cases = [
  // the reviewer's titles: names with done-words that need you are warnings
  [{ title: "release-ready needs you" }, "warn"],
  [{ title: "done-check needs you" }, "warn"],
  [{ title: "build-complete needs you" }, "warn"],
  [{ title: "Ready to restart" }, "info"],
  // and the other way round: names with warn-words that finished are done
  [{ title: "manager-2 finished", body: "meeseeks 2 / 1" }, "done"],
  [{ title: "fix-errors finished" }, "done"],
  [{ title: "blocked-waiter finished" }, "done"],
  [{ title: "Claude Code needs you", body: "space / tab" }, "warn"],
  // other Herdr strings
  [{ title: "herdr-core update failed: timeout" }, "warn"],
  [{ title: "Terminal failed to start" }, "warn"],
  [{ title: "Updated to 0.1.15" }, "info"],
  [{ title: "Couldn't make the space", body: "box needs login; run hc machine login box" }, "warn"],
  // explicit levels win
  [{ title: "release-ready needs you", level: "success" }, "done"],
  [{ title: "all done", level: "error" }, "warn"],
  [{ title: "Tests passed", level: "info" }, "info"],
  // general words
  [{ title: "Build complete" }, "done"],
  [{ title: "Deploy done", body: "but 2 errors" }, "warn"],
  [{ title: "Hello" }, "info"],
  [{}, "info"],
];

let bad = 0;
for (const [p, want] of cases) {
  const got = kindOf(p);
  if (got !== want) { bad++; console.log(`FAIL ${JSON.stringify(p)} -> ${got}, want ${want}`); }
}
const logins = [
  ["box needs login; run hc machine login box", "box"],
  ["vps-1.eu needs login; run hc machine login vps-1.eu", "vps-1.eu"],
  ["box needs login; run hc machine login other", null],
  ["", null],
  [undefined, null],
];
for (const [b, want] of logins) {
  const got = loginMachine(b);
  if (got !== want) { bad++; console.log(`FAIL loginMachine(${JSON.stringify(b)}) -> ${got}, want ${want}`); }
}
const n = cases.length + logins.length;
console.log(bad ? `${bad}/${n} failed` : `ok ${n}/${n}`);
process.exit(bad ? 1 : 0);

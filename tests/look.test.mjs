import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyLook, lookOf } from "../lib/look.js";

const repo = JSON.parse(readFileSync(new URL("../layouts/phosphor.json", import.meta.url)));

function mods(n, out = []) {
  if (Array.isArray(n)) n.forEach((c) => mods(c, out));
  else if (n && typeof n === "object") { if (typeof n.mod === "string") out.push(n); Object.values(n).forEach((c) => mods(c, out)); }
  return out;
}

test("the repo layout has the full look and no intensity props", () => {
  assert.equal(lookOf(repo), "full");
  assert.equal(applyLook(repo, "full"), null);
  assert.ok(!JSON.stringify(repo).includes("\"intensity\""));
});

test("calm and back round-trips, never touching mod props", () => {
  const calm = applyLook(repo, "calm");
  assert.equal(calm.background, "canvas");
  assert.equal(calm.terminal_opacity, 1);
  assert.equal(lookOf(calm), "calm");
  assert.deepEqual(mods(calm).map((m) => [m.mod, m.props]), mods(repo).map((m) => [m.mod, m.props]));
  assert.deepEqual(applyLook(calm, "full"), repo);
  assert.equal(applyLook(calm, "calm"), null);
  assert.ok(repo.background.image, "input not mutated");
});

test("a leftover props.intensity is removed (other props kept)", () => {
  const old = JSON.parse(JSON.stringify(repo));
  mods(old).forEach((m) => { if (m.mod.startsWith("ph-")) m.props = { ...(m.props ?? {}), intensity: "calm" }; });
  const fixed = applyLook(old, "full");
  assert.deepEqual(fixed, repo);
});

test("intensity.sh (window closed path) makes the same edit as lib/look.js", () => {
  const dir = mkdtempSync(join(tmpdir(), "ph-look-"));
  try {
    const f = join(dir, "phosphor.json");
    writeFileSync(f, JSON.stringify(repo));
    execFileSync("./intensity.sh", ["calm"], { env: { ...process.env, PH_LAYOUT: f }, cwd: new URL("..", import.meta.url) });
    assert.deepEqual(JSON.parse(readFileSync(f)), applyLook(repo, "calm"));
    execFileSync("./intensity.sh", ["full"], { env: { ...process.env, PH_LAYOUT: f }, cwd: new URL("..", import.meta.url) });
    assert.deepEqual(JSON.parse(readFileSync(f)), repo);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("f32 opacity from Herdr counts as the same look", () => {
  const saved = { ...repo, terminal_opacity: 0.699999988079071 };
  assert.equal(applyLook(saved, "full"), null);
  assert.equal(lookOf(saved), "full");
});

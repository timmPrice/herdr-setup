// Agent → blossom anchor assignment for nk-sakura. Pure (no herdr/gpui imports) so it can be
// tested with plain node: `node mods/nk-sakura/tools/assign.test.mjs`.

// Hand-picked anchors in tree-v1.svg's units: [x, y, limb]. Limbs:
// 0 centre, 1 left-upper, 2 right-upper, 3 left-low, 4 right-low.
export const ANCHORS = [
  [152, 14, 0], [160, 26, 0], [140, 38, 0], [154, 40, 0], [194, 34, 0], [188, 48, 0],
  [38, 44, 1], [56, 50, 1], [58, 80, 1], [72, 74, 1], [108, 46, 1], [112, 58, 1], [98, 66, 1],
  [256, 26, 2], [248, 38, 2], [230, 20, 2], [236, 34, 2], [262, 76, 2], [248, 78, 2],
  [34, 102, 3], [50, 106, 3], [80, 94, 3], [86, 106, 3], [100, 142, 3], [112, 140, 3], [66, 116, 3],
  [276, 112, 4], [266, 122, 4], [266, 150, 4], [256, 148, 4],
];
export const LIMBS = 5;

/** Remembered mapping, kept on the view instance across renders. */
export const newState = () => ({
  limbOf: {}, // space id → limb
  slotOf: {}, // agent address → { anchor, space }
});

// Agents → anchor indices (array of length ANCHORS.length, agent or null), stable across renders:
// - a space keeps its limb while it has agents; a new space gets the lowest free limb (if all 5 are
//   taken, the least-shared limb, lowest first);
// - an agent keeps its anchor while it exists (and stays in the same space); a newcomer gets the
//   lowest free anchor on its space's limb, else the lowest free anchor anywhere, else no blossom;
// - entries for spaces/agents that are gone are dropped, freeing their limb/anchor.
// Mutates `state`.
export function assign(list, state) {
  const { limbOf, slotOf } = state;
  const spaces = new Set(list.map((a) => a.space));
  const live = new Set(list.map((a) => a.address));
  for (const s of Object.keys(limbOf)) if (!spaces.has(s)) delete limbOf[s];
  for (const addr of Object.keys(slotOf)) if (!live.has(addr)) delete slotOf[addr];

  // Limbs for new spaces, in order of first appearance.
  for (const a of list) {
    if (a.space in limbOf) continue;
    const load = new Array(LIMBS).fill(0);
    for (const l of Object.values(limbOf)) load[l]++;
    limbOf[a.space] = load.indexOf(Math.min(...load));
  }

  const used = new Array(ANCHORS.length).fill(null);
  // Keep remembered anchors first so newcomers can't take them.
  const fresh = [];
  for (const a of list) {
    const s = slotOf[a.address];
    if (s && s.space === a.space && used[s.anchor] === null) used[s.anchor] = a;
    else fresh.push(a);
  }
  for (const a of fresh) {
    const limb = limbOf[a.space];
    let i = ANCHORS.findIndex((p, k) => p[2] === limb && used[k] === null);
    if (i < 0) i = used.indexOf(null);
    if (i < 0) {
      delete slotOf[a.address]; // no room: no blossom (still listed)
      continue;
    }
    used[i] = a;
    slotOf[a.address] = { anchor: i, space: a.space };
  }
  return used;
}

# Neo-Kyoto

Herdr's own window (spaces and agents on the left, tabs, panes as cards, Files/Changes, status bar)
dressed as a Japanese-cyberpunk street at night: near-black gruvbox (#0f0f0f), sakura-pink accent,
aqua neon on the focused pane. Each pane wears a kanji neon sign for its agent's status, a sakura tree
in the top right blooms one blossom per agent, and notifications arrive stamped with a red hanko seal.
One switch (`calm` / `full`) dials all the motion down.

![Neo-Kyoto](preview.png)

## What you see

Left to right, top to bottom (sizes at zoom 1):

- **Sidebar**, 268px, `chrome` background, not resizable: Herdr's `workspace-chrome` brand row (46px),
  `spaces` and `agents` lists sharing the height equally (min 90px each), `workspace-chrome` footer (69px).
- **Work column**: `tabs` bar (42px, window drag), then a row with 8px padding and 8px gap holding the
  panes and a hidden 368px Files/Changes panel, then the `workspace-status` bar (28px).
- **Panes** are cards: 10px radius, 8px gap, `background` fill, 1px `border`, framed even when alone.
  The focused pane's border is aqua #8ec07c. Terminal padding 14×12px.
- **Pane header** (32px, top, always shown), left to right: a neon sign chip (22px tall) with the status
  kanji in Kosugi Maru at 16px, the pane's name, its folder (muted, truncated), a
  git-branch icon and branch (muted). A pane without an agent shows a 6px dot instead of the sign.
  Status → kanji and color: working 稼働 aqua #8ec07c, idle 待機 grey #928374, blocked 警告 orange
  #fe8019, done 完了 pink #d3869b, unknown 不明 grey. The chip is filled with the color at 0x22 alpha
  (0x33 focused) with a color border (0xaa focused, 0x55 not); a focused sign gets a faint outer ring.
  Unfocused signs sit at opacity 0.72, idle ones at 0.5.
- **Sakura tree**: a 280×220 floating block on the pane area, right edge, top (Herdr draws its frame).
  A brown gruvbox trunk and five limbs (#504945, #7c6f64, #3c3836) with 30 blossom spots. Each agent
  is a blossom; each space gets a limb (centre, left-upper, right-upper, left-low, right-low). A space
  keeps its limb and an agent keeps its spot while they exist; newcomers take the lowest free limb or
  spot, overflow spills to any free spot, so blossoms never jump when agents come and go. Empty spots are small dim buds (#9a737e,
  opacity 0.6). The bottom-left corner holds a one-line summary, e.g. `警告2 完了2 稼働3 待機2`.
- **Toasts** (bottom right, Herdr's overlay): a #1d2021 card with a 1px border in the kind's color and
  a tall red hanko seal (#fb4934, cream #fbf1c7 kanji, ink-jittered edge) on the left, title and body
  in the UI font. 完了 (done, pink border), 警告 (warning, orange), 通知 (anything else, aqua).
- **Theme** `neo-kyoto`: gruvbox-grey (bg #0f0f0f, fg #ebdbb2, selection #3c3836), cursor and accent
  #d3869b, status colors as above.

## How it behaves

- **working**: the pane sign pulses opacity slowly (2.6s); the blossom is aqua and pulses (2.2s); in
  full intensity up to 6 petals drift down from the tree, one per working agent.
- **blocked**: the pane sign flickers like a failing neon tube (full only): characters drop to an unlit
  copy for 60–180ms, about 4 times per 3.4s, never to black, each pane out of step with the others.
  The blossom turns orange and a paper lantern hangs from it (pulsing at 700ms in full, steady in calm).
- **done**: pink 完了 sign, a bigger full-pink blossom (17px), still.
- **idle**: grey 待機 sign at half opacity, a small soft-pink blossom, still.
- **Hover** a pane header: split right, split down, zoom/unzoom and close buttons appear (as in the
  shipped `pane` mod). Click the header: focus that pane.
- **Hover** a blossom: its agent's kanji status and name beside it. Hover the tree: the bottom-left
  corner lists up to 4 agents, blocked first, then done, working, idle, with `+N more`.
  Click a blossom or a row: `agent.focus` on that agent.
- **Toast**: in full, the seal stamps in (starts 1.3× and transparent, slams to size in 180ms) and the
  card fades over the last moments; it closes just before Herdr's own timeout (about 5s by default).
  Click runs the toast's action and closes. Herdr's machine-login toast shows the
  `hc machine login <m>` command with a Copy button that doesn't dismiss it.
- **Calm** (`./intensity.sh calm`): no flicker, no petals, no lantern pulse, no stamp or fade. Only
  the slow working pulse moves. `full` is the default.
- Drag the tree anywhere; it springs to the nearest edge like any floating block.

## Built from

- `layouts/neo-kyoto.json`: a copy of Herdr's shipped `main` (every block kept, including
  `{ "tab": "active" }`), with root `"theme": "neo-kyoto"`, `"toast": "nk-toast"`,
  `"preview": "layouts/neo-kyoto.svg"`. The `main` block's `pane` frame:
  `focus.color: "working"`, `header: { content: { mod: "nk-pane", props: { intensity } }, height: 30,
  position: "top", reveal: "always" }`, and `floating: [{ id: "sakura", content: { mod: "nk-sakura",
  props: { intensity } }, edge: "right", align: "start" }]`.
- Shipped mods used: `workspace-chrome`, `spaces`, `agents`, `tabs`, `files`, `changes`,
  `workspace-status`.
- `themes/neo-kyoto.json`: gruvbox ansi, `colors` accent/done #d3869b, working #8ec07c, blocked #fe8019,
  idle/unknown #928374.
- `mods/nk-pane` (`place: none`): reads `panes()` (status, focused, title, cwd, branch, program),
  `props()`, `theme()`, `layout()`; runs `pane.focus`, `pane.split`, `pane.zoom`, `pane.close`.
  Motion is native: `loop("opacity")` for the pulse, `.frames()` on the bright text copy for the
  flicker (a dim copy sits underneath). Ships `fonts/KosugiMaru-nk.ttf` (a subset: the status kanji,
  桜判通知, katakana, ASCII, … and U+3000) plus its Apache LICENSE.txt and NOTICE.txt; the shipped pane mod's button SVGs.
  At start it copies its `intensity` into `setShared("nk.intensity")` (only when it differs).
- `mods/nk-sakura` (`place: none`): reads `agents()`, `placement()`, `fonts()`; runs `agent.focus`.
  `tree-v1.svg` drawn once with `image()`, `blossom.svg`, `petal.svg` and `lantern.svg` tinted with
  `svg()`. The mapping lives in `assign.js` (pure, node-tested), remembered per copy in
  `limbOf` / `slotOf`. Petals: an outer div looping `left` (sway) around an inner one looping `top` (drop). Uses
  Kosugi Maru only if `fonts()` lists it. `props.demo: true` shows 9 fake agents for testing.
- `mods/nk-toast` (`place: none`): reads `props()` (title, body, level, icon, action, timeout, overlay)
  and `shared("nk.intensity")`; `closeOverlay`, `run` for the action, `cx.write_to_clipboard` for Copy.
  `kind.js` classifies: level error/warning → 警告, success → 完了, title `… needs you` → 警告,
  `… finished` → 完了, login body → 警告, warning words → 警告, done words → 完了, else 通知.
  The seals (`seal-{done,warn,info}-v4.svg`, 72×100) have the kanji baked in as Kosugi Maru outlines
  by `tools/make_seals.py`, so the toast needs no font.
- `intensity.sh` edits `intensity` in every `nk-*` props of the installed layout; `install.sh` keeps it.

## Watch out

- The root `"toast"` takes only a mod name, no props: that is why intensity reaches the toast through
  `shared("nk.intensity")`, set by `nk-pane`. With no pane header shown, the toast falls back to the
  last value set (or full).
- Herdr closes every toast overlay itself at its timeout (about 5s when missing or `null`; no toast is
  sticky). Close a little before it, mid-fade, or Herdr's frame shows empty for a moment.
- Herdr's toast titles end in ` needs you` / ` finished` after a user-chosen name; match those
  suffixes before any keyword, or "release-ready needs you" gets a done seal.
- `.frames()` only cycles text, so the flicker needs the dim copy underneath and U+3000 (ideographic
  space) in the font to hold each character's place. ▸ ◂ → • · are not in the Kosugi Maru subset.
- Kosugi Maru is Apache 2.0, not OFL: ship its LICENSE.txt and a NOTICE saying it was subset. Its family
  name is "Kosugi Maru" (with a space). Herdr caches images by path, so bump the seal file version when
  the art changes.
- `loop()` is ping-pong: petals float back up rather than fall forever. Keep the tree a fixed size so
  hover never changes the float's layout. More than 30 agents: the extras get no blossom.
- A blocked pane in full mode keeps the window redrawing on a 60ms clock until answered; calm stops it.
- The window this was tuned on is a 5120×1440 ultrawide at zoom 1.2: art is sized in px.

## Done when

- `./check.sh` prints `ok` for `mods/nk-pane`, `mods/nk-sakura` and `mods/nk-toast`;
  `node mods/nk-toast/tools/kind.test.mjs` prints `ok 24/24`; `node mods/nk-sakura/tools/assign.test.mjs`
  passes 8/8.
- After `./install.sh` and `herdr-app do layout.switch '{"name":"neo-kyoto"}'`, `herdr-app status`
  shows layout `neo-kyoto` and `errors: []`.
- A pane running an agent shows 稼働 while it works and 待機 when idle; a plain shell shows a dot.
- The tree sits top right of the pane area with one blossom per agent and a kanji summary line.
- A finished agent's toast shows the 完了 seal and closes by itself.
- `./intensity.sh calm` prints `calm` on `./intensity.sh`, petals and flicker stop, and toasts appear
  without the stamp; `./intensity.sh full` brings them back.

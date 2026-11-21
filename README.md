# Neo-Kyoto

A Japanese-cyberpunk layout for [Herdr](https://herdr.dev): gruvbox dark (#0f0f0f) with a sakura-pink
accent and aqua neon focus. Agent status shows up three ways:

- **Kanji pane headers** (`nk-pane`): every pane gets a neon sign: 稼働 working (aqua, slow pulse),
  待機 idle (grey), 警告 blocked (orange, flickers like a failing tube), 完了 done (pink).
- **Sakura tree** (`nk-sakura`): a floating tree in the top right. Every agent is a blossom, every
  space a limb. Blocked agents hang a lantern; working agents shed petals. Hover for names, click to focus.
  **`ctrl-shift-y` hides/shows it** (see [The tree in the way?](#the-tree-in-the-way)).
- **Hanko toast** (`nk-toast`): notifications get a red seal stamp: 完了, 警告 or 通知.

It is Herdr's own `main` layout (spaces, agents, tabs, Files/Changes, status bar) with these three
mods added, so nothing you rely on goes away. See [RECIPE.md](RECIPE.md) for the full description.

## Install

Needs `herdr-app` on your PATH, `python3` and `rsync`.

```sh
./install.sh                                      # checks every mod, then copies into ~/.config/herdr-app
herdr-app do layout.switch '{"name":"neo-kyoto"}'
```

`install.sh` only ever writes `layouts/neo-kyoto.*`, `themes/neo-kyoto.json` and `mods/nk-*`
(set `HERDR_APP_HOME` to install somewhere else), plus one key in `keys.json` (below). `./check.sh` runs
`herdr-app check` on every mod.

Reinstalling mirrors each `mods/nk-*` folder with `rsync --delete`: anything you added inside an
installed `nk-*` folder is removed (Herdr's own `jsconfig.json` and `gpui-kit.d.ts` are kept). Put your
own changes in the repo, or clone the mod under another name. The repo's `tools/` folders (tests, the
seal generator) are not installed.

## The tree in the way?

The sakura tree floats over the top right of your panes. `ctrl-shift-y` hides it and brings it back
(only while neo-kyoto is shown). Hover the tree and click the small `–` in its top-left corner to shrink
it to one line (桜 plus the status summary); click that line to get the tree back. Herdr remembers your
choice across restarts (the shared value `nk.sakura`). From a shell: `herdr-app do nk-sakura.toggle`.

`install.sh` adds the key to `~/.config/herdr-app/keys.json` only if `ctrl-shift-y` isn't bound
anywhere in it. It appends one section and leaves every other key as it was:

```json
"layout:neo-kyoto": { "ctrl-shift-y": "nk-sakura.toggle" }
```

If `ctrl-shift-y` is taken, the installer says so and changes nothing: add that section yourself with a
key you like.

## Switch layouts

`ctrl-shift-l` cycles layouts, or pick one by name:

```sh
herdr-app do layout.switch '{"name":"neo-kyoto"}'
herdr-app do layout.switch '{"name":"main"}'       # back to Herdr's default
```

## Calm mode

If it gets too busy, one command dials everything down:

```sh
./intensity.sh calm     # no flicker, no petals, no lantern pulse, no toast stamp/fade
./intensity.sh full     # back to everything
./intensity.sh          # print the current setting
```

Calm keeps only the slow "working" pulse. The switch edits the installed layout
(`~/.config/herdr-app/layouts/neo-kyoto.json`): it sets `"intensity"` in the props of the `nk-pane`
header and the `nk-sakura` float, and Herdr reloads it live. The toast can't take props, so `nk-pane`
copies its intensity into the shared value `nk.intensity`, which `nk-toast` reads.
`./install.sh` keeps the intensity you chose. You can also edit those two `props` by hand.

## Uninstall

Switch away first, then delete the installed files:

```sh
herdr-app do layout.switch '{"name":"main"}'
cd ~/.config/herdr-app
rm layouts/neo-kyoto.json layouts/neo-kyoto.svg themes/neo-kyoto.json
rm -r mods/nk-pane mods/nk-sakura mods/nk-toast
```

Then remove the key: delete `"ctrl-shift-y": "nk-sakura.toggle"` (and the `"layout:neo-kyoto"` section,
if that leaves it empty) from `~/.config/herdr-app/keys.json`, or run:

```sh
python3 - ~/.config/herdr-app/keys.json <<'EOF'
import json, os, sys
p = sys.argv[1]; k = json.load(open(p)); s = k.get("layout:neo-kyoto", {})
if s.get("ctrl-shift-y") == "nk-sakura.toggle": del s["ctrl-shift-y"]
if "layout:neo-kyoto" in k and not s: del k["layout:neo-kyoto"]
open(p + ".tmp", "w").write(json.dumps(k, indent=2) + "\n"); os.replace(p + ".tmp", p)
EOF
```

Apart from that one key, your own layouts, keys and settings are never touched. The shared values
`nk.intensity` and `nk.sakura` stay in Herdr's `shared.json`; they are harmless.

## Credits

The kanji use [Kosugi Maru](https://fonts.google.com/specimen/Kosugi+Maru) by MOTOYA (Apache License 2.0;
`LICENSE.txt` and `NOTICE.txt` in `mods/nk-pane/fonts/` and `mods/nk-toast/`). nk-pane ships a subset of it;
the toast seals have its outlines baked in as SVG paths.

# Neo-Kyoto

A Japanese-cyberpunk layout for [Herdr](https://herdr.dev): gruvbox dark (#0f0f0f) with a sakura-pink
accent and aqua neon focus. Agent status shows up three ways:

- **Kanji pane headers** (`nk-pane`): every pane gets a neon sign: 稼働 working (aqua, slow pulse),
  待機 idle (grey), 警告 blocked (orange, flickers like a failing tube), 完了 done (pink).
- **Sakura tree** (`nk-sakura`): a floating tree in the top right. Every agent is a blossom, every
  space a limb. Blocked agents hang a lantern; working agents shed petals. Hover for names, click to focus.
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
(set `HERDR_APP_HOME` to install somewhere else). `./check.sh` runs `herdr-app check` on every mod.

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

Your own layouts, keys and settings are never touched.

## Credits

The kanji use [Kosugi Maru](https://fonts.google.com/specimen/Kosugi+Maru) by MOTOYA (Apache License 2.0;
`LICENSE.txt` and `NOTICE.txt` in `mods/nk-pane/fonts/` and `mods/nk-toast/`). nk-pane ships a subset of it;
the toast seals have its outlines baked in as SVG paths.

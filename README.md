# herdr-phosphor

PHOSPHOR: a gruvbox amber/green CRT console look for the Herdr app (layout `phosphor`, theme, `ph-*` mods).
What it looks like and how it behaves: [RECIPE.md](RECIPE.md).

## Install

```sh
./install.sh
herdr-app do layout.switch '{"name":"phosphor"}'
```

`install.sh` runs `./check.sh` first and refuses to install if it fails. It copies `layouts/phosphor.*`,
`themes/phosphor.json`, `backgrounds/phosphor-*` and `mods/ph-*` into `~/.config/herdr-app` (`HERDR_APP_HOME`
overrides) and touches nothing else. In `keys.json` section `layout:phosphor` it adds `"ctrl-shift-u": "ph-kit.respond"`
and `"ctrl-shift-i": "ph-kit.toggle"`, each only if that key is free. Re-running it updates in place and keeps your calm/full choice.

## Switch

- To PHOSPHOR: `herdr-app do layout.switch '{"name":"phosphor"}'`, or pick it with `ctrl-shift-l`.
- Back to your previous layout: `ctrl-shift-l`, or `herdr-app do layout.switch '{"name":"<name>"}'`.

## Respond key

`ctrl-shift-u` jumps to the agent that has been blocked (`[WAIT]`) longest. It lives in section `layout:phosphor`, so
it only applies while PHOSPHOR is showing. Clicking the red title strip, the status line's WAIT count or a WAIT toast
does the same. To use another key, edit that entry in `~/.config/herdr-app/keys.json`; the status line, pane headers
and toasts read the key from there.

## Calm

```sh
./intensity.sh calm   # no scanlines, no blinking or loops, glow down to its core, solid hazard plates, no boot overlay
./intensity.sh full   # back to everything
./intensity.sh toggle # the other one (same as ctrl-shift-i while PHOSPHOR shows)
./intensity.sh        # print the current one
```

The value lives only in Herdr's shared state (`shared("ph.intensity")`), set by the `ph-kit` mod: `ctrl-shift-i`,
`herdr-app do ph-kit.calm` / `ph-kit.full` / `ph-kit.toggle`, or this script (which calls those). Every mod redraws
in place; none starts over, so the EVENTS log, the histogram, time-in-state clocks and CPU readings keep their history.
ph-kit also swaps the scanline look in the layout (background image, `terminal_opacity`, the main pane frame) with
`layout.set`; it never changes mod props. With the window closed the script edits the installed layout and
`shared.json` itself. The command palette (`ctrl-shift-p`) lists only Herdr's own commands, so use the key.

## Uninstall

```sh
herdr-app do layout.switch '{"name":"<another layout>"}'
H=~/.config/herdr-app
rm -f  $H/layouts/phosphor.json $H/layouts/phosphor.svg $H/themes/phosphor.json $H/backgrounds/phosphor-scanlines.png
rm -rf $H/mods/ph-kit $H/mods/ph-title $H/mods/ph-tabs $H/mods/ph-side $H/mods/ph-telemetry \
       $H/mods/ph-pane $H/mods/ph-status $H/mods/ph-toast $H/mods/ph-boot
```

Then remove the `"layout:phosphor"` section (it only holds `ctrl-shift-u`) from `~/.config/herdr-app/keys.json`.

## Develop

- `./check.sh` checks that lib/ copies are in sync, runs the node tests (`tests/`), validates the JSON and runs
  `herdr-app check` on lib and every mod.
- `node --import ./tests/stubs/register.mjs --test tests/*.test.mjs` runs only the node tests.
- `lib/` holds the shared helpers. Edit them there and run `tools/sync-lib.sh`, which copies them into each mod
  (mods can't import across folders).
- `tools/fake.sh <mod> tools/scenarios/demo.json [--install]` renders a mod with fake agents and spaces.
  `tools/fake.sh --clean` removes the installed fakes.
- `python3 -I tools/make-boot-art.py` regenerates the scanline background and the boot wordmark glow.
- Project rules: no sound; idle is still; minute-resolution clocks only, no per-second redraws; motion only on
  RUN/WAIT, and none in calm; amber means "you are here" and nothing else.
- Fonts are in `mods/ph-kit/fonts/`; their licences and changes are listed in `README.txt` there.

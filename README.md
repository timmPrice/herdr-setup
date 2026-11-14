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
and `"ctrl-shift-i": "ph-kit.toggle"`, each only if that key is free. Re-running it updates in place and keeps your calm/full choice;
it does replace edits made to the phosphor layout itself (a dragged sidebar width, for example).
Needs `herdr-app` on `PATH`, `python3`, `rsync` and `node` (check.sh runs the node tests).

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
herdr-app do layout.switch '{"name":"main"}'    # or any other layout you use
tools/fake.sh --clean                            # only if you installed dev fakes (phosphor-fake, mods/ph-*-fake)
H=~/.config/herdr-app
rm -f  $H/layouts/phosphor.json $H/layouts/phosphor.svg $H/themes/phosphor.json $H/backgrounds/phosphor-scanlines.png
rm -rf $H/mods/ph-kit $H/mods/ph-title $H/mods/ph-tabs $H/mods/ph-side $H/mods/ph-telemetry \
       $H/mods/ph-pane $H/mods/ph-status $H/mods/ph-toast $H/mods/ph-boot
rm -rf $H/data/ph-*                              # the mods' stored data (history, clocks); only PHOSPHOR uses ph-
```

Then, in `~/.config/herdr-app/keys.json` section `"layout:phosphor"`, remove `ctrl-shift-u` and `ctrl-shift-i`, and
the section itself if it is then empty.

Two keys stay in `shared.json`: `ph.intensity` and `ph.boot.ran`. They are harmless. To remove them, close the
window first (Herdr rewrites the file while it runs), then:

```sh
python3 -I -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); [d.pop(k,None) for k in ("ph.intensity","ph.boot.ran")]; json.dump(d,open(p,"w"))' ~/.config/herdr-app/shared.json
```

## Develop

- `./check.sh` checks that lib/ copies are in sync, runs the node tests (`tests/`), validates the JSON and runs
  `herdr-app check` on lib and every mod.
- `node --import ./tests/stubs/register.mjs --test tests/*.test.mjs` runs only the node tests.
- `lib/` holds the shared helpers. Edit them there and run `tools/sync-lib.sh`, which copies them into each mod
  (mods can't import across folders).
- `tools/fake.sh <mod> tools/scenarios/demo.json [--install] [--keep]` renders a mod with fake agents and spaces
  (the temp copy is removed on exit unless `--keep`). `tools/fake.sh --clean` removes the installed fakes and their
  `data/ph-*-fake`; switch back to phosphor first if phosphor-fake is shown.
- `preview.png` is made from fake data only: `tools/fake.sh <m> tools/scenarios/preview.json --install` for ph-title,
  ph-tabs, ph-side, ph-telemetry, ph-pane and ph-status (the scenario also fakes the /proc figures); a throwaway space
  `herdr-app do space.new '{"name":"demo","folder":"/tmp","argv":["sh","<repo>/tools/preview-term.sh"]}'` for the
  terminal text; `layout.switch` to phosphor-fake, `herdr-app shot`; then switch back, close the space and
  `tools/fake.sh --clean`.
- `python3 -I tools/make-boot-art.py` regenerates the scanline background and the boot wordmark glow.
- Project rules: no sound; idle is still; minute-resolution clocks only, no per-second redraws; motion only on
  RUN/WAIT, and none in calm; amber means "you are here" and nothing else.
- Fonts are in `mods/ph-kit/fonts/`; their licences and changes are listed in `README.txt` there.

# herdr-phosphor

PHOSPHOR: a gruvbox amber/green CRT console look for the Herdr app (layout `phosphor`, theme, `ph-*` mods).

- `./check.sh` checks that lib/ copies are in sync, runs the node tests (`tests/`), validates the JSON and runs `herdr-app check` on every mod.
- `./install.sh` copies `layouts/phosphor.*`, `themes/phosphor.json`, `backgrounds/phosphor-*` and `mods/ph-*` into `~/.config/herdr-app` and adds `ctrl-shift-u` (respond: jump to the oldest blocked agent) if that key is free. Then run `herdr-app do layout.switch '{"name":"phosphor"}'`.
- `./intensity.sh calm|full` dials the motion down or back up (it sets the layout props, and ph-kit mirrors them to `shared("ph.intensity")`).
- `lib/` holds the shared helpers. Edit them there and run `tools/sync-lib.sh`, which copies them into each mod.
- `tools/fake.sh <mod> tools/scenarios/demo.json [--install]` renders a mod with fake agents and spaces. `tools/fake.sh --clean` removes the fakes.
- Fonts are in `mods/ph-kit/fonts/`; their licences and changes are listed in `README.txt` there.

# herdr-neo-kyoto
Neo-Kyoto: a Japanese-cyberpunk Herdr layout on gruvbox (sakura pink accent, aqua/orange/pink agent status).
Pieces: `layouts/neo-kyoto.json` (clone of Herdr's `main`), `themes/neo-kyoto.json`, mods `nk-sakura` (floating tree), `nk-pane` (pane headers), `nk-toast` (notifications); each mod reads `props().intensity` = `"calm"` | `"full"`.
`./check.sh` runs `herdr-app check` on every `mods/nk-*`; `./install.sh` checks, then copies only `neo-kyoto`/`nk-*` files into `~/.config/herdr-app`.
Try it: `./install.sh && herdr-app do layout.switch '{"name":"neo-kyoto"}'` (back: `{"name":"main"}`, or `ctrl-shift-l`).

# herdr-setup

Backup of my Herdr themes/mods. Each theme's full history lives on its own branch prefix:

| Prefix | Local repo | What it is |
|---|---|---|
| `phosphor/*` | `~/repos/herdr-phosphor` | PHOSPHOR: gruvbox amber/green CRT console look (layout `phosphor`, theme, `ph-*` mods) |
| `neo-kyoto/*` | `~/repos/herdr-neo-kyoto` | NEO-KYOTO: neon/kanji theme (`nk-*` mods: pane, sakura, toast; Kosugi Maru font) |

The `*/meeseeks/*` branches were per-feature worktrees (under `~/.herdr/worktrees/`). The integrated branches are
`phosphor/meeseeks/phosphor` and `neo-kyoto/meeseeks/neo-kyoto`.
`neo-kyoto/wip/cleanup-uncommitted` is a snapshot of uncommitted README/RECIPE edits from the cleanup worktree (2026-11-21).

## Restore

```sh
cd ~/repos
git clone -b phosphor/meeseeks/phosphor-skeleton git@github.com:timmPrice/herdr-setup.git herdr-phosphor
git clone -b neo-kyoto/main git@github.com:timmPrice/herdr-setup.git herdr-neo-kyoto
# list everything: git ls-remote --heads git@github.com:timmPrice/herdr-setup.git
```

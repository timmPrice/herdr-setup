#!/usr/bin/env bash
# Copies lib/*.js (the canonical shared helpers) into every mods/ph-*/lib/ (mods can't import across folders).
#   tools/sync-lib.sh          sync (removes lib files no longer in lib/)
#   tools/sync-lib.sh --check  exit 1 if any mod's copy is missing or stale (changes nothing)
set -euo pipefail
cd "$(dirname "$0")/.."
check=0; [ "${1:-}" = "--check" ] && check=1
stale=0
for m in mods/ph-*/; do
  m=${m%/}
  if [ $check = 1 ]; then
    # Compare only .js (Herdr's check writes gpui-kit.d.ts into module folders).
    if ! diff -rq -x '*.d.ts' -x 'jsconfig.json' lib "$m/lib" >/dev/null 2>&1; then echo "stale: $m/lib (run tools/sync-lib.sh)"; stale=1; fi
  else
    mkdir -p "$m/lib"
    rsync -a --delete --filter='P *.d.ts' --filter='P jsconfig.json' --include='*.js' --exclude='*' lib/ "$m/lib/"
  fi
done
exit $stale

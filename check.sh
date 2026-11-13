#!/usr/bin/env bash
# Runs `herdr-app check` on every mods/nk-* folder. Exits non-zero if any fails.
set -u
cd "$(dirname "$0")"
fail=0; n=0
for m in mods/nk-*/; do
  m=${m%/}; n=$((n+1))
  if out=$(herdr-app check "$PWD/$m" 2>&1); then
    echo "ok   $m"
  else
    echo "FAIL $m"; echo "$out" | sed 's/^/     /'; fail=1
  fi
done
[ "$n" -gt 0 ] || { echo "no mods/nk-* found"; exit 1; }
exit $fail

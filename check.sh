#!/usr/bin/env bash
# PHOSPHOR checks: lib copies in sync, lib unit tests, JSON valid, `herdr-app check` on every mods/ph-*.
set -u
cd "$(dirname "$0")"
fail=0
tools/sync-lib.sh --check || { echo "FAIL lib copies are stale: run tools/sync-lib.sh"; fail=1; }
if out=$(node --import ./tests/stubs/register.mjs --test tests/*.test.mjs 2>&1); then echo "ok   node tests"
else echo "FAIL node tests"; echo "$out" | grep -E "not ok|Error|expected|actual" | sed 's/^/     /'; fail=1; fi
for j in layouts/phosphor.json themes/phosphor.json mods/ph-*/mod.json; do
  python3 -I -m json.tool "$j" >/dev/null 2>&1 || { echo "FAIL $j is not valid JSON"; fail=1; }
done
# lib helpers through the real runtime: a temp copy of tests/libcheck with lib/ beside it.
tmp=$(mktemp -d "${TMPDIR:-/tmp}/ph-libcheck.XXXXXX")
cp tests/libcheck/main.js tests/libcheck/mod.json "$tmp/" && mkdir "$tmp/lib" && cp lib/*.js "$tmp/lib/"
if out=$(herdr-app check "$tmp" 2>&1); then echo "ok   lib (herdr-app check)"; else echo "FAIL lib"; echo "$out" | sed 's/^/     /'; fail=1; fi
rm -f "$tmp"/main.js "$tmp"/mod.json "$tmp"/jsconfig.json "$tmp"/gpui-kit.d.ts "$tmp"/herdr.d.ts "$tmp"/lib/*.js
rmdir "$tmp/lib" "$tmp" 2>/dev/null || true
n=0
for m in mods/ph-*/; do
  m=${m%/}; n=$((n+1))
  if out=$(herdr-app check "$PWD/$m" 2>&1); then echo "ok   $m"
  else echo "FAIL $m"; echo "$out" | sed 's/^/     /'; fail=1; fi
done
[ "$n" -gt 0 ] || { echo "no mods/ph-* found"; exit 1; }
exit $fail

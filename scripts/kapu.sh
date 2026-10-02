#!/usr/bin/env bash
#
# The gate (PQW-1104, scope set by the owner in PQW-1123).
#
#   npm run kapu    format, types, build, unit tests — about 7 s
#
# WHAT IS NOT IN IT, AND WHERE IT RUNS INSTEAD
#   No browser tests. Measured on 2026-10-02: types 1.7 s, build 2 s, 89 unit files
#   with 1756 cases 4.7 s — and the 39 browser specs 33 s on their own, five times
#   everything else together. They are what the editing loop does not need on every
#   pass, so they moved:
#
#     nightly        the full browser suite, .github/workflows/nightly.yml
#     before release the 20-test `@kiadas` set, run by scripts/kiadas.sh
#     by hand        npm run fustteszt (the release set), or npx playwright test
#
#   So a browser regression is caught by the nightly run at the latest, and never
#   reaches production: the release gate refuses to ship without the release set.
#   KB: testing.md §4

set -euo pipefail

piros() { printf '\033[31m%s\033[0m\n' "$*"; }
zold()  { printf '\033[32m%s\033[0m\n' "$*"; }
cim()   { printf '\n\033[1m── %s\033[0m\n' "$*"; }

for arg in "$@"; do
  piros "Ismeretlen kapcsoló: $arg"
  echo "Használat: npm run kapu"
  echo "Böngészős tesztek: npm run fustteszt (kiadási készlet) · npx playwright test (teljes)"
  exit 2
done

LEPES="indulás"

bukott() {
  piros ""
  piros "A kapu elbukott itt: $LEPES  (${SECONDS}s)"
  piros ""
  case "$LEPES" in
    "formázás")  echo "Javítás: npx biome check --write ." ;;
    "típusok")   echo "A hibát a tsc írta ki fájl és sor szerint." ;;
    "build")     echo "A build a típusellenőrzést is újrafuttatja; előbb a típusokat javítsd." ;;
    "egységtesztek")
      echo "Egy fájl külön: node --test tests/<nev>.test.mjs"
      echo "Szövegen vagy kommenten változtattál? A metatesztek nyers forrást olvasnak — KB: testing.md §2"
      ;;
  esac
  exit 1
}
trap bukott ERR

futtat() {
  LEPES="$1"; shift
  cim "$LEPES"
  "$@"
}

futtat "formázás" npx biome ci .
futtat "típusok" npm run check
futtat "build" npm run build
futtat "egységtesztek" npm test

zold ""
zold "A kapu rendben (${SECONDS}s)."
echo "Böngészős teszt nem futott. Nightly fut a teljes készlet; a kiadás a 20 teszteset kéri."

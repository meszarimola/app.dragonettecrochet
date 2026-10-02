#!/usr/bin/env bash
#
# The gate: every check CI runs, in one command (PQW-1104).
#
#   npm run kapu            full gate: format, types, build, unit tests, browser tests
#   npm run kapu -- --gyors fast gate: format, types, build, unit tests only
#
# WHY ONE COMMAND
#   The suite is not slow. Measured on 2026-10-02: types 1.7 s, build 2 s, 89
#   unit files with 1756 cases 4.7 s, 39 browser specs with 195 tests 33 s — the
#   full gate is about 45 s. There is nothing to win by running a subset, so the
#   full gate is the default and --gyors exists only for the editing loop.
#
#   The step order mirrors .github/workflows/ci.yml, and tests/kapu.test.mjs
#   asserts that it still does. A gate that drifts from CI is worse than none.
#
# THE PORT
#   The browser tests need a port nobody else is serving on. The worktree's own
#   .env.local carries it (npm run munkafa writes it); PORT in the environment
#   wins over that, and 5181 is the fallback. KB: incidents.md §3

set -euo pipefail

piros() { printf '\033[31m%s\033[0m\n' "$*"; }
zold()  { printf '\033[32m%s\033[0m\n' "$*"; }
cim()   { printf '\n\033[1m── %s\033[0m\n' "$*"; }

GYORS=0
for arg in "$@"; do
  case "$arg" in
    --gyors) GYORS=1 ;;
    *) piros "Ismeretlen kapcsoló: $arg"; echo "Használat: npm run kapu [-- --gyors]"; exit 2 ;;
  esac
done

if [[ -z "${PORT:-}" && -f .env.local ]]; then
  PORT="$(sed -n 's/^PORT=\([0-9][0-9]*\).*/\1/p' .env.local | head -1)"
fi
PORT="${PORT:-5181}"

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
    "böngészős tesztek")
      echo "A futás az ötödik bukás után megáll, nem méri végig a készletet."
      echo "Egy spec külön:  PORT=$PORT npx playwright test e2e/<nev>.spec.ts"
      echo "Nyomkövetés:     PORT=$PORT npx playwright test --ui"
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

if (( GYORS )); then
  zold ""
  zold "A gyors kapu rendben (${SECONDS}s). A böngészős tesztek nem futottak — commit előtt: npm run kapu"
  exit 0
fi

LEPES="böngészős tesztek"
cim "$LEPES (port $PORT)"
PORT="$PORT" npx playwright test

zold ""
zold "A kapu rendben (${SECONDS}s)."

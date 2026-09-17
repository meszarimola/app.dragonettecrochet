#!/usr/bin/env bash
#
# Kiadás és élesítés egy paranccsal (PQW-928).
#
#   npm run kiadas -- --proba            főpróba: ellenőriz és buildel, de SEMMIT nem változtat
#   npm run kiadas -- 0.20.0             teljes kiadás
#   npm run kiadas -- 0.20.0 --bongeszo  a teljes böngészős készlet is lefut előtte
#   npm run kiadas -- 0.19.0 --ujra      csak újratelepítés a v0.19.0 címkéből, gitflow nélkül
#
# MEGISMÉTELHETŐSÉG
#   * A --proba bárhonnan, bármikor futtatható, és nyomot sem hagy.
#   * Minden lépés kapuhoz kötött; bukásnál a szkript megáll, és kiírja, hol
#     tartasz és mi a következő lépés. Félbehagyott élesítés nem marad.
#   * Ha a telepítésnél bukott el, a --ujra ugyanarra a verzióra akárhányszor
#     újrafuttatható.
#   * A címkézés idempotens: meglévő címkét nem ír felül.
#
# A kiadás a develop ágról indul, abból a munkapéldányból, ahol a develop ki van
# fejtve. Worktree-ből a --proba és a --ujra megy, a teljes kiadás nem.

set -euo pipefail

CEL="dragonette:app.dragonettecrochet.com/"
URL="https://app.dragonettecrochet.com"
GYOKER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GYOKER"

piros() { printf '\033[31m%s\033[0m\n' "$*"; }
zold()  { printf '\033[32m%s\033[0m\n' "$*"; }
sarga() { printf '\033[33m%s\033[0m\n' "$*"; }
cim()   { printf '\n\033[1m── %s\033[0m\n' "$*"; }

INDULO_AG="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
LEPES="indulás"
PROBAKI=""

megall() { piros "MEGÁLL ($LEPES): $*"; exit 1; }

# Bármilyen megszakadásnál elmondja, hol tartunk és hogyan lehet folytatni.
zaras() {
  local kod=$?
  (( kod == 0 )) && return 0
  piros ""
  piros "A kiadás megszakadt itt: $LEPES"
  echo "Jelenlegi ág: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'levált fej')"
  echo "Indulási ág:  $INDULO_AG"
  echo ""
  echo "Vissza a munkához:              git checkout $INDULO_AG"
  echo "Ha már kiment és baj van:       npm run visszaallitas -- <előző verzió>"
  echo "Ha csak a telepítés bukott:     npm run kiadas -- <verzió> --ujra"
}
trap zaras EXIT

# ── Argumentumok ────────────────────────────────────────────────────────────
VERZIO=""
PROBA=0
BONGESZO=0
UJRA=0
for a in "$@"; do
  case "$a" in
    --proba)    PROBA=1 ;;
    --bongeszo) BONGESZO=1 ;;
    --ujra)     UJRA=1 ;;
    -*)         megall "ismeretlen kapcsoló: $a" ;;
    *)          VERZIO="$a" ;;
  esac
done

MOSTANI="$(node -p "require('./package.json').version")"
(( PROBA )) && VERZIO="${VERZIO:-$MOSTANI}"
[[ -n "$VERZIO" ]] || megall "add meg a verziót: npm run kiadas -- 0.20.0"
[[ "$VERZIO" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || megall "a verzió X.Y.Z alakú legyen, ez jött: $VERZIO"

KIAG="release/v$VERZIO"

# ── Függvények (a használatuk előtt kell állniuk) ───────────────────────────

# 4. Build, és a kiadott verzió tényleg beleégett-e a csomagba.
epits_es_ellenorizd() {
  LEPES="4. build"
  cim "4. Build"
  local faverzio darab
  faverzio="$(node -p "require('./package.json').version")"
  [[ "$faverzio" == "$VERZIO" ]] || megall "a kifejtett fa verziója $faverzio, nem $VERZIO"
  rm -rf dist
  npm run build >/dev/null
  grep -qr "$VERZIO" dist/assets/*.js || megall "a $VERZIO nincs beleégetve a buildelt csomagba"
  [[ -f dist/index.html ]] || megall "hiányzik a dist/index.html"
  darab="$(find dist -type f | wc -l | tr -d ' ')"
  (( darab >= 5 )) || megall "a dist gyanúsan kevés fájlt tartalmaz ($darab)"
  zold "✓ build kész, a $VERZIO beleégetve, $darab fájl"
}

# 5. Próbaszinkron, a törlések gépi elemzésével. 6. Élesítés.
szinkronizald() {
  LEPES="5. próbaszinkron"
  cim "5. Próbaszinkron"
  PROBAKI="$(mktemp)"
  rsync -az --delete --dry-run --itemize-changes dist/ "$CEL" > "$PROBAKI"
  cat "$PROBAKI"

  local gyanus torles
  gyanus="$(grep '^\*deleting' "$PROBAKI" | grep -vE '^\*deleting assets/index-[A-Za-z0-9_-]+\.(js|css)$' || true)"
  if [[ -n "$gyanus" ]]; then
    piros "Váratlan törlés:"; echo "$gyanus"
    megall "csak régi assets/index-*.js és .css törlődhet automatikusan"
  fi
  torles="$(grep -c '^\*deleting' "$PROBAKI" || true)"
  (( torles <= 10 )) || megall "túl sok törlés ($torles) — nézd meg kézzel"
  zold "✓ a próbaszinkron rendben, $torles törlés, mind régi eszközfájl"

  if (( PROBA )); then
    cim "FŐPRÓBA VÉGE"
    zold "Semmi nem változott: se git, se kiszolgáló."
    echo "Ugyanez a parancs bármikor újrafuttatható."
    exit 0
  fi

  LEPES="6. élesítés"
  cim "6. Élesítés"
  rsync -az --delete --itemize-changes dist/ "$CEL"
  zold "✓ feltöltve"
}

# 7. Ellenőrzés az éles kiszolgálón. 8. Füstpróba böngészőben.
ellenorizd_elesben() {
  LEPES="7. ellenőrzés"
  cim "7. Ellenőrzés"
  local index js css fej regi hiba=0
  index="$(curl -fsS "$URL/")"
  js="$(printf '%s' "$index" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
  css="$(printf '%s' "$index" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.css' | head -1)"

  ell() { if [[ "$2" == "$3" ]]; then zold "  ✓ $1"; else piros "  ✗ $1 — várt: $2, kapott: $3"; hiba=1; fi; }

  ell "index.html 200"   "200" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/")"
  ell "JS csomag 200"    "200" "$(curl -s -o /dev/null -w '%{http_code}' "$URL$js")"
  ell "CSS 200"          "200" "$(curl -s -o /dev/null -w '%{http_code}' "$URL$css")"
  ell "http → https 301" "301" "$(curl -s -o /dev/null -w '%{http_code}' "http://app.dragonettecrochet.com/")"
  ell "robots.txt 200"   "200" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/robots.txt")"

  if curl -fsS "$URL$js" | grep -q "$VERZIO"; then
    zold "  ✓ a kiszolgált csomagban a $VERZIO van"
  else
    piros "  ✗ a kiszolgált csomagban NINCS benne a $VERZIO"; hiba=1
  fi

  if [[ -n "$PROBAKI" ]]; then
    regi="$(grep '^\*deleting assets/index-.*\.js$' "$PROBAKI" | sed 's/^\*deleting //' | head -1 || true)"
    [[ -n "$regi" ]] && ell "a régi csomag eltűnt" "404" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/$regi")"
  fi

  fej="$(curl -sI "$URL/")"
  for h in content-security-policy strict-transport-security x-content-type-options referrer-policy; do
    if printf '%s' "$fej" | grep -qi "^$h:"; then zold "  ✓ $h"; else piros "  ✗ hiányzó fejléc: $h"; hiba=1; fi
  done

  (( hiba == 0 )) || megall "az ellenőrzés hibát talált — lásd fent"

  LEPES="8. füstpróba"
  cim "8. Füstpróba böngészőben"
  VART_VERZIO="$VERZIO" PROD_URL="$URL" npx playwright test --config playwright.prod.config.ts
  zold "✓ füstpróba rendben"
}

# ── Helyzetfelmérés ─────────────────────────────────────────────────────────
LEPES="helyzetfelmérés"
cim "Helyzet"
git fetch origin --prune --tags --quiet
ELES="$(curl -fsS "$URL/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
ELES_VERZIO="$(curl -fsS "$URL$ELES" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo '?')"
printf '  helyi verzió: %s\n  élesben:      %s\n  kért verzió:  %s\n' "$MOSTANI" "$ELES_VERZIO" "$VERZIO"

[[ -z "$(git status --porcelain)" ]] || megall "a munkafa nem tiszta — commitold vagy dobd el a változásokat"

# ── Rövid út: újratelepítés címkéből ────────────────────────────────────────
if (( UJRA )); then
  LEPES="újratelepítés"
  cim "Újratelepítés a v$VERZIO címkéből"
  git rev-parse "v$VERZIO" >/dev/null 2>&1 \
    || megall "nincs v$VERZIO címke. Ezek vannak: $(git tag -l 'v*' | tr '\n' ' ')"
  git checkout --detach "v$VERZIO" >/dev/null 2>&1
  epits_es_ellenorizd
  szinkronizald
  ellenorizd_elesben
  git checkout "$INDULO_AG" >/dev/null 2>&1 || true
  zold ""
  zold "KÉSZ: a v$VERZIO újra kint van."
  exit 0
fi

# ── 1. Előfeltételek ────────────────────────────────────────────────────────
LEPES="1. előfeltételek"
cim "1. Előfeltételek"

if (( PROBA )); then
  sarga "  FŐPRÓBA: az ágra és a verziószámra vonatkozó kapuk kimaradnak."
else
  [[ "$INDULO_AG" == "develop" ]] || megall "a kiadás a develop ágról indul, most ezen állsz: $INDULO_AG"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/develop)" ]] \
    || megall "a develop nincs szinkronban az origin/develop ággal"
  NAGYOBB="$(printf '%s\n%s\n' "$MOSTANI" "$VERZIO" | sort -V | tail -1)"
  [[ "$NAGYOBB" == "$VERZIO" && "$VERZIO" != "$MOSTANI" ]] \
    || megall "a $VERZIO nem nagyobb a jelenlegi $MOSTANI verziónál"
  if git rev-parse "v$VERZIO" >/dev/null 2>&1; then
    megall "a v$VERZIO címke már létezik — újratelepítéshez: npm run kiadas -- $VERZIO --ujra"
  fi
fi

ssh -o BatchMode=yes -o ConnectTimeout=10 dragonette true \
  || megall "a kiszolgáló nem érhető el ssh-n (dragonette)"
zold "✓ tiszta fa, a kiszolgáló elérhető"

# ── 2. Minőségi kapuk ───────────────────────────────────────────────────────
LEPES="2. minőségi kapuk"
cim "2. Minőségi kapuk"
npm run check
npm test
zold "✓ típusellenőrzés és egységtesztek rendben"
if (( BONGESZO )); then
  npx playwright test
  zold "✓ a böngészős készlet is zöld"
else
  echo "  (böngészős készlet kihagyva — a --bongeszo kapcsolóval fut)"
fi

# ── 3. Kiadási ág, verzióemelés, összevonás ─────────────────────────────────
if (( PROBA )); then
  sarga "  FŐPRÓBA: nincs ágkészítés, commit, push és merge."
else
  LEPES="3. kiadási ág"
  cim "3. Kiadási ág és verzióemelés"
  git checkout -b "$KIAG" >/dev/null 2>&1 \
    || megall "a $KIAG ág már létezik helyben — töröld: git branch -D $KIAG"
  npm version "$VERZIO" --no-git-tag-version >/dev/null
  git add package.json package-lock.json
  git commit -q -m "Verzió emelése a v$VERZIO kiadáshoz (PQW-903)"
  git push -u origin "$KIAG" --quiet

  LEPES="3. összevonás"
  PR1="$(gh pr create --base develop --head "$KIAG" \
    --title "Verzió emelése a v$VERZIO kiadáshoz" \
    --body "A v$VERZIO kiadás verzióemelése." | tail -1)"
  echo "  kiadási PR: $PR1"
  gh pr merge "$PR1" --merge

  PR2="$(gh pr create --base main --head develop \
    --title "v$VERZIO kiadás élesítése" \
    --body "A v$VERZIO élesítése a developról." | tail -1)"
  echo "  élesítő PR: $PR2"
  gh pr merge "$PR2" --merge

  git fetch origin --quiet
  zold "✓ a v$VERZIO fent van a main ágon"
  git checkout --detach origin/main >/dev/null 2>&1
fi

epits_es_ellenorizd
szinkronizald
ellenorizd_elesben

# ── 9. Címke és zárás ───────────────────────────────────────────────────────
LEPES="9. zárás"
cim "9. Zárás"
if git rev-parse "v$VERZIO" >/dev/null 2>&1; then
  echo "  a v$VERZIO címke már megvan"
else
  git tag -a "v$VERZIO" -m "v$VERZIO"
  git push origin "v$VERZIO" --quiet
  echo "  v$VERZIO címke létrehozva"
fi

git checkout "$INDULO_AG" >/dev/null 2>&1
git pull --quiet
git branch -D "$KIAG" >/dev/null 2>&1 || true
git push origin --delete "$KIAG" --quiet 2>/dev/null || true

zold ""
zold "KÉSZ: a v$VERZIO él a $URL címen."
echo ""
echo "Ha baj van:         npm run visszaallitas -- $MOSTANI"
echo "Ha újra kell:       npm run kiadas -- $VERZIO --ujra"

#!/usr/bin/env bash
#
# Visszaállítás egy korábbi kiadásra (PQW-928).
#
#   npm run visszaallitas -- 0.18.0
#   npm run visszaallitas -- 0.18.0 --azonnal    a tíz másodperc várakozás nélkül
#
# A megadott verzió címkéjéből buildel és azt tölti fel. A git ágakhoz nem nyúl:
# a cél az, hogy a látogatók másodpercek alatt visszakapják a működő felületet.
# A git rendberakása külön, nyugodt lépés, utána.
#
# Megismételhető: ugyanez a parancs akárhányszor lefuttatható, mindig ugyanazt
# az állapotot állítja vissza.

set -euo pipefail

CEL="dragonette:app.dragonettecrochet.com/"
URL="https://app.dragonettecrochet.com"
GYOKER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GYOKER"

piros() { printf '\033[31m%s\033[0m\n' "$*"; }
zold()  { printf '\033[32m%s\033[0m\n' "$*"; }
megall() { piros "MEGÁLL: $*"; exit 1; }

INDULO_AG="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"

VERZIO=""
AZONNAL=0
for a in "$@"; do
  case "$a" in
    --azonnal) AZONNAL=1 ;;
    -*)        megall "ismeretlen kapcsoló: $a" ;;
    *)         VERZIO="$a" ;;
  esac
done

[[ -n "$VERZIO" ]] || megall "add meg a verziót: npm run visszaallitas -- 0.18.0"
[[ "$VERZIO" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || megall "a verzió X.Y.Z alakú legyen"
[[ -z "$(git status --porcelain)" ]] || megall "a munkafa nem tiszta"

git fetch origin --tags --quiet
git rev-parse "v$VERZIO" >/dev/null 2>&1 \
  || megall "nincs v$VERZIO címke. Ezek vannak: $(git tag -l 'v*' | tr '\n' ' ')"

ELES="$(curl -fsS "$URL/" 2>/dev/null | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
ELES_VERZIO="$(curl -fsS "$URL$ELES" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo '?')"

printf '\nÉlesben most: %s\nVisszaállítás erre: %s\n\n' "$ELES_VERZIO" "$VERZIO"
if (( ! AZONNAL )); then
  echo "Tíz másodperced van meggondolni (Ctrl+C)."
  sleep 10
fi

git checkout --detach "v$VERZIO" >/dev/null 2>&1
rm -rf dist
npm ci --silent
npm run build >/dev/null
grep -qr "$VERZIO" dist/assets/*.js || megall "a $VERZIO nincs a buildelt csomagban"
[[ -f dist/index.html ]] || megall "hiányzik a dist/index.html"

rsync -az --delete --itemize-changes dist/ "$CEL"

KISZOLGALT="$(curl -fsS "$URL/" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
if curl -fsS "$URL$KISZOLGALT" | grep -q "$VERZIO"; then
  zold ""
  zold "KÉSZ: a $URL újra a v$VERZIO verziót szolgálja ki."
else
  megall "a feltöltés megtörtént, de a kiszolgált csomagban nincs a $VERZIO — nézd meg kézzel"
fi

echo ""
echo "A git most a v$VERZIO címkén áll, levált fejjel. Vissza a munkához:"
echo "  git checkout $INDULO_AG"

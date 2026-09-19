#!/usr/bin/env bash
# Prove a change touched only comments.
#
# Transpiling strips comments, so a comment-only edit must emit byte-identical
# JavaScript. Any file this reports is either a real code change or a mistake.
#
# --minify is required, not cosmetic: without it esbuild PRESERVES comments that
# sit inside array and object literals and strips them everywhere else, so a
# comment edit inside a literal reads as a code change.
#
# The base copy keeps the original basename because esbuild derives the
# default-export identifier from the filename.
#
# Test files and e2e specs are out of scope: their titles are string literals and
# legitimately change. Verify those with the suite plus a title-count diff.
#
# Usage: scripts/dev/comment-oracle.sh [<base-ref>]
set -euo pipefail
base="${1:-HEAD}"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
changed=$(git diff --name-only "$base" -- 'src' '*.ts' | grep -E '\.ts$' || true)
[ -z "$changed" ] && { echo "oracle: no transpilable source changed"; exit 0; }
bad=0
mkdir -p "$tmp/base"
for f in $changed; do
  [ -f "$f" ] || continue
  git show "$base:$f" > "$tmp/base/$(basename "$f")" 2>/dev/null || continue
  npx --yes esbuild "$tmp/base/$(basename "$f")" --format=esm --target=es2022 --minify > "$tmp/before.js" 2>/dev/null
  npx --yes esbuild "$f"                         --format=esm --target=es2022 --minify > "$tmp/after.js"  2>/dev/null
  if cmp -s "$tmp/before.js" "$tmp/after.js"; then
    echo "  ok        $f"
  else
    echo "  CODE DIFF $f"; bad=1
  fi
done
[ $bad -eq 0 ] && echo "oracle: comment-only, proven" || echo "oracle: FAILED — a listed file changed behaviour"
exit $bad

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// A non-null assertion tells the compiler to stop checking. Many here are
// load-bearing — construction guarantees the value — and rewriting them would
// change behaviour and cost a render-path allocation. So the rule is off in
// biome.json and the total is capped instead: it may fall, never rise.
//
// Counted with the TypeScript compiler API, not a regex: a regex cannot tell
// `a!.b` from `a !== b` reliably, and undercounted this by four.
//
// Lower CEILING in the same PR that removes assertions. Do not raise it.
const CEILING = 777;

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) found.push(path);
  }
  return found;
}

function countAssertions(path) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ES2022, true);
  let found = 0;
  const walk = (node) => {
    if (node.kind === ts.SyntaxKind.NonNullExpression) found += 1;
    ts.forEachChild(node, walk);
  };
  walk(source);
  return found;
}

test('the non-null assertion count does not rise', () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length > 0, 'no source files found — the path is wrong');

  const total = files.reduce((sum, file) => sum + countAssertions(file), 0);

  assert.ok(
    total <= CEILING,
    `non-null assertions rose from ${CEILING} to ${total}. ` +
      'Narrow the type or throw instead, or justify the addition and raise the ceiling deliberately.',
  );

  assert.ok(
    total >= CEILING - 40,
    `non-null assertions fell from ${CEILING} to ${total}. Lower CEILING in this PR so the gain is locked in.`,
  );
});

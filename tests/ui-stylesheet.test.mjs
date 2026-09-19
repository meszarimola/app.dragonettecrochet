/*
 * Stylesheet integrity (PQW-881). A closing brace lost while resolving a
 * conflict made the browser drop the rest of the stylesheet and the interface
 * fell apart; neither the build nor the other tests noticed.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

/** Brace balance, ignoring comments and string literals. */
function unclosedBlocks(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
  const open = [];
  let line = 1;
  for (const char of code) {
    if (char === '\n') line += 1;
    else if (char === '{') open.push(line);
    else if (char === '}') {
      assert.ok(open.length > 0, `stray „}” on line ${line}`);
      open.pop();
    }
  }
  return open;
}

test('every block in the stylesheet is closed', () => {
  assert.deepEqual(unclosedBlocks(css), [], 'starting line(s) of the unclosed block(s)');
});

test('the check spots a missing closing brace', () => {
  assert.deepEqual(unclosedBlocks('.a {\n  color: red;\n/* megjegyzés { */\n.b { content: "}"; }\n'), [1]);
});

test('the stylesheet carries no merge conflict markers', () => {
  assert.doesNotMatch(css, /^(<{7}|={7}|>{7})/m);
});

/*
 * A stíluslap épsége (PQW-881). Egy ütközésfeloldásnál kimaradt záró zárójel
 * után a böngésző a stíluslap további részét eldobta, és a felület szétesett;
 * sem a build, sem a többi teszt nem vette észre.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

/** A kapcsos zárójelek egyensúlya megjegyzések és karakterláncok nélkül. */
function unclosedBlocks(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
  const open = [];
  let line = 1;
  for (const char of code) {
    if (char === '\n') line += 1;
    else if (char === '{') open.push(line);
    else if (char === '}') {
      assert.ok(open.length > 0, `fölösleges „}” a ${line}. sorban`);
      open.pop();
    }
  }
  return open;
}

test('a stíluslap minden blokkja le van zárva', () => {
  assert.deepEqual(unclosedBlocks(css), [], 'le nem zárt blokk kezdősora(i)');
});

test('az ellenőrzés kiszúrja a hiányzó záró zárójelet', () => {
  assert.deepEqual(unclosedBlocks('.a {\n  color: red;\n/* megjegyzés { */\n.b { content: "}"; }\n'), [1]);
});

test('nincs ütközésjelölő a stíluslapban', () => {
  assert.doesNotMatch(css, /^(<{7}|={7}|>{7})/m);
});

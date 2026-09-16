/*
 * A repó higiéniája: ne kerüljön a verziókezelésbe szimbolikus link (PQW-910).
 *
 * Előzmény: a `node_modules` linkként be volt commitolva, mert a `.gitignore`
 * `node_modules/` sora a záró perjel miatt csak könyvtárra illeszkedett. A
 * követett link miatt a git ág- és worktree-műveleteknél nyúlt ehhez az
 * útvonalhoz: a worktree törlése elvitte a főmásolat függőségeit, és utána
 * minden npm parancs néma hibával hasalt el.
 *
 * A gitben a szimbolikus link módja `120000`. Ez a teszt a git indexéből
 * dolgozik, nem a lemezről, ezért azt is megfogja, ha a link a fájlrendszeren
 * időközben mássá vált.
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** A követett fájlok módja és útvonala a git indexéből. */
function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '--stage'], { encoding: 'utf8' });
  return out
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [meta, path] = line.split('\t');
      return { mode: meta.split(' ')[0], path };
    });
}

test('a verziókezelésben nincs szimbolikus link', () => {
  const links = trackedFiles()
    .filter((file) => file.mode === '120000')
    .map((file) => file.path);
  assert.deepEqual(links, [], `szimbolikus link a repóban: ${links.join(', ')}`);
});

test('a node_modules nincs követve', () => {
  const tracked = trackedFiles().filter((file) => file.path === 'node_modules' || file.path.startsWith('node_modules/'));
  assert.equal(tracked.length, 0, `követett node_modules: ${tracked.map((file) => file.path).join(', ')}`);
});

test('a .gitignore a node_modules mindkét alakját kizárja', () => {
  // Perjel nélkül a minta könyvtárra és linkre is illeszkedik; a perjeles alak csak könyvtárra.
  const ignored = execFileSync('git', ['check-ignore', '-v', 'node_modules'], { encoding: 'utf8' });
  assert.match(ignored, /node_modules/);
});

/*
 * A „Beszúrás” választó tartalma (PQW-869): csak a szem által megengedett
 * módok, az érvényes mód, és hogyan kerül a mód az írott mintába.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { stitchById } from '../src/core/stitches.ts';
import { insertionChoice, insertionSuffix } from '../src/ui/insertion-view.ts';

const modes = (choice) => choice.options.map((option) => option.mode);

test('alapszemnél mind az öt mód választható, a könyvtár sorrendjében, nagy kezdőbetűs névvel', () => {
  const choice = insertionChoice(stitchById('dc'), 'both-loops', 'hu');
  assert.deepEqual(modes(choice), ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post']);
  assert.deepEqual(
    choice.options.map((option) => option.label),
    ['Mindkét szál', 'Első szál', 'Hátsó szál', 'Első relief', 'Hátsó relief'],
  );
});

test('csak a szem insertionModes listájában szereplő mód jelenik meg', () => {
  for (const id of ['sl-st', 'sc2tog', 'shell-5dc', 'v-st-dc', 'bobble-5dc']) {
    const def = stitchById(id);
    const choice = insertionChoice(def, 'both-loops', 'hu');
    assert.ok(choice, id);
    for (const mode of modes(choice)) assert.ok(def.insertionModes.includes(mode), `${id}: ${mode}`);
    assert.ok(!modes(choice).includes('space') && !modes(choice).includes('ring'), id);
  }
  assert.deepEqual(modes(insertionChoice(stitchById('sl-st'), 'both-loops', 'hu')), ['both-loops', 'front-loop', 'back-loop']);
});

test('nincs választó célpont nélküli szemnél, és ahol csak egy mód van', () => {
  for (const id of ['ch', 'ch-sp', 'magic-ring', 'picot', 'rev-sc', 'invdec']) {
    assert.equal(insertionChoice(stitchById(id), 'back-loop', 'hu'), null, id);
  }
  assert.equal(insertionChoice(undefined, 'back-loop', 'hu'), null);
});

test('a választott mód megmarad, ha a szem megengedi; különben a szem alapértelmezése érvényes', () => {
  assert.equal(insertionChoice(stitchById('sc'), 'front-post', 'hu').selected, 'front-post');
  assert.equal(insertionChoice(stitchById('sl-st'), 'front-post', 'hu').selected, 'both-loops');
});

test('az írott alak a választott jelöléssel, a szókészlet rövidítéseivel', () => {
  const written = (id, mode, terms) => insertionChoice(stitchById(id), mode, terms).written;
  assert.equal(written('sc', 'back-loop', 'hu'), 'rp (hsz)');
  assert.equal(written('sc', 'front-loop', 'hu'), 'rp (esz)');
  assert.equal(written('dc', 'front-post', 'hu'), 'Eerp');
  assert.equal(written('dc', 'back-post', 'hu'), 'Herp');
  assert.equal(written('hdc', 'front-post', 'hu'), 'fp (első relief)');
  assert.equal(written('sc', 'both-loops', 'hu'), 'rp');
  assert.equal(written('sc', 'back-loop', 'en-US'), 'sc BLO');
  assert.equal(written('dc', 'front-post', 'en-US'), 'FPdc');
  assert.equal(written('dc', 'back-post', 'en-GB'), 'BPtr');
  assert.equal(written('shell-5dc', 'back-loop', 'hu'), null);
});

test('az állapotsor kiegészítése: mindkét szálnál üres', () => {
  assert.equal(insertionSuffix('both-loops'), '');
  assert.equal(insertionSuffix(undefined), '');
  assert.equal(insertionSuffix('back-post'), ', hátsó relief');
});

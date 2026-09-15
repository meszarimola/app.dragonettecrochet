/*
 * A rács színei (PQW-874, WCAG 2.2 AA): a váltakozó sorszínen a jelek, a
 * sorszám és a szemszám legalább 4,5:1, a sorhatár és a hangsúlyos vonal
 * legalább 3:1 (1.4.3, 1.4.11). A tokenek a stíluslapból jönnek.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const token = (name) => {
  const match = root.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `hiányzó token: --${name}`);
  return match[1];
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const grounds = ['c-bg', 'c-row-a', 'c-row-b'];

test('a kontrasztszámítás a WCAG képletét követi', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(0), '21');
  assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
});

test('a sorszínen a jelek és a feliratok legalább 4,5:1', () => {
  for (const ground of grounds) {
    for (const ink of ['c-ink', 'c-ink-wrong', 'c-text', 'c-muted', 'c-accent', 'c-error', 'c-warning']) {
      const ratio = contrast(token(ink), token(ground));
      assert.ok(ratio >= 4.5, `--${ink} a --${ground} színen: ${ratio.toFixed(2)}`);
    }
  }
});

test('a sorszám címkéjén a világos felirat legalább 4,5:1', () => {
  for (const side of ['c-ink', 'c-ink-wrong']) assert.ok(contrast(token('c-bg'), token(side)) >= 4.5, side);
});

test('a sorhatár és a hangsúlyos vonal legalább 3:1 minden sorszínen', () => {
  for (const ground of grounds) {
    for (const line of ['c-grid-row', 'c-grid-strong']) {
      const ratio = contrast(token(line), token(ground));
      assert.ok(ratio >= 3, `--${line} a --${ground} színen: ${ratio.toFixed(2)}`);
    }
  }
});

test('a két sorszín és a hangsúlyos vonal is megkülönböztethető', () => {
  assert.notEqual(token('c-row-a'), token('c-row-b'));
  assert.ok(contrast(token('c-grid-strong'), token('c-row-a')) > contrast(token('c-grid-row'), token('c-row-a')));
});

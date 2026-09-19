/*
 * Grid colours (PQW-874, WCAG 2.2 AA): on either alternating row colour the
 * symbols, the row number and the stitch count reach at least 4.5:1, the row
 * boundary and the emphasised line at least 3:1 (1.4.3, 1.4.11). The tokens
 * come from the stylesheet.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const token = (name) => {
  const match = root.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `missing token: --${name}`);
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

test('the contrast calculation follows the WCAG formula', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(0), '21');
  assert.equal(contrast('#777777', '#ffffff').toFixed(2), '4.48');
});

test('symbols and labels reach at least 4.5:1 on every row colour', () => {
  for (const ground of grounds) {
    for (const ink of ['c-ink', 'c-ink-wrong', 'c-text', 'c-muted', 'c-accent', 'c-error', 'c-warning']) {
      const ratio = contrast(token(ink), token(ground));
      assert.ok(ratio >= 4.5, `--${ink} on --${ground}: ${ratio.toFixed(2)}`);
    }
  }
});

test('the light label on the row-number badge reaches at least 4.5:1', () => {
  for (const side of ['c-ink', 'c-ink-wrong']) assert.ok(contrast(token('c-bg'), token(side)) >= 4.5, side);
});

test('the row boundary and the emphasised line reach at least 3:1 on every row colour', () => {
  for (const ground of grounds) {
    for (const line of ['c-grid-row', 'c-grid-strong']) {
      const ratio = contrast(token(line), token(ground));
      assert.ok(ratio >= 3, `--${line} on --${ground}: ${ratio.toFixed(2)}`);
    }
  }
});

test('the two row colours and the emphasised line stay distinguishable', () => {
  assert.notEqual(token('c-row-a'), token('c-row-b'));
  assert.ok(contrast(token('c-grid-strong'), token('c-row-a')) > contrast(token('c-grid-row'), token('c-row-a')));
});

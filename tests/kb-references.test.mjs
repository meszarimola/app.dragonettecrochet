/*
 * Every knowledge-base citation resolves (PQW-1106).
 *
 * The comment policy says to point at a knowledge-base section instead of
 * explaining in prose. A pointer is worth more than the prose it replaced only
 * while it resolves, and nothing else in the repository would notice a renamed
 * file or a renumbered section. The sibling repository has had this test for
 * longer; this is its counterpart, extended to the crochet knowledge base and to
 * the `reference` fields of the validation rules.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { test } from 'node:test';

import { DEV_DIR, DOMAIN_DIR, parseSections, resolveSection } from '../scripts/kb.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const SEARCHED_DIRS = ['src', 'tests', 'e2e', 'e2e-prod', 'scripts', 'docs', '.claude', '.github'];
const SEARCHED_FILES = ['index.html', 'CLAUDE.md', 'README.md'];
const SEARCHED_EXTENSIONS = new Set(['.ts', '.mjs', '.js', '.md', '.html', '.sh', '.py', '.yml']);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', '.git']);

/** `interface.md §4`, `core-domain §12`, `03 §9.8` — the three forms in use. */
const CITATION = /\b([a-z][a-z0-9-]*|\d{2})(?:\.md)? §(\d+(?:\.\d+)?)/g;

function filesUnder(dir, found = []) {
  for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) filesUnder(join(dir, entry.name), found);
    } else if (SEARCHED_EXTENSIONS.has(extname(entry.name))) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

function exists(path) {
  try {
    statSync(new URL(path, ROOT));
    return true;
  } catch {
    return false;
  }
}

/** Every addressable file, by the label a citation uses, with its sections parsed. */
function knowledgeBase() {
  const bases = new Map();
  for (const [dir, shape] of [
    [DEV_DIR, 'dev'],
    [DOMAIN_DIR, 'domain'],
  ]) {
    for (const file of readdirSync(new URL(dir, ROOT))) {
      if (!file.endsWith('.md') || file === 'README.md') continue;
      const label = shape === 'dev' ? file.slice(0, -3) : file.slice(0, 2);
      const text = read(`${dir}${file}`);
      bases.set(label, { text, sections: parseSections(text, shape) });
    }
  }
  return bases;
}

test('every knowledge-base citation resolves to a real section', () => {
  const bases = knowledgeBase();
  const files = [...SEARCHED_DIRS.filter(exists).flatMap((dir) => filesUnder(dir)), ...SEARCHED_FILES.filter(exists)];

  const broken = [];
  let checked = 0;

  for (const file of files) {
    for (const [citation, label, id] of read(file).matchAll(CITATION)) {
      const base = bases.get(label);
      if (!base) continue; // Not a knowledge-base label — some other `name §n`.
      checked += 1;
      if (!resolveSection({ text: base.text, sections: base.sections, id })) {
        broken.push(`${file}: ${citation}`);
      }
    }
  }

  assert.deepEqual(broken, [], `broken knowledge-base citations:\n${broken.join('\n')}`);
  assert.ok(checked > 500, `only ${checked} citations were checked; the search lost a directory`);
});

test('every validation rule points at a knowledge-base section that exists', async () => {
  const bases = knowledgeBase();
  const { RULES } = await import('../src/core/rules.ts');

  const broken = [];
  for (const [name, rule] of Object.entries(RULES)) {
    assert.ok(rule.reference, `the ${name} rule has no reference`);
    for (const [citation, label, id] of rule.reference.matchAll(CITATION)) {
      const base = bases.get(label);
      if (!base) continue;
      if (!resolveSection({ text: base.text, sections: base.sections, id })) {
        broken.push(`${name}: ${citation}`);
      }
    }
  }

  assert.deepEqual(broken, [], `validation rules citing a section that does not exist:\n${broken.join('\n')}`);
});

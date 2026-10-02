/*
 * Addressed knowledge-base reading (PQW-1106). The parsing is tested on fixtures
 * written here, so a change to the real knowledge base cannot quietly rewrite
 * what the test believes; the last two tests then check the real files.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { test } from 'node:test';

import {
  DEV_DIR,
  DOMAIN_DIR,
  extract,
  indexLines,
  NincsIlyen,
  parseSections,
  resolveFile,
  resolveSection,
} from '../scripts/kb.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const markdown = (dir) =>
  readdirSync(new URL(dir, ROOT))
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort();

const DEV = ['# The interface', '', '## §1 First', 'one', '', '## §2 Second', 'two', 'still two', ''].join('\n');

const DOMAIN = [
  '# 03: Flat rows',
  '',
  '## 9. Common mistakes',
  'intro',
  '',
  '8. **Chains that do not connect.** body',
  '9. **Unbalanced repeat.** body',
  '',
  '## 10. Checklist',
  'list',
  '',
  '### 10.1 A sub-section',
  'sub',
  '',
].join('\n');

test('developer sections are read with their boundaries', () => {
  const sections = parseSections(DEV, 'dev');
  assert.deepEqual(
    sections.map(({ id, title }) => ({ id, title })),
    [
      { id: '1', title: 'First' },
      { id: '2', title: 'Second' },
    ],
  );
  assert.equal(extract({ text: DEV, sections, ids: ['2'] }), '## §2 Second\ntwo\nstill two');
});

test('domain sections are read, sub-sections included, and nesting ends a parent', () => {
  const sections = parseSections(DOMAIN, 'domain');
  assert.deepEqual(
    sections.map(({ id, depth }) => ({ id, depth })),
    [
      { id: '9', depth: 2 },
      { id: '10', depth: 2 },
      { id: '10.1', depth: 3 },
    ],
  );
  // §10 runs to the end of the file, because its sub-section does not close it.
  assert.match(extract({ text: DOMAIN, sections, ids: ['10'] }), /### 10\.1 A sub-section/);
  assert.equal(extract({ text: DOMAIN, sections, ids: ['10.1'] }), '### 10.1 A sub-section\nsub');
});

test('a §N.M citation may address a numbered item of §N', () => {
  const sections = parseSections(DOMAIN, 'domain');
  assert.deepEqual(resolveSection({ text: DOMAIN, sections, id: '9.8' }), { section: sections[0], item: 8 });
  assert.equal(resolveSection({ text: DOMAIN, sections, id: '9.99' }), undefined);
  assert.match(extract({ text: DOMAIN, sections, ids: ['9.8'] }), /8\. pontja/);
});

test('sections come out in file order however they were asked for', () => {
  const sections = parseSections(DEV, 'dev');
  assert.equal(extract({ text: DEV, sections, ids: ['2', '1'] }), '## §1 First\none\n\n## §2 Second\ntwo\nstill two');
});

test('an unknown section names the ones that exist', () => {
  const sections = parseSections(DEV, 'dev');
  assert.throws(
    () => extract({ text: DEV, sections, ids: ['9'] }),
    (error) => {
      assert.ok(error instanceof NincsIlyen);
      assert.match(error.message, /§1, §2/);
      return true;
    },
  );
});

test('an index line is written the way a citation is', () => {
  assert.deepEqual(indexLines({ label: 'interface', sections: parseSections(DEV, 'dev') }), [
    'interface §1  First',
    'interface §2  Second',
  ]);
});

test('a file is addressed by name, with or without .md, and a domain file by its number', () => {
  const files = { devFiles: ['interface.md', 'testing.md'], domainFiles: ['03-flat-rows.md'] };
  assert.deepEqual(resolveFile('interface', files), {
    path: 'docs/kb/interface.md',
    shape: 'dev',
    label: 'interface',
  });
  assert.equal(resolveFile('interface.md', files).path, 'docs/kb/interface.md');
  assert.deepEqual(resolveFile('03', files), {
    path: 'docs/knowledge-base/03-flat-rows.md',
    shape: 'domain',
    label: '03',
  });
  assert.throws(() => resolveFile('nincsilyen', files), NincsIlyen);
});

test('every real knowledge-base file parses into sections, with no id used twice', () => {
  for (const [dir, shape] of [
    [DEV_DIR, 'dev'],
    [DOMAIN_DIR, 'domain'],
  ]) {
    for (const file of markdown(dir)) {
      const sections = parseSections(read(`${dir}${file}`), shape);
      assert.ok(sections.length > 0, `${dir}${file} has no numbered section`);

      const seen = new Set();
      for (const { id } of sections) {
        assert.ok(!seen.has(id), `${dir}${file} uses §${id} twice, so a citation to it is ambiguous`);
        seen.add(id);
      }
    }
  }
});

test('the developer index stays small enough to read every ticket', () => {
  const lines = markdown(DEV_DIR).flatMap((file) =>
    indexLines({ label: basename(file, '.md'), sections: parseSections(read(`${DEV_DIR}${file}`), 'dev') }),
  );
  const characters = lines.join('\n').length;
  assert.ok(lines.length > 100, 'the index lost most of its sections');
  assert.ok(characters < 40_000, `the index grew to ${characters} characters; split a file or shorten the titles`);
});

test('npm run kb is wired to the script', () => {
  assert.equal(JSON.parse(read('package.json')).scripts.kb, 'node scripts/kb.mjs');
});

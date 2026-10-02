/*
 * Addressed reading of the two knowledge bases (PQW-1106).
 *
 *   npm run kb                     every section of both, one line each
 *   npm run kb -- interface        the index of docs/kb/interface.md
 *   npm run kb -- interface 4 51   those two sections, in full
 *   npm run kb -- 06 5.2           section 5.2 of docs/knowledge-base/06-…
 *
 * WHY IT EXISTS
 *   Both knowledge bases already say "read only the section your task touches",
 *   and both are numbered so a citation stays stable. What was missing was a way
 *   to act on that without either grepping blind or loading a whole file:
 *   interface.md alone is 1990 lines, about 25k tokens.
 *
 *   The full index is 212 sections and about 4k tokens, and an average section is
 *   26 lines. So: read the index, then pull the three sections that matter.
 *
 * THE TWO SHAPES
 *   Developer decisions in docs/kb/ head their sections `## §N`.
 *   Crochet domain knowledge in docs/knowledge-base/ uses `## N.` and `### N.M`,
 *   cited as `06 §5.2`. Both are handled; the citation form is what differs.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

export const DEV_DIR = 'docs/kb/';
export const DOMAIN_DIR = 'docs/knowledge-base/';

export class NincsIlyen extends Error {}

/** `## §4 Title` — the developer knowledge base. */
const DEV_HEADING = /^## §(\d+)\s+(.*)$/;

/** `## 4. Title` and `### 4.2 Title` — the crochet domain knowledge base. */
const DOMAIN_HEADING = /^(#{2,3}) (\d+(?:\.\d+)?)\.?\s+(.*)$/;

/**
 * The sections of one file: an id, a title, and the line range the body spans.
 * A section ends where the next heading at the same or a shallower level starts.
 */
export function parseSections(text, shape) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, index) => {
    if (shape === 'dev') {
      const match = DEV_HEADING.exec(line);
      if (match) found.push({ id: match[1], title: match[2].trim(), depth: 2, from: index });
      return;
    }
    const match = DOMAIN_HEADING.exec(line);
    if (match) found.push({ id: match[2], title: match[3].trim(), depth: match[1].length, from: index });
  });

  return found.map((section, position) => {
    const next = found.slice(position + 1).find((later) => later.depth <= section.depth);
    return { ...section, to: next ? next.from : lines.length };
  });
}

/** Which file a name addresses, and which shape it has. */
export function resolveFile(name, { devFiles, domainFiles }) {
  const wanted = String(name).replace(/\.md$/, '');

  const dev = devFiles.find((file) => basename(file, '.md') === wanted);
  if (dev) return { path: `${DEV_DIR}${dev}`, shape: 'dev', label: basename(dev, '.md') };

  const domain = domainFiles.find((file) => file.startsWith(`${wanted}-`) || basename(file, '.md') === wanted);
  if (domain) return { path: `${DOMAIN_DIR}${domain}`, shape: 'domain', label: domain.slice(0, 2) };

  throw new NincsIlyen(
    `Nincs ilyen tudásbázis-fájl: "${name}".\n` +
      `Fejlesztői: ${devFiles.map((file) => basename(file, '.md')).join(', ')}\n` +
      `Horgolás:  ${domainFiles.map((file) => file.slice(0, 2)).join(', ')}`,
  );
}

/** One index line per section, in the form a citation takes, then the title. */
export function indexLines({ label, sections }) {
  return sections.map((section) => `${label} §${section.id}  ${section.title}`);
}

/**
 * Which section holds an id. `§9.8` may name a heading, or the eighth numbered
 * item of section 9 — both forms are cited in the repository, so both resolve.
 * KB: README.md, the conventions list.
 */
export function resolveSection({ text, sections, id }) {
  const heading = sections.find((section) => section.id === String(id));
  if (heading) return { section: heading, item: undefined };

  const [parentId, itemNumber] = String(id).split('.');
  const parent = sections.find((section) => section.id === parentId);
  if (parent && itemNumber && hasItem({ text, section: parent, itemNumber })) {
    return { section: parent, item: Number(itemNumber) };
  }
  return undefined;
}

/** Whether a section's body carries `N.` as a numbered list item. */
function hasItem({ text, section, itemNumber }) {
  const body = text.split('\n').slice(section.from, section.to);
  return body.some((line) => new RegExp(`^${itemNumber}\\. `).test(line));
}

/** The body of the requested sections, in the order the file has them. */
export function extract({ text, sections, ids }) {
  const lines = text.split('\n');
  const resolved = new Map();

  for (const id of ids) {
    const hit = resolveSection({ text, sections, id });
    if (!hit) {
      throw new NincsIlyen(
        `Nincs ilyen szakasz: §${id}. Ami van: §${sections.map((section) => section.id).join(', §')}`,
      );
    }
    const note = hit.item ? `${hit.item}. pontja` : undefined;
    const previous = resolved.get(hit.section.id);
    resolved.set(hit.section.id, previous?.note && note ? previous : { section: hit.section, note });
  }

  return [...resolved.values()]
    .sort((left, right) => left.section.from - right.section.from)
    .map(({ section, note }) => {
      const body = lines.slice(section.from, section.to).join('\n').trimEnd();
      return note ? `${body}\n\n[A hivatkozás ennek a szakasznak a ${note}.]` : body;
    })
    .join('\n\n');
}

const markdown = (path) =>
  readdirSync(new URL(path, ROOT))
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort();

const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

/** Every section of one directory, one line each. */
export function indexOf(dir, shape, { readFile = read, listFiles = markdown } = {}) {
  const lines = [];
  for (const file of listFiles(dir)) {
    const label = shape === 'dev' ? basename(file, '.md') : file.slice(0, 2);
    lines.push(...indexLines({ label, sections: parseSections(readFile(`${dir}${file}`), shape) }));
  }
  return lines;
}

function main(argv) {
  const args = argv.slice(2);
  const files = { devFiles: markdown(DEV_DIR), domainFiles: markdown(DOMAIN_DIR) };

  try {
    // The developer index is what every ticket needs; the crochet domain index is
    // nearly as long again, and only matters for stitch, row or garment logic.
    if (args.length === 0) {
      const lines = indexOf(DEV_DIR, 'dev');
      console.log(lines.join('\n'));
      console.log('');
      console.log(`${lines.length} fejlesztői szakasz. Egy szakasz kiírása:  npm run kb -- <fájl> <§> [<§> …]`);
      console.log(`A horgolás-tudásbázis indexe külön:    npm run kb -- --horgolas`);
      return 0;
    }

    if (args[0] === '--horgolas') {
      const lines = indexOf(DOMAIN_DIR, 'domain');
      console.log(lines.join('\n'));
      console.log('');
      console.log(`${lines.length} szakasz. Egy szakasz kiírása:  npm run kb -- 04 4.4`);
      return 0;
    }

    const [name, ...ids] = args;
    const { path, shape, label } = resolveFile(name, files);
    const text = read(path);
    const sections = parseSections(text, shape);

    if (ids.length === 0) {
      console.log(indexLines({ label, shape, sections }).join('\n'));
      console.log('');
      console.log(`${sections.length} szakasz a(z) ${path} fájlban.`);
      return 0;
    }

    console.log(extract({ text, sections, ids }));
    return 0;
  } catch (error) {
    if (error instanceof NincsIlyen) {
      console.error(`\u001b[31m${error.message}\u001b[0m`);
      return 1;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}

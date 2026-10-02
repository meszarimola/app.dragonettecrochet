/*
 * Locator inventory (PQW-978): machine guard for the frozen product strings of the browser tests.
 *
 * `.claude/rules/frozen-paths.md` freezes every locator argument and expected
 * value under e2e/, but until now that was a reviewer's judgement: someone had
 * to decide whether a change to a spec moved product text or only the
 * navigation leading to it. The redesign inserts a navigation call into many
 * specs at once, which is exactly the change that judgement scales worst on.
 *
 * So: collect the multiset of string literals handed to the calls that drive or
 * assert the interface, and freeze it. A navigation line added to twenty specs
 * leaves the fixture byte-identical; an invented selector or a reworded
 * expectation changes it, and tests/fixtures/ is gated by .githooks/pre-commit.
 *
 * The sources are read as raw text, the way `markupUses()` of ui-i18n.test.mjs
 * reads index.html — no AST.
 *
 * What the reading does not see, all of it deliberate:
 *
 * - A literal is stored as it is written, so `'it\'s ok'` and `"it's ok"` are
 *   two entries. Comparing them would mean parsing them.
 * - An unknown call form — `getByTestId`, say — is invisible, and invisible
 *   without saying so. Only the names in `DRIVING_CALLS` are read.
 * - Only **one** hop through a local helper is resolved (PQW-981). A second hop
 *   is named under `(second hop)` rather than followed. Those names are the
 *   helpers', so renaming a helper does move the fixture although no product
 *   text did — the one place the promise above does not hold exactly.
 * - Only a bare parameter resolves. `choices.shape` is one level further in and
 *   is left alone, rather than attributed to every call the object reaches.
 * - A helper is a `function` or an arrow with a `{ … }` body. An arrow whose
 *   body is one expression is not read — or, when that expression carries a
 *   brace of its own, is read with that brace taken for the body, which comes
 *   to the same thing: its parameters resolve to nothing either way.
 * - Two helpers of one name in a file are named under `(repeated name)` and
 *   neither is resolved. Which one a call meant is scope, and scope is more
 *   than a reading of raw text can tell.
 * - A driving call's name written inside a string literal would send the scan
 *   into that string, because the scan runs over comment-stripped source that
 *   still holds string contents. No spec does this today.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';

/** The calls whose arguments are interface text: what a test drives, and what it expects to see. */
const DRIVING_CALLS = [
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'fill',
  'selectOption',
  'toHaveText',
  'toContainText',
  'toHaveValue',
  'toHaveAttribute',
];

/** After these, a `/` opens a regular expression rather than dividing. */
const BEFORE_A_REGEX = new Set(['(', ',', ':', '[', '{', '=', '!', '&', '|', '?', '+', ';']);

const endOfString = (source, start, quote) => {
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === '\\') i += 1;
    else if (source[i] === quote) return i;
  }
  throw new Error(`unterminated literal at ${start}`);
};

const endOfRegex = (source, start) => {
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === '\\') i += 1;
    else if (source[i] === '[') while (i < source.length && source[i] !== ']') i += source[i] === '\\' ? 2 : 1;
    else if (source[i] === '/') {
      let end = i + 1;
      while (/[a-z]/.test(source[end] ?? '')) end += 1;
      return end;
    }
  }
  throw new Error(`unterminated regular expression at ${start}`);
};

/**
 * The literals of one argument list, from just after its `(`, kept apart by argument. Only the literals of the call
 * itself are read: a nested call sits one parenthesis deeper and is collected at its own site instead, while an
 * options object is transparent, so the `name` of `getByRole('button', { name: 'Fordulás' })` comes out beside the
 * role. A string yields its text, a regular expression its source with the slashes, which is what keeps it comparable.
 */
function argumentSlots(source, start) {
  const slots = [[]];
  let depth = 0;
  // Brackets and braces are counted only to place the commas. They stay invisible to the literals themselves, which
  // is what keeps an options object transparent — and a comma inside one must not shift every later argument along.
  let inside = 0;
  let previous = '(';
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (/\s/.test(character)) continue;
    if (character === ')' && depth === 0) return slots;
    if (character === ',' && depth === 0 && inside === 0) slots.push([]);
    else if (character === '[' || character === '{') inside += 1;
    else if (character === ']' || character === '}') inside -= 1;
    else if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === "'" || character === '"' || character === '`') {
      const end = endOfString(source, i, character);
      if (depth === 0) slots[slots.length - 1].push(source.slice(i + 1, end));
      i = end;
    } else if (character === '/' && BEFORE_A_REGEX.has(previous)) {
      const end = endOfRegex(source, i);
      if (depth === 0) slots[slots.length - 1].push(source.slice(i, end));
      i = end - 1;
    }
    previous = character;
  }
  throw new Error(`unbalanced argument list at ${start}`);
}

/** The same list read as one multiset, for a call whose arguments are all interface text in their own right. */
const argumentLiterals = (source, start) => argumentSlots(source, start).flat();

/** The text of one argument list, from just after its `(` to the `)` that closes it. */
function argumentText(source, start) {
  let depth = 0;
  let previous = '(';
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (character === ')' && depth === 0) return source.slice(start, i);
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === "'" || character === '"' || character === '`') i = endOfString(source, i, character);
    else if (character === '/' && BEFORE_A_REGEX.has(previous)) i = endOfRegex(source, i) - 1;
    if (!/\s/.test(character)) previous = character;
  }
  throw new Error(`unbalanced argument list at ${start}`);
}

/**
 * The same source with every comment blanked out, its length kept. Without this the reading is not comment-aware, the
 * trap `.claude/rules/tests.md` names: a `//` after an argument would read as the start of a regular expression, and
 * a call name written in prose would send the scan off the end of the file.
 */
function withoutComments(source) {
  let out = '';
  let previous = '';
  let i = 0;
  while (i < source.length) {
    const character = source[i];
    if (character === "'" || character === '"' || character === '`') {
      const end = endOfString(source, i, character);
      out += source.slice(i, end + 1);
      i = end + 1;
      previous = character;
    } else if (character === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (character === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (character === '/' && BEFORE_A_REGEX.has(previous)) {
      const end = endOfRegex(source, i);
      out += source.slice(i, end);
      i = end;
      previous = '/';
    } else {
      out += character;
      if (!/\s/.test(character)) previous = character;
      i += 1;
    }
  }
  return out;
}

/** The literal standing at `index`, if one does. */
function literalAt(source, index) {
  const character = source[index];
  if (character === "'" || character === '"' || character === '`') {
    return source.slice(index + 1, endOfString(source, index, character));
  }
  return character === '/' ? source.slice(index, endOfRegex(source, index)) : undefined;
}

/*
 * One hop through a local helper (PQW-981).
 *
 * A local helper hides product text from the reading above: the literal stands at the helper's call site, and the
 * driving call inside the helper only ever sees a variable, so `pick(page, /Láncszem \(lsz\)/)` froze nothing. What
 * follows resolves one hop — a function defined in the same file that hands one of its own parameters straight to a
 * driving call — which covers `pick`, `section`, `openSection`, `box` and `enter`. The boundaries are listed at the
 * top of this file.
 *
 * One consequence to know before reading a count: it becomes a function of call sites, so a literal passed to a helper
 * from three places counts three times, while one written inside the helper's body still counts once.
 */

/** The names a hop that is not followed is filed under, so it shows up as a fixture diff rather than as silence. */
const SECOND_HOP = '(second hop)';
const REPEATED_NAME = '(repeated name)';

/** The same text with every string and regular expression blanked out, so a selector's spelling is not read as a name. */
function withoutLiterals(text) {
  let out = '';
  let previous = '(';
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === "'" || character === '"' || character === '`') {
      const end = endOfString(text, i, character);
      out += ' '.repeat(end - i + 1);
      i = end;
    } else if (character === '/' && BEFORE_A_REGEX.has(previous)) {
      const end = endOfRegex(text, i);
      out += ' '.repeat(end - i);
      i = end - 1;
    } else {
      out += character;
      if (!/\s/.test(character)) previous = character;
    }
  }
  return out;
}

/** The names `text` reads as values: not an object key (`name:`), not a property (`.name`), not an object of one (`name.`). */
function namesIn(text) {
  const names = new Set();
  for (const match of withoutLiterals(text).matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*(.?)/g)) {
    if (match[3] !== ':' && match[3] !== '.') names.add(match[2]);
  }
  return names;
}

/** The parameter names of one list, from just after its `(`: `page: Page, name: RegExp` yields `['page', 'name']`. */
function parameterNames(source, start) {
  const names = [];
  let depth = 0;
  let expecting = true;
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (character === ')' && depth === 0) return names;
    if ('([{'.includes(character)) depth += 1;
    else if (')]}'.includes(character)) depth -= 1;
    else if (character === ',' && depth === 0) expecting = true;
    else if (expecting && depth === 0 && /[A-Za-z_$]/.test(character)) {
      let end = i;
      while (/[\w$]/.test(source[end] ?? '')) end += 1;
      let next = end;
      while (/\s/.test(source[next] ?? '')) next += 1;
      // A parameter is followed by its type, its default or the end of its slot. A name in any other position is
      // inside something this reading does not parse — the `number` of `Record<string, number>`, say — and taking it
      // would shift every later parameter, so the search for this one simply goes on.
      if (':,=?)'.includes(source[next] ?? ')')) {
        names.push(source.slice(i, end));
        expecting = false;
      }
      i = end - 1;
    }
  }
  throw new Error(`unbalanced parameter list at ${start}`);
}

/** The index just past the `)` that closes the list opened at `start`. */
function endOfList(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (character === ')' && depth === 0) return i + 1;
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === "'" || character === '"' || character === '`') i = endOfString(source, i, character);
  }
  throw new Error(`unbalanced parameter list at ${start}`);
}

/** The `{ … }` that follows a parameter list, as `[from, to]`, or undefined where the shape is not read. */
function bodyAfter(source, from) {
  let open = from;
  while (open < source.length && source[open] !== '{' && source[open] !== ';') open += 1;
  if (source[open] !== '{') return undefined;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const character = source[i];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return [open, i];
    } else if (character === "'" || character === '"' || character === '`') i = endOfString(source, i, character);
  }
  return undefined;
}

const DEFINITIONS =
  /(?:\basync\s+)?\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*(?:async\s*)?\(/g;

/** Every function this source defines with at least one parameter and a body that can be read. */
function localFunctions(source) {
  const found = [];
  for (const match of source.matchAll(DEFINITIONS)) {
    const from = match.index + match[0].length;
    let parameters;
    let after;
    try {
      parameters = parameterNames(source, from);
      after = endOfList(source, from);
    } catch {
      continue;
    }
    const body = bodyAfter(source, after);
    if (parameters.length === 0 || body === undefined) continue;
    // `const x = (a, b)` is an expression, not a function. Without the arrow it would stand here as a helper that
    // happens to share a name with a real one, which is a repeated name nobody wrote.
    if (match[2] !== undefined && !source.slice(after, body[0]).includes('=>')) continue;
    found.push({ name: match[1] ?? match[2], parameters, body, from: match.index, signature: after });
  }
  return found;
}

/** Which driving calls each parameter of `fn` is handed to, as `Map<parameter, Set<call>>`. */
function forwardedParameters(source, fn) {
  const body = source.slice(fn.body[0], fn.body[1]);
  const reaches = new Map();
  const calls = new RegExp(`\\b(${DRIVING_CALLS.join('|')})\\(`, 'g');
  for (const match of body.matchAll(calls)) {
    const names = namesIn(argumentText(body, match.index + match[0].length));
    for (const parameter of fn.parameters) {
      if (!names.has(parameter)) continue;
      if (!reaches.has(parameter)) reaches.set(parameter, new Set());
      reaches.get(parameter).add(match[1]);
    }
  }
  return reaches;
}

/** Every call of `fn` outside its own definition, each as its argument list kept apart by argument. */
function callSites(source, fn) {
  const sites = [];
  for (const match of source.matchAll(new RegExp(`\\b${fn.name}\\s*\\(`, 'g'))) {
    // The definition names itself, and a recursive call inside the body says nothing about a caller's literals. A
    // call standing above the definition is neither: a declaration hoists, so that call is real and counts.
    if (match.index >= fn.from && match.index < fn.signature) continue;
    if (match.index >= fn.body[0] && match.index <= fn.body[1]) continue;
    if (/[\w$.]/.test(source[match.index - 1] ?? '')) continue;
    sites.push(argumentSlots(source, match.index + match[0].length));
  }
  return sites;
}

/** The arguments of `fn` that reach a driving call only through another local helper — reported, not followed. */
function secondHops(source, fn, local, forwards) {
  const hops = [];
  const body = source.slice(fn.body[0], fn.body[1]);
  for (const other of local) {
    const reaches = forwards.get(other);
    if (other === fn || reaches.size === 0) continue;
    for (const match of body.matchAll(new RegExp(`\\b${other.name}\\s*\\(`, 'g'))) {
      if (/[\w$.]/.test(body[match.index - 1] ?? '')) continue;
      const handed = splitArguments(argumentText(body, match.index + match[0].length));
      handed.forEach((text, at) => {
        if (!reaches.has(other.parameters[at])) return;
        for (const parameter of fn.parameters) {
          if (forwards.get(fn).has(parameter)) continue;
          if (namesIn(text).has(parameter)) hops.push(`${fn.name}(${parameter}) -> ${other.name}`);
        }
      });
    }
  }
  return hops;
}

/** One argument list split by top-level comma, as text. */
function splitArguments(text) {
  const parts = [''];
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if ('(['.includes(character) || character === '{') depth += 1;
    else if (')]'.includes(character) || character === '}') depth -= 1;
    else if (character === ',' && depth === 0) {
      parts.push('');
      continue;
    }
    parts[parts.length - 1] += character;
  }
  return parts;
}

/** @see tests/e2e-locators.test.mjs — the literals of one source, counted per call: `{ getByRole: { button: 168, Fordulás: 15 } }`. */
export function callLiterals(raw, into = {}) {
  const source = withoutComments(raw);
  const count = (name, literal, times = 1) => {
    if (into[name] === undefined) into[name] = {};
    into[name][literal] = (into[name][literal] ?? 0) + times;
  };
  const calls = new RegExp(`\\b(${DRIVING_CALLS.join('|')})\\(`, 'g');
  for (const match of source.matchAll(calls)) {
    for (const literal of argumentLiterals(source, match.index + match[0].length)) count(match[1], literal);
  }
  // `filter({ hasText: 'láncszem' })` picks a row by its product text, but `filter` also takes a lambda whose own
  // literals are not interface text, so the option is read on its own rather than the call.
  for (const match of source.matchAll(/\bhasText:\s*/g)) {
    const literal = literalAt(source, match.index + match[0].length);
    if (literal !== undefined) count('hasText', literal);
  }
  const local = localFunctions(source);
  const forwards = new Map(local.map((fn) => [fn, forwardedParameters(source, fn)]));
  // Two definitions of one name would each claim the other's call sites, counting every literal there twice. Which
  // one a call meant is scope, which this reading cannot tell, so a repeated name is named and left alone.
  const defined = new Map();
  for (const fn of local) defined.set(fn.name, (defined.get(fn.name) ?? 0) + 1);
  const named = new Set();
  for (const fn of local) {
    const reaches = forwards.get(fn);
    for (const hop of secondHops(source, fn, local, forwards)) count(SECOND_HOP, hop);
    if (defined.get(fn.name) > 1) {
      // Filed once for the name, counting the definitions — which is what the entry is about.
      if (reaches.size > 0 && !named.has(fn.name)) {
        named.add(fn.name);
        count(REPEATED_NAME, fn.name, defined.get(fn.name));
      }
      continue;
    }
    for (const slots of callSites(source, fn)) {
      fn.parameters.forEach((parameter, at) => {
        for (const call of reaches.get(parameter) ?? []) for (const literal of slots[at] ?? []) count(call, literal);
      });
    }
  }
  return into;
}

/** Every file of e2e/ and e2e-prod/, in a stable order. */
export function specFiles() {
  const files = (directory) =>
    readdirSync(directory).flatMap((name) => {
      const entry = new URL(`${directory.href}/${name}`);
      return statSync(entry).isDirectory() ? files(entry) : [entry];
    });
  return [...files(new URL('../e2e', import.meta.url)), ...files(new URL('../e2e-prod', import.meta.url))].sort(
    (a, b) => (a.pathname < b.pathname ? -1 : 1),
  );
}

/** The inventory of the whole browser suite. */
export function inventory() {
  const found = {};
  for (const file of specFiles()) callLiterals(readFileSync(file, 'utf8'), found);
  return found;
}

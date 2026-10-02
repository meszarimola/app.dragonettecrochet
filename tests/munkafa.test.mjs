/*
 * The worktree command's decisions (PQW-1105). Everything that touches git or
 * the filesystem stays in the CLI; what is tested here is what it decides:
 * the branch name, the directory, the port, and which worktree a close removes.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  branchName,
  closePlan,
  HibasBemenet,
  PORT_FIRST,
  PORT_LAST,
  parseWorktrees,
  plan,
  portFor,
  worktreeDir,
} from '../scripts/munkafa.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

test('the branch and the directory follow the convention', () => {
  assert.equal(branchName({ ticket: 1105, slug: 'worktree-eszkoz' }), 'feature/PQW-1105-worktree-eszkoz');
  assert.equal(branchName({ ticket: 920, slug: 'generalt-cim', kind: 'fix' }), 'fix/PQW-920-generalt-cim');
  assert.equal(worktreeDir('worktree-eszkoz'), 'app-dc-worktree-eszkoz');
});

test('the port is the ticket number folded into the range, and never 5181', () => {
  assert.equal(portFor({ ticket: 1105 }), PORT_FIRST + 5);
  assert.equal(portFor({ ticket: 1100 }), PORT_FIRST);
  for (const ticket of [1, 99, 100, 920, 1104, 99999]) {
    const port = portFor({ ticket });
    assert.ok(port >= PORT_FIRST && port <= PORT_LAST, `${ticket} fell outside the range: ${port}`);
    assert.notEqual(port, 5181, 'that port belongs to the main checkout');
  }
});

test('two tickets that fold onto one port do not get the same one', () => {
  const first = portFor({ ticket: 1105 });
  const second = portFor({ ticket: 1205, claimed: [first] });
  assert.notEqual(second, first);
  assert.equal(second, first + 1);
});

test('a claimed port is skipped, wrapping around the end of the range', () => {
  const claimed = [];
  for (let port = PORT_FIRST; port <= PORT_LAST; port += 1) if (port !== PORT_FIRST + 3) claimed.push(port);
  assert.equal(portFor({ ticket: 1199, claimed }), PORT_FIRST + 3);
});

test('a full range is an error, not a silent collision', () => {
  const claimed = [];
  for (let port = PORT_FIRST; port <= PORT_LAST; port += 1) claimed.push(port);
  assert.throws(() => portFor({ ticket: 1105, claimed }), HibasBemenet);
});

test('a bad ticket number or slug is refused before git is touched', () => {
  assert.throws(() => plan({ ticket: 'PQW-1105', slug: 'jo-nev' }), HibasBemenet);
  assert.throws(() => plan({ ticket: '', slug: 'jo-nev' }), HibasBemenet);
  for (const slug of ['Nagy-Betu', 'ekezetes-nev-á', 'alul_vonas', '-elol-kotojel', 'ketto--kotojel', '']) {
    assert.throws(() => plan({ ticket: 1105, slug }), HibasBemenet, `accepted a bad slug: "${slug}"`);
  }
  assert.throws(() => plan({ ticket: 1105, slug: 'jo-nev', kind: 'hotfix' }), HibasBemenet);
});

test('a whole plan comes out of one call', () => {
  assert.deepEqual(plan({ ticket: 1105, slug: 'worktree-eszkoz' }), {
    branch: 'feature/PQW-1105-worktree-eszkoz',
    dir: 'app-dc-worktree-eszkoz',
    port: PORT_FIRST + 5,
  });
});

const PORCELAIN = `worktree /Users/x/app.dragonettecrochet
HEAD 4f5f7220
branch refs/heads/develop

worktree /Users/x/app-dc-english-default
HEAD 88e5f440
branch refs/heads/feature/PQW-1100-english-default

worktree /Users/x/app-dc-leirt
HEAD aaaa1111
detached
`;

test('the worktree list is read back, detached heads included', () => {
  assert.deepEqual(parseWorktrees(PORCELAIN), [
    { path: '/Users/x/app.dragonettecrochet', branch: 'develop' },
    { path: '/Users/x/app-dc-english-default', branch: 'feature/PQW-1100-english-default' },
    { path: '/Users/x/app-dc-leirt', branch: undefined },
  ]);
});

test('a close finds the one worktree of its ticket', () => {
  const worktrees = parseWorktrees(PORCELAIN);
  assert.deepEqual(closePlan({ ticket: 1100, worktrees }), {
    path: '/Users/x/app-dc-english-default',
    branch: 'feature/PQW-1100-english-default',
  });
});

test('a close refuses when there is no worktree, or more than one', () => {
  const worktrees = parseWorktrees(PORCELAIN);
  assert.throws(() => closePlan({ ticket: 1104, worktrees }), HibasBemenet);
  assert.throws(
    () =>
      closePlan({
        ticket: 1100,
        worktrees: [
          { path: '/a', branch: 'feature/PQW-1100-egy' },
          { path: '/b', branch: 'fix/PQW-1100-ketto' },
        ],
      }),
    HibasBemenet,
  );
});

test('a ticket number is not matched by a prefix of another', () => {
  const worktrees = [{ path: '/a', branch: 'feature/PQW-11000-hosszabb' }];
  assert.throws(() => closePlan({ ticket: 1100, worktrees }), HibasBemenet);
});

test('npm run munkafa is wired to the script, and the gate reads the port it writes', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.munkafa, 'node scripts/munkafa.mjs');
  assert.match(read('scripts/kapu.sh'), /\.env\.local/);
});

test('the symlink that broke the main checkout is nowhere in the command', () => {
  const source = read('scripts/munkafa.mjs');
  assert.ok(!/\bln -s|symlinkSync/.test(source), 'node_modules must never be shared through a link');
  assert.match(source, /cp', \['-c', '-R'/);
});

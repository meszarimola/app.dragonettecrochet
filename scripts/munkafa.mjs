/*
 * Worktrees, opened and closed by one command (PQW-1105).
 *
 *   npm run munkafa -- 1105 worktree-eszkoz          feature/PQW-1105-worktree-eszkoz
 *   npm run munkafa -- 1105 worktree-eszkoz --fix     fix/PQW-1105-worktree-eszkoz
 *   npm run munkafa -- --zar 1105                     remove the worktree and the branch
 *
 * WHY IT EXISTS
 *   Three things went wrong by hand, repeatedly, and all three are mechanical.
 *
 *   The install. Every worktree needs its own node_modules and must never share
 *   one through a symlink — that destroyed the main checkout once, see
 *   docs/kb/incidents.md §1. But `npm ci` is not the only honest way to get an
 *   independent tree: on APFS `cp -c` clones it copy-on-write in under a second,
 *   and the result is a real directory, not a link. `npm ci` stays as the
 *   fallback for anything that is not a same-volume APFS copy.
 *
 *   The port. Two worktrees serving a preview collide, and the browser run then
 *   measures the wrong build or gets killed — see docs/kb/incidents.md §3. The
 *   port is derived from the ticket number and written into the worktree's own
 *   .env.local, which `npm run kapu` reads.
 *
 *   The shared stash. It belongs to the repository, not to the worktree, so one
 *   worktree's `git stash pop` can take another's work. The command prints that
 *   rule where it will actually be read.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The port range for worktree previews. 5181 stays the main checkout's default. */
export const PORT_FIRST = 5182;
export const PORT_LAST = 5281;

const TICKET = /^\d+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class HibasBemenet extends Error {}

/** The directory name a worktree gets for a slug. */
export function worktreeDir(slug) {
  return `app-dc-${slug}`;
}

/** The branch name for a ticket, `fix/` only when the work is a bug fix. */
export function branchName({ ticket, slug, kind = 'feature' }) {
  return `${kind}/PQW-${ticket}-${slug}`;
}

/**
 * The first port at or after the ticket's own that nobody has claimed.
 * Deterministic for a ticket, and collision-free when two tickets land on one.
 */
export function portFor({ ticket, claimed = [] }) {
  const taken = new Set(claimed.map(Number));
  const start = PORT_FIRST + (Number(ticket) % (PORT_LAST - PORT_FIRST + 1));
  for (let offset = 0; offset <= PORT_LAST - PORT_FIRST; offset += 1) {
    const port = PORT_FIRST + ((start - PORT_FIRST + offset) % (PORT_LAST - PORT_FIRST + 1));
    if (!taken.has(port)) return port;
  }
  throw new HibasBemenet(`Nincs szabad port ${PORT_FIRST} és ${PORT_LAST} között.`);
}

/** Everything the open command needs, with the inputs checked first. */
export function plan({ ticket, slug, kind = 'feature', claimedPorts = [] }) {
  if (!TICKET.test(String(ticket ?? ''))) {
    throw new HibasBemenet(`A jegyszám csak számjegy lehet, ez nem az: "${ticket}"`);
  }
  if (!SLUG.test(String(slug ?? ''))) {
    throw new HibasBemenet(
      `A rövid név csak ASCII kisbetű, szám és kötőjel lehet (ékezet nélkül), ez nem az: "${slug}"`,
    );
  }
  if (kind !== 'feature' && kind !== 'fix') {
    throw new HibasBemenet(`Az ág fajtája csak feature vagy fix lehet, ez nem az: "${kind}"`);
  }
  return {
    branch: branchName({ ticket, slug, kind }),
    dir: worktreeDir(slug),
    port: portFor({ ticket, claimed: claimedPorts }),
  };
}

/** Which worktree and branch a ticket number closes, from `git worktree list --porcelain`. */
export function closePlan({ ticket, worktrees }) {
  if (!TICKET.test(String(ticket ?? ''))) {
    throw new HibasBemenet(`A jegyszám csak számjegy lehet, ez nem az: "${ticket}"`);
  }
  const needle = `PQW-${ticket}-`;
  const matches = worktrees.filter((worktree) => worktree.branch?.includes(needle));
  if (matches.length === 0) throw new HibasBemenet(`Nincs worktree a PQW-${ticket} jegyhez.`);
  if (matches.length > 1) {
    const names = matches.map((worktree) => worktree.branch).join(', ');
    throw new HibasBemenet(`Több worktree tartozik a PQW-${ticket} jegyhez: ${names}`);
  }
  return matches[0];
}

/** `git worktree list --porcelain` as objects, the main checkout included. */
export function parseWorktrees(porcelain) {
  const worktrees = [];
  for (const block of porcelain.trim().split(/\n\n+/)) {
    if (!block.trim()) continue;
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
    if (path) worktrees.push({ path, branch });
  }
  return worktrees;
}

/** The PORT a worktree has claimed in its own .env.local, if any. */
export function claimedPort(worktreePath) {
  const file = join(worktreePath, '.env.local');
  if (!existsSync(file)) return undefined;
  const port = /^PORT=(\d+)/m.exec(readFileSync(file, 'utf8'))?.[1];
  return port ? Number(port) : undefined;
}

const piros = (text) => `\u001b[31m${text}\u001b[0m`;
const zold = (text) => `\u001b[32m${text}\u001b[0m`;
const felkover = (text) => `\u001b[1m${text}\u001b[0m`;

/** With `stdio: 'inherit'` there is nothing to capture, so the output may be null. */
const git = (args, options = {}) => (execFileSync('git', args, { encoding: 'utf8', ...options }) ?? '').trim();

/**
 * An independent node_modules for the worktree. The copy-on-write clone is tried
 * first and costs about a second; `npm ci` is the fallback. Never a symlink.
 */
function installDeps(from, to) {
  if (existsSync(join(to, 'node_modules'))) return 'már megvolt';
  if (existsSync(join(from, 'node_modules'))) {
    try {
      execFileSync('cp', ['-c', '-R', join(from, 'node_modules'), join(to, 'node_modules')], {
        stdio: 'ignore',
      });
      return 'APFS-klón';
    } catch {
      // Not a same-volume APFS copy; fall through to the honest install.
    }
  }
  execFileSync('npm', ['ci'], { cwd: to, stdio: 'inherit' });
  return 'npm ci';
}

function openWorktree(args) {
  const kind = args.includes('--fix') ? 'fix' : 'feature';
  const [ticket, slug] = args.filter((arg) => !arg.startsWith('--'));

  const root = git(['rev-parse', '--show-toplevel']);
  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain']));
  const claimedPorts = worktrees.map((worktree) => claimedPort(worktree.path)).filter(Boolean);

  const { branch, dir, port } = plan({ ticket, slug, kind, claimedPorts });
  const target = resolve(dirname(root), dir);

  if (existsSync(target)) throw new HibasBemenet(`Már létezik: ${target}`);

  try {
    git(['fetch', '--quiet']);
  } catch {
    // Offline is fine: the branch then starts from the local develop.
  }
  git(['worktree', 'add', target, '-b', branch, 'develop'], { stdio: 'inherit' });

  const how = installDeps(root, target);
  writeFileSync(join(target, '.env.local'), `PORT=${port}\n`);

  console.log('');
  console.log(zold(`Kész: ${branch}`));
  console.log('');
  console.log(`  ${felkover('Könyvtár')}       ${target}`);
  console.log(`  ${felkover('node_modules')}   ${how}`);
  console.log(`  ${felkover('Port')}           ${port}  (.env.local, az npm run kapu ezt olvassa)`);
  console.log('');
  console.log(felkover('Két szabály ebben a worktree-ben:'));
  console.log('  • Nincs git stash. A stash a repóé, nem a worktree-é — ideiglenes WIP commitot csinálj.');
  console.log(`  • A port a tiéd, más worktree ne használja. Böngészős futás: npm run kapu`);
  console.log('');
  console.log(`Lezárás a merge után:  npm run munkafa -- --zar ${ticket}`);
}

function closeWorktree(args) {
  const [ticket] = args.filter((arg) => !arg.startsWith('--'));
  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain']));
  const { path, branch } = closePlan({ ticket, worktrees });

  const dirty = git(['status', '--short'], { cwd: path });
  if (dirty) {
    throw new HibasBemenet(
      `${path} nem tiszta, ezért nem bántom:\n${dirty}\n\nCommitold vagy dobd el, aztán futtasd újra.`,
    );
  }

  const merged = git(['branch', '--merged', 'develop', '--format=%(refname:short)']).split('\n').includes(branch);
  if (!merged) {
    throw new HibasBemenet(
      `${branch} még nincs benne a develop-ban. Előbb merge, aztán zárás — különben a munka elveszik.`,
    );
  }

  git(['worktree', 'remove', path], { stdio: 'inherit' });
  git(['branch', '-d', branch], { stdio: 'inherit' });
  console.log('');
  console.log(zold(`Lezárva: ${branch}`));
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Használat:');
    console.log('  npm run munkafa -- <jegyszám> <rövid-név> [--fix]');
    console.log('  npm run munkafa -- --zar <jegyszám>');
    return 2;
  }
  try {
    if (args.includes('--zar')) closeWorktree(args);
    else openWorktree(args);
    return 0;
  } catch (error) {
    if (error instanceof HibasBemenet) {
      console.error('');
      console.error(piros(error.message));
      return 1;
    }
    throw error;
  }
}

/** Only the CLI run executes; the tests import the planning functions. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}

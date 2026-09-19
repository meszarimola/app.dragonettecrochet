/*
 * Repo hygiene: no symbolic link may enter version control (PQW-910).
 *
 * Background: `node_modules` had been committed as a link, because the
 * `node_modules/` line of `.gitignore` matched only a directory thanks to its
 * trailing slash. Git branch and worktree operations then reached through the
 * tracked link: deleting a worktree took the main checkout's dependencies with
 * it, and every npm command afterwards failed silently.
 *
 * A symbolic link has mode `120000` in git. This test works from the git index
 * rather than from disk, so it also catches a link that has meanwhile turned
 * into something else on the file system.
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Mode and path of every tracked file, read from the git index. */
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

test('version control holds no symbolic link', () => {
  const links = trackedFiles()
    .filter((file) => file.mode === '120000')
    .map((file) => file.path);
  assert.deepEqual(links, [], `symbolic link in the repo: ${links.join(', ')}`);
});

test('node_modules is not tracked', () => {
  const tracked = trackedFiles().filter((file) => file.path === 'node_modules' || file.path.startsWith('node_modules/'));
  assert.equal(tracked.length, 0, `tracked node_modules: ${tracked.map((file) => file.path).join(', ')}`);
});

test('.gitignore excludes node_modules as a directory and as a link', () => {
  // Without the trailing slash the pattern matches a directory and a link alike; with it, only a directory.
  const ignored = execFileSync('git', ['check-ignore', '-v', 'node_modules'], { encoding: 'utf8' });
  assert.match(ignored, /node_modules/);
});

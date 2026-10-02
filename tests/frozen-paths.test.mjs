/*
 * The frozen-path guard (PQW-1107), exercised the way the harness calls it: a
 * JSON payload on stdin, exit 2 to refuse.
 *
 * Bash is the case worth testing. The matcher used to cover Edit and Write only,
 * so PQW-1100 edited frozen files through `python3 - <<PY` heredocs and the guard
 * never ran. Shell cannot be parsed exactly, so the guard is a net: a frozen path
 * has to appear and something has to look like a write. These tests pin both
 * directions — a read must pass, a write must not — because a guard that refuses
 * reads gets switched off.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../.claude/hooks/guard-frozen-paths.py', import.meta.url));
const CWD = '/Users/x/app-dc-valami';

function ask(toolInput) {
  const result = spawnSync('python3', [HOOK], {
    input: JSON.stringify({ cwd: CWD, tool_input: toolInput }),
    encoding: 'utf8',
  });
  return { refused: result.status === 2, reason: result.stderr.trim() };
}

const bash = (command) => ask({ command });
const edit = (file_path) => ask({ file_path });

test('an Edit of a frozen path is refused, of an ordinary one allowed', () => {
  assert.ok(edit('src/ui/i18n/messages.ts').refused);
  assert.ok(edit(`${CWD}/src/ui/i18n/core/shape.ts`).refused);
  assert.ok(edit('tests/fixtures/e2e-locators.json').refused);

  assert.ok(!edit('src/ui/main.ts').refused);
  assert.ok(!edit('src/core/layout.ts').refused);
  assert.ok(!edit('tests/ui-i18n.test.mjs').refused);
  assert.ok(!edit('e2e/nyelv.spec.ts').refused, 'E2E titles are developer text and must stay editable');
});

test('the refusal says which path and where the rule is', () => {
  const { reason } = edit('src/ui/i18n/messages.ts');
  assert.match(reason, /src\/ui\/i18n\/messages\.ts/);
  assert.match(reason, /frozen-paths\.md/);
});

test('reading a frozen path from the shell is allowed', () => {
  for (const command of [
    'cat src/ui/i18n/messages.ts',
    'sed -n "1,40p" src/ui/i18n/messages.ts',
    'grep -rn "key" src/ui/i18n/',
    'wc -l src/ui/i18n/*.ts',
    'ls -la tests/fixtures/',
    'git diff src/ui/i18n/messages.ts',
    'grep -c balls src/ui/i18n/messages.ts > /tmp/count.txt',
  ]) {
    assert.ok(!bash(command).refused, `a read was refused: ${command}`);
  }
});

test('writing to a frozen path from the shell is refused', () => {
  for (const command of [
    'echo x > src/ui/i18n/messages.ts',
    'echo x >>src/ui/i18n/messages.ts',
    'sed -i "" "s/a/b/" src/ui/i18n/messages.ts',
    'sed -i.bak "s/a/b/" tests/fixtures/e2e-locators.json',
    'cat new.ts > "src/ui/i18n/messages.ts"',
    'cp /tmp/new.json tests/fixtures/e2e-locators.json',
    'mv tests/fixtures/a.json tests/fixtures/b.json',
    'rm src/ui/i18n/core/shape.ts',
    'tee src/ui/i18n/messages.ts < /tmp/new',
  ]) {
    assert.ok(bash(command).refused, `a write was allowed: ${command}`);
  }
});

test('a heredoc script that writes a frozen path is refused', () => {
  const heredoc = [
    "python3 - <<'PY'",
    'from pathlib import Path',
    "Path('src/ui/i18n/messages.ts').write_text('x')",
    'PY',
  ].join('\n');
  assert.ok(bash(heredoc).refused);

  const nodeHeredoc = [
    "node - <<'JS'",
    "require('node:fs').writeFileSync('tests/fixtures/e2e-locators.json', '{}');",
    'JS',
  ].join('\n');
  assert.ok(bash(nodeHeredoc).refused);

  const reading = [
    "python3 - <<'PY'",
    'from pathlib import Path',
    "print(Path('src/ui/i18n/messages.ts').read_text())",
    'PY',
  ].join('\n');
  assert.ok(!bash(reading).refused, 'a heredoc that only reads must pass');
});

test('a write to an ordinary path is allowed even next to a frozen read', () => {
  assert.ok(!bash('grep -o "key" src/ui/i18n/messages.ts > src/ui/keys.txt').refused);
  assert.ok(!bash('echo x > src/ui/main.ts').refused);
});

test('a payload the hook does not understand is allowed through, not crashed on', () => {
  assert.ok(!ask({}).refused);
  const empty = spawnSync('python3', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(empty.status, 0);
});

test('the hook is wired for Bash as well as Edit and Write', () => {
  const settings = JSON.parse(
    spawnSync('cat', [fileURLToPath(new URL('../.claude/settings.json', import.meta.url))], {
      encoding: 'utf8',
    }).stdout,
  );
  const [guard] = settings.hooks.PreToolUse;
  for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Bash']) {
    assert.match(guard.matcher, new RegExp(`\\b${tool}\\b`), `the guard does not match ${tool}`);
  }
});

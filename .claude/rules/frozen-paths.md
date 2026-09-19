# Frozen paths

These hold **Hungarian user-facing product content**, not developer text. Never
translate them, never "tidy" their strings, and never include them in a language
migration.

| Path | What is frozen |
|---|---|
| `src/ui/i18n/**` | Every dictionary **value** — the interface text itself |
| `src/core/rules.ts` | The `message` and `reference` fields (see below) |
| `tests/fixtures/**` | Content **and filenames** — tests reference them by name, including under `en-US/` |
| `e2e/**` | Every locator argument and expected value — they are product strings |

## `rules.ts` has three text fields and they are not alike

| Field | Audience | Treatment |
|---|---|---|
| `summary` | "the editor and the tests" — developer | translate to English |
| `message` | the user, in the editor | **frozen**, Hungarian |
| `reference` | knowledge-base code, e.g. `06 §5.2` | **frozen**, format-locked |

`tests/core-validate.test.mjs` enforces both: `reference` must match
`/^0[1-6] §\d/`, and `message` must **not** contain `réteg`, `darab`, `§` or a
`0X ` code. Moving a knowledge-base citation into `message` fails the build.

## In E2E, position decides

Translate the **title** of `test()` / `describe()` and the **message argument**
of `expect(actual, message)`. Freeze everything inside `getByRole`, `getByText`,
`toHaveText`, `toContainText`, `locator`, `fill`, `selectOption`. `nyelv.spec.ts`
asserts **English** product strings — those are frozen too.

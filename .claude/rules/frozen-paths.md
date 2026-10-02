# Frozen paths

These hold **user-facing product content**, not developer text. Never "tidy" a
string, never reword a value to taste, and never translate one on your own
initiative.

**Only values are frozen.** Comments and developer text inside these files are
ordinary source and must be in English like everywhere else.

| Path | What is frozen |
|---|---|
| `src/ui/i18n/**` | Every dictionary **value**, in **both** branches — the interface text itself |
| `src/core/rules.ts` | The `message` and `reference` fields (see below) |
| `tests/fixtures/**` | Content **and filenames** — tests reference them by name, including under `en-US/` |
| `e2e/**` | Every locator argument and expected value — they are product strings |

**English is the default language** (PQW-1100), so the product strings an E2E
spec matches on are English unless the spec opens the app in Hungarian. The
Hungarian branch of the dictionaries is frozen exactly as the English one is;
neither is a draft of the other.

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

The **title** of `test()` / `describe()` and the **message argument** of
`expect(actual, message)` are developer text and are English. Everything inside
`getByRole`, `getByText`, `toHaveText`, `toContainText`, `locator`, `fill` and
`selectOption` is a product string and is frozen — in whichever language the
spec opened the app. `nyelv.spec.ts` is the bilingual sentinel: it asserts
product strings in both languages, and both are frozen.

## A deliberate language migration

The owner may ask for one by name; PQW-1100 was one. It is the only thing that
licenses editing the values above, and the commit needs `ALLOW_FROZEN=1`,
because `.githooks/pre-commit` refuses a staged frozen path otherwise. Say in
the commit message which ticket asked for it.

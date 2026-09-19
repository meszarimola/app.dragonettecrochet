# Comments

**Write a comment only where the code alone would mislead.** Not to restate what
the code says, not to document a type, not to narrate a decision. A reader who
trusts a comment over the code is the failure this policy prevents.

Decisions, rationale and history belong in `docs/kb/`; crochet domain knowledge
belongs in `docs/knowledge-base/`. Point at them:

```ts
// KB: 03 §10 C16
```

Never put in a comment:

- **An `import … from '…'` line.** `tests/core-boundary.test.mjs` greps the
  source with a regex that is **not comment-aware**, so a comment mentioning an
  import is parsed as a real one and fails the boundary test.
- **The last remaining occurrence of an i18n key.** `tests/ui-i18n.test.mjs`
  looks for `'key'` anywhere in the concatenated UI sources; if a comment is the
  only place a key still appears, deleting that comment makes the key "dead" and
  the test fails. Delete the key too, or keep it referenced in code.
- A version number, a line reference, or a claim about another file's behaviour.
  Cite a knowledge-base section instead — nothing keeps a comment honest.

**Keep the leading `*` on every block-comment continuation line.**
`tests/core-i18n.test.mjs` skips lines starting with `*`, `//` or `/*`; a
reflowed line without it is treated as code and scanned for Hungarian literals.

**Never rename a file listed in `CORE_EXCEPTIONS`** (`tests/core-i18n.test.mjs`)
— the exemption is keyed by filename and renaming silently removes it.

All comments are in **English**.

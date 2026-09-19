#!/usr/bin/env python3
"""Refuse edits to Hungarian user-facing product content.

e2e/ is deliberately absent: its test titles are developer text and must be
translated. Only the locator arguments inside them are frozen, which is a
positional rule a path guard cannot express.

These files are the product, not developer text. A language migration or a
well-meant tidy-up must never reach them. Editing one is a deliberate act that
needs an explicit request naming the file, so this hook makes the accident
impossible and leaves the deliberate case to the user's own approval.

KB: frozen paths are listed in .claude/rules/frozen-paths.md
"""
import json
import sys
from fnmatch import fnmatch

FROZEN = (
    "src/ui/i18n/*",
    "tests/fixtures/*",
)

def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    path = (payload.get("tool_input") or {}).get("file_path")
    if not path:
        return 0

    cwd = payload.get("cwd") or ""
    rel = path[len(cwd):].lstrip("/") if cwd and path.startswith(cwd) else path

    if not any(fnmatch(rel, pattern) for pattern in FROZEN):
        return 0

    print(
        f"Refused: {rel} is a frozen path — Hungarian user-facing product content.\n"
        "See .claude/rules/frozen-paths.md. If this edit really is intended, the "
        "user has to ask for it by naming the file.",
        file=sys.stderr,
    )
    return 2

if __name__ == "__main__":
    sys.exit(main())

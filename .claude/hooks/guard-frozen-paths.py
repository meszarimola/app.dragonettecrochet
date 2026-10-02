#!/usr/bin/env python3
"""Refuse edits to Hungarian user-facing product content.

e2e/ is deliberately absent: its test titles are developer text and must be
translated. Only the locator arguments inside them are frozen, which is a
positional rule a path guard cannot express.

These files are the product, not developer text. A language migration or a
well-meant tidy-up must never reach them. Editing one is a deliberate act that
needs an explicit request naming the file, so this hook makes the accident
impossible and leaves the deliberate case to the user's own approval.

Bash is covered as well as Edit and Write, because it was the hole: when PQW-1100
did its editing through `python3 - <<PY` heredocs instead of Edit, the matcher
never fired and only the commit hook caught the frozen paths. Shell cannot be
read exactly, so what follows is a net rather than a proof: a frozen path has to
appear AND something has to look like a write. Reads pass. The commit hook in
.githooks/pre-commit stays the backstop for whatever slips through.

KB: frozen paths are listed in .claude/rules/frozen-paths.md
"""
import json
import re
import sys
from fnmatch import fnmatch

FROZEN = (
    "src/ui/i18n/*",
    "tests/fixtures/*",
)

#: A path-looking token that runs through one of the frozen directories.
PATH_TOKEN = re.compile(r"[\w./*?\[\]-]*(?:src/ui/i18n|tests/fixtures)[\w./*?\[\]-]*")

#: Commands that write wherever they are pointed, whatever the argument order.
WRITING_COMMAND = re.compile(
    r"\bsed\s+(?:-[a-zA-Z]*\s+)*-i\b"
    r"|\bperl\s+-[a-zA-Z]*i\b"
    r"|\btee\b"
    r"|\b(?:cp|mv|rm|touch|install|ln|truncate|dd|rsync)\b"
)

#: Writing from inside a heredoc body, which is how an inline script edits a file.
WRITING_SCRIPT = re.compile(
    r"write_text|write_bytes|writeFileSync|writeFile\b|outputFile"
    r"|open\s*\([^)]*['\"][wax]"
    r"|\.dump\s*\(|>\s*open\s*\("
)


def frozen(path: str) -> bool:
    return any(fnmatch(path, pattern) for pattern in FROZEN)


def relative(path: str, cwd: str) -> str:
    return path[len(cwd):].lstrip("/") if cwd and path.startswith(cwd) else path


def written_frozen_paths(command: str, cwd: str) -> list[str]:
    """The frozen paths this shell command looks like it writes to."""
    candidates = [relative(token, cwd) for token in PATH_TOKEN.findall(command)]
    candidates = sorted({path for path in candidates if frozen(path)})
    if not candidates:
        return []

    # A redirection whose target is the path itself, with or without a space.
    redirected = [
        path
        for path in candidates
        if re.search(r">>?\s*['\"]?[\w./*?\[\]-]*" + re.escape(path), command)
    ]
    if redirected:
        return redirected

    if WRITING_COMMAND.search(command):
        return candidates

    if "<<" in command and WRITING_SCRIPT.search(command):
        return candidates

    return []


def refuse(paths: list[str]) -> int:
    listed = "\n  ".join(paths)
    print(
        f"Refused: a frozen path — Hungarian user-facing product content.\n  {listed}\n"
        "See .claude/rules/frozen-paths.md. If this edit really is intended, the "
        "user has to ask for it by naming the file.",
        file=sys.stderr,
    )
    return 2


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or ""

    path = tool_input.get("file_path")
    if path:
        rel = relative(path, cwd)
        return refuse([rel]) if frozen(rel) else 0

    command = tool_input.get("command")
    if command:
        written = written_frozen_paths(command, cwd)
        return refuse(written) if written else 0

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Split unified PR diffs into bounded, coverage-preserving release-classification batches."""
from __future__ import annotations
import json
import sys
from pathlib import Path
DEFAULT_MAX_BYTES = 12_000

def _split_file_section(section: str, max_bytes: int) -> list[str]:
    size = len(section.encode("utf-8"))
    if size <= max_bytes:
        return [section]
    lines = section.splitlines(keepends=True)
    hunk_starts = [i for i, line in enumerate(lines) if line.startswith("@@ ")]
    if not hunk_starts:
        header = lines[0].strip() if lines else "unknown file"
        raise ValueError(f"oversized file has no independently splittable hunks: {header}")
    prefix = "".join(lines[:hunk_starts[0]])
    pieces = []
    for position, start in enumerate(hunk_starts):
        end = hunk_starts[position + 1] if position + 1 < len(hunk_starts) else len(lines)
        piece = prefix + "".join(lines[start:end])
        piece_size = len(piece.encode("utf-8"))
        if piece_size > max_bytes:
            header = lines[0].strip() if lines else "unknown file"
            raise ValueError(f"single hunk exceeds {max_bytes} bytes ({piece_size} bytes): {header}")
        pieces.append(piece)
    return pieces

def split_diff(diff: str, max_bytes: int = DEFAULT_MAX_BYTES) -> list[dict]:
    if max_bytes < 1:
        raise ValueError("max_bytes must be positive")
    if not diff.strip():
        raise ValueError("diff is empty")
    sections, current = [], []
    for line in diff.splitlines(keepends=True):
        if line.startswith("diff --git "):
            if current:
                sections.append("".join(current))
            current = [line]
        elif current:
            current.append(line)
        elif line.strip():
            raise ValueError("unexpected content before first diff section")
    if current:
        sections.append("".join(current))
    if not sections:
        raise ValueError("no diff sections found")
    atomic_sections = []
    for section in sections:
        atomic_sections.extend(_split_file_section(section, max_bytes))
    batches, batch_sections, batch_bytes = [], [], 0
    for section in atomic_sections:
        size = len(section.encode("utf-8"))
        if batch_sections and batch_bytes + size > max_bytes:
            batches.append(batch_sections)
            batch_sections, batch_bytes = [], 0
        batch_sections.append(section)
        batch_bytes += size
    if batch_sections:
        batches.append(batch_sections)
    output = []
    for index, sections_in_batch in enumerate(batches, start=1):
        text = "".join(sections_in_batch)
        paths = []
        for section in sections_in_batch:
            path = next((line[6:].strip() for line in section.splitlines() if line.startswith("+++ b/")), None)
            if path is None:
                path = next((line[6:].strip() for line in section.splitlines() if line.startswith("--- a/")), "unknown")
            paths.append(path)
        output.append({"index": index, "count": len(batches), "files": paths, "diff": text, "bytes": len(text.encode("utf-8"))})
    return output

def main() -> int:
    try:
        diff_path = Path(sys.argv[1])
        max_bytes = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_MAX_BYTES
        print(json.dumps(split_diff(diff_path.read_text(encoding="utf-8"), max_bytes)))
        return 0
    except (OSError, ValueError) as exc:
        print(f"split-release-diff: {exc}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())

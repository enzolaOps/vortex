#!/usr/bin/env python3
"""Prepare a PR diff for release classification: keep implementation, summarize noise."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TEST_PATH = re.compile(
    r"(^|/)(__tests__|tests?|testdata|testes|__mocks__)/|"
    r"(^|/)[^/]+([._-](test|spec))[.][^/]+$|"
    r"(^|/)[^/]+_test[.][^/]+$",
    re.IGNORECASE,
)
DOC_PATH = re.compile(
    r"(^|/)(docs?|documentation|examples?|guides?)/|"
    r"(^|/)(readme|contributing|changelog|changes|authors|license)([.]|$)|"
    r"[.](md|mdx|rst|adoc|txt)$",
    re.IGNORECASE,
)
LOCKFILE = re.compile(
    r"(^|/)(package-lock[.]json|npm-shrinkwrap[.]json|pnpm-lock[.]yaml|"
    r"yarn[.]lock|bun[.]lockb?|Cargo[.]lock|go[.]sum|Gemfile[.]lock|"
    r"poetry[.]lock|Pipfile[.]lock|composer[.]lock|uv[.]lock|"
    r"Podfile[.]lock|pubspec[.]lock)$",
    re.IGNORECASE,
)
RELEASE_AUTOMATION = (".github/workflows/", "scripts/ci/", ".jev/")


def category(path: str) -> str:
    if path.startswith(RELEASE_AUTOMATION):
        return "release-automation"
    if TEST_PATH.search(path):
        return "tests"
    if LOCKFILE.search(path):
        return "dependency-lockfile"
    if DOC_PATH.search(path):
        return "documentation"
    return "implementation"


def split_sections(diff: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current: list[str] = []
    for line in diff.splitlines(keepends=True):
        if line.startswith("diff --git "):
            if current:
                section = "".join(current)
                match = re.search(r"^\+\+\+ b/(.+)$", section, re.MULTILINE)
                if not match:
                    match = re.search(r"^--- a/(.+)$", section, re.MULTILINE)
                if not match:
                    raise ValueError("diff section has no recognizable file path")
                sections.append((match.group(1), section))
            current = [line]
        elif current:
            current.append(line)
        elif line.strip():
            raise ValueError("unexpected content before first diff section")
    if current:
        section = "".join(current)
        match = re.search(r"^\+\+\+ b/(.+)$", section, re.MULTILINE)
        if not match:
            match = re.search(r"^--- a/(.+)$", section, re.MULTILINE)
        if not match:
            raise ValueError("diff section has no recognizable file path")
        sections.append((match.group(1), section))
    if not sections:
        raise ValueError("diff is empty or contains no file sections")
    return sections


def dependency_impact(text: str) -> tuple[str, str]:
    text = re.sub(r"[^a-z0-9]+", " ", text.lower())
    if re.search(r"\b(breaking change|breaking changes|not backward compatible|incompatible api)\b", text):
        return "major", "Upstream release notes explicitly indicate a breaking change."
    if re.search(r"\b(new feature|new capability|adds support for|introduces support for)\b", text):
        return "minor", "Upstream release notes explicitly indicate an additive capability."
    if re.search(
        r"\b(fix(es|ed|ing)?|bug fix|correctness|security fix|vulnerability|"
        r"improv(e|es|ed|ement)|performance|rendering|styling|theme overrides?|"
        r"preserv\w* existing styles|reliability|regression)\b",
        text,
    ):
        return "patch", "Upstream release notes describe a user-facing fix or improvement."
    if re.search(r"\b(lint|formatting|format only|build tooling|build tool|"
                 r"developer tooling|internal tooling)\b", text) and not re.search(
        r"\b(bug fix|security|vulnerability|rendering|styling|performance|correctness)\b", text
    ):
        return "none", "Upstream notes describe tooling-only maintenance without a user-facing effect."
    return "review", "Dependency-only change lacks sufficient release-note evidence for a safe impact decision."


def prepare(diff: str, title: str, body: str) -> dict:
    sections = split_sections(diff)
    classified = [(path, section, category(path)) for path, section in sections]
    counts: dict[str, int] = {}
    for _, _, kind in classified:
        counts[kind] = counts.get(kind, 0) + 1

    kinds = set(counts)
    paths_by_kind = {
        kind: [path for path, _, item_kind in classified if item_kind == kind]
        for kind in sorted(kinds)
    }

    non_implementation = {"release-automation", "tests", "documentation", "dependency-lockfile"}
    if kinds <= non_implementation:
        if "dependency-lockfile" in kinds:
            impact, reason = dependency_impact(title + "\n" + body)
            return result(impact, reason, counts, paths_by_kind)
        if kinds <= {"release-automation"}:
            reason = "Changes are confined to release/CI automation."
        elif kinds <= {"tests"}:
            reason = "Changes are confined to tests, fixtures, or test helpers."
        elif kinds <= {"documentation"}:
            reason = "Changes are confined to documentation; no implementation behavior changed."
        else:
            reason = "Changes are confined to tests, documentation, and release automation."
        return result("none", reason, counts, paths_by_kind)

    # Only implementation-bearing sections reach Jev. The metadata summary keeps
    # the excluded categories visible so mixed PRs are not misrepresented.
    included = [(path, section) for path, section, kind in classified
                if kind not in {"tests", "documentation", "dependency-lockfile", "release-automation"}]
    if not included:
        return result("review", "No implementation diff remains after filtering mixed categories.", counts, paths_by_kind)

    dependency_floor = "none"
    dependency_reason = ""
    if "dependency-lockfile" in kinds:
        dependency_floor, dependency_reason = dependency_impact(title + "\n" + body)
        if dependency_floor == "review":
            dependency_reason = "Dependency update also needs review: " + dependency_reason

    summary_lines = ["Pre-analysis summary (deterministic path classification):"]
    for kind, paths in paths_by_kind.items():
        summary_lines.append(f"- {kind}: {len(paths)} file(s): " + ", ".join(paths[:12]))
    if len(paths_by_kind.get("documentation", [])) or len(paths_by_kind.get("tests", [])):
        summary_lines.append("Documentation/test diffs were excluded from semantic classification; they do not override implementation impact.")
    if "dependency-lockfile" in kinds:
        summary_lines.append(f"Dependency release-note assessment: {dependency_floor}. {dependency_reason}")
        summary_lines.append("Consider this evidence when deciding the overall PR impact, but analyze implementation behavior only from the supplied diff.")
    return {
        "action": "jev",
        "policy_impact": dependency_floor if "dependency-lockfile" in kinds else "",
        "policy_reason": dependency_reason,
        "summary": "\n".join(summary_lines),
        "analysis_files": [path for path, _ in included],
        "analysis_diff": "".join(section for _, section in included),
        "counts": counts,
        "paths_by_category": paths_by_kind,
    }


def result(impact: str, reason: str, counts: dict, paths: dict) -> dict:
    return {
        "action": impact,
        "policy_impact": impact,
        "policy_reason": reason,
        "summary": reason,
        "analysis_files": [],
        "analysis_diff": "",
        "counts": counts,
        "paths_by_category": paths,
    }


def main() -> int:
    try:
        diff_path = Path(sys.argv[1])
        title = sys.argv[2] if len(sys.argv) > 2 else ""
        body = sys.argv[3] if len(sys.argv) > 3 else ""
        print(json.dumps(prepare(diff_path.read_text(encoding="utf-8"), title, body)))
        return 0
    except (OSError, ValueError) as exc:
        print(f"prepare-release-diff: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

import importlib.util
import json
import tempfile
import unittest
from unittest import mock
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("prepare-release-diff.py")
SPEC = importlib.util.spec_from_file_location("prepare_release_diff", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def section(path, body="@@ -1 +1 @@\n-old\n+new\n"):
    return f"diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n{body}"


class PrepareReleaseDiffTests(unittest.TestCase):
    def test_test_only_pr_is_deterministically_none(self):
        prepared = MODULE.prepare(section("src/foo.test.ts") + section("src/testes/helper.ts"), "test", "")
        self.assertEqual(prepared["action"], "none")
        self.assertEqual(prepared["analysis_diff"], "")

    def test_docs_only_pr_is_deterministically_none(self):
        prepared = MODULE.prepare(section("docs/api.md") + section("README.md"), "docs", "")
        self.assertEqual(prepared["action"], "none")

    def test_lockfile_dependency_with_user_facing_release_note_is_patch(self):
        diff = section("server/docs/pnpm-lock.yaml") + section("server/docs/package-lock.json")
        body = "Release notes: Apply formatting and lint compatibility changes. Order theme overrides by specificity while preserving existing styles."
        prepared = MODULE.prepare(diff, "chore(deps): update Scalar", body)
        self.assertEqual(prepared["action"], "patch")
        self.assertEqual(prepared["analysis_diff"], "")

    def test_reqwest_release_notes_starting_with_fix_are_patch(self):
        body = "Release notes: Fix hickory-dns to prefer IPv6. Fix sending wrong proxy-auth if multiple proxies intercept a given URL."
        prepared = MODULE.prepare(section("Cargo.lock"), "chore(deps): update reqwest to v0.13.5", body)
        self.assertEqual(prepared["action"], "patch")

    def test_livekit_release_notes_starting_with_fix_are_patch(self):
        body = "Patch Changes: Fix Document Picture-in-Picture detection. Fix unhandled RPC timeout rejections."
        prepared = MODULE.prepare(section("pnpm-lock.yaml"), "chore(deps): update livekit-client", body)
        self.assertEqual(prepared["action"], "patch")

    def test_tooling_only_dependency_update_is_none(self):
        diff = section("pnpm-lock.yaml")
        prepared = MODULE.prepare(diff, "chore(deps): update formatter", "Release notes: formatting and lint compatibility changes for the build tooling.")
        self.assertEqual(prepared["action"], "none")

    def test_linked_upstream_changelog_security_fix_is_patch(self):
        body = "Release notes: [solidjs/solid](https://redirect.github.com/solidjs/solid/compare/solid-js@1.9.15...v1.9.16)"
        changelog = "## 1.9.16\n\n### Patch Changes\n\n- Update dependencies; includes seroval security fixes (CVE-2026-104846).\n\n## 1.9.15\n\n- Previous release.\n"
        with mock.patch.object(MODULE, "linked_upstream_release_notes", return_value=changelog):
            prepared = MODULE.prepare(section("pnpm-lock.yaml"), "chore(deps): update dependency solid-js to v1.9.17", body)
        self.assertEqual(prepared["action"], "patch")
        self.assertIn("dependency-lockfile", prepared["paths_by_category"])

    def test_unclear_dependency_update_requires_review(self):
        prepared = MODULE.prepare(section("pnpm-lock.yaml"), "chore(deps): update library", "Automated dependency update.")
        self.assertEqual(prepared["action"], "review")

    def test_mixed_pr_sends_only_implementation_diff(self):
        diff = (
            section("src/feature.ts", "@@ -1 +1 @@\n-old implementation\n+new implementation\n")
            + section("src/feature.test.ts")
            + section("docs/feature.md")
            + section("pnpm-lock.yaml")
        )
        prepared = MODULE.prepare(diff, "feat: feature", "Dependency release notes: bug fix.")
        self.assertEqual(prepared["action"], "jev")
        self.assertEqual(prepared["analysis_files"], ["src/feature.ts"])
        self.assertIn("new implementation", prepared["analysis_diff"])
        self.assertNotIn("feature.test.ts", prepared["analysis_diff"])
        self.assertNotIn("pnpm-lock.yaml", prepared["analysis_diff"])
        self.assertEqual(prepared["policy_impact"], "patch")

    def test_config_and_generated_runtime_assets_are_not_dropped(self):
        diff = section("src/theme.generated.css")
        prepared = MODULE.prepare(diff, "fix: theme", "")
        self.assertEqual(prepared["action"], "jev")
        self.assertEqual(prepared["analysis_files"], ["src/theme.generated.css"])

    def test_malformed_diff_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "unexpected content"):
            MODULE.prepare("@@ -1 +1 @@\n-old\n+new\n", "title", "")


if __name__ == "__main__":
    unittest.main()

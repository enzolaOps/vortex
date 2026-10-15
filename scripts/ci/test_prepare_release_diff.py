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

    def test_dependency_only_pr_is_none_even_with_user_facing_upstream_notes(self):
        diff = section("server/docs/pnpm-lock.yaml") + section("server/docs/package-lock.json")
        body = "Release notes: Fix rendering bug and add a new feature."
        prepared = MODULE.prepare(diff, "chore(deps): update Scalar", body)
        self.assertEqual(prepared["action"], "none")
        self.assertEqual(prepared["analysis_diff"], "")

    def test_dependency_only_pr_with_fix_notes_is_none(self):
        body = "Release notes: Fix hickory-dns to prefer IPv6. Fix sending wrong proxy-auth if multiple proxies intercept a given URL."
        prepared = MODULE.prepare(section("Cargo.lock"), "chore(deps): update reqwest to v0.13.5", body)
        self.assertEqual(prepared["action"], "none")

    def test_dependency_only_pr_does_not_fetch_upstream_changelog(self):
        body = "Release notes: [solidjs/solid](https://redirect.github.com/solidjs/solid/compare/solid-js@1.9.15...v1.9.16)"
        with mock.patch.object(MODULE, "linked_upstream_release_notes", side_effect=AssertionError("should not fetch")):
            prepared = MODULE.prepare(section("pnpm-lock.yaml"), "chore(deps): update dependency solid-js to v1.9.17", body)
        self.assertEqual(prepared["action"], "none")

    def test_tooling_only_dependency_update_is_none(self):
        diff = section("pnpm-lock.yaml")
        prepared = MODULE.prepare(diff, "chore(deps): update formatter", "Release notes: formatting and lint compatibility changes for the build tooling.")
        self.assertEqual(prepared["action"], "none")

    def test_unclear_dependency_only_update_is_none_not_review(self):
        prepared = MODULE.prepare(section("pnpm-lock.yaml"), "chore(deps): update library", "Automated dependency update.")
        self.assertEqual(prepared["action"], "none")
        self.assertIn("dependency-lockfile", prepared["paths_by_category"])

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

    def test_binary_file_section_is_recognized(self):
        # Seção binária não tem `---`/`+++`; o #378 travou a release com um screenshot novo.
        png = "src/admin/__screenshots__/admin.browser.test.tsx/lista-1.png"
        diff = section("src/admin/Lista.tsx") + (
            f"diff --git a/{png} b/{png}\n"
            "new file mode 100644\n"
            "index 000000000..9d7c1ee23\n"
            f"Binary files /dev/null and b/{png} differ\n"
        )
        prepared = MODULE.prepare(diff, "feat: lista", "")
        self.assertEqual(prepared["action"], "jev")
        self.assertEqual(prepared["analysis_files"], ["src/admin/Lista.tsx"])

    def test_pure_rename_section_uses_new_path(self):
        diff = (
            "diff --git a/src/velho.ts b/src/novo.ts\n"
            "similarity index 100%\n"
            "rename from src/velho.ts\n"
            "rename to src/novo.ts\n"
        )
        self.assertEqual(MODULE.split_sections(diff)[0][0], "src/novo.ts")

    def test_malformed_diff_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "unexpected content"):
            MODULE.prepare("@@ -1 +1 @@\n-old\n+new\n", "title", "")


if __name__ == "__main__":
    unittest.main()

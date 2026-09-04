# Vendor references

This directory contains upstream source retained for implementation reference:

- `stoat-web/` mirrors `stoatchat/for-web` via the `upstream` remote.
- `stoat-desktop/` mirrors `stoatchat/for-desktop` via the `desktop-upstream` remote.

Neither tree is product source. Product CI must not build or publish them. The
desktop workflow is manual-only and uploads build artifacts without creating a
release.

Update the imported histories with rename detection so Git follows the moved
paths:

```bash
git fetch upstream
git merge -X find-renames=40% upstream/main

git fetch desktop-upstream
git merge -X find-renames=40% desktop-upstream/main
```

If an upstream merge recreates files at the repository root, abort it rather
than accepting a second copy. Submodule paths are owned by the root
`.gitmodules` file.

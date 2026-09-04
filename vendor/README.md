# Vendor references

This directory contains upstream source retained for implementation reference:

- `stoat-web/` mirrors `stoatchat/for-web` via the `upstream` remote.
- `stoat-desktop/` mirrors `stoatchat/for-desktop` via the `desktop-upstream` remote.

Neither tree is product source. Product CI must not build or publish them. The
desktop workflow is manual-only and uploads build artifacts without creating a
release.

Update with prefix-aware subtree pulls. A plain merge of upstream `main`
recreates files at the repository root.

```bash
git fetch upstream
git subtree pull --prefix=vendor/stoat-web upstream main

git fetch desktop-upstream
git subtree pull --prefix=vendor/stoat-desktop desktop-upstream main
```

If an update recreates files at the repository root, abort it rather than
accepting a second copy. Submodule paths are owned by the root `.gitmodules`
file.

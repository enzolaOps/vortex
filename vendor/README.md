# Vendor references

Upstream source kept for reading, not for building.

- `stoat-web/` mirrors `stoatchat/for-web` via the `upstream` remote.

This tree is not product source. Product CI must not build or publish it.

The Electron shell used to live here as `stoat-desktop/`. It is product now, at
`desktop/` in the repository root. Do not subtree-pull upstream desktop over
that directory: it would wipe the fork.

Update the web reference with a prefix-aware subtree pull. A plain merge of
upstream `main` recreates files at the repository root.

```bash
git fetch upstream
git subtree pull --prefix=vendor/stoat-web upstream main
```

If an update recreates files at the repository root, abort it rather than
accepting a second copy. Submodule paths are owned by the root `.gitmodules`
file.

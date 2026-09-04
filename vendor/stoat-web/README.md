# Vortex — web client

Solid.js client for the Vortex instance. A fork of
[stoatchat/for-web](https://github.com/stoatchat/for-web) at
`stoat-for-web-v0.14.1`, kept in upstream's layout so merges stay cheap. What is
changed, and why, is in [`../VORTEX.md`](../VORTEX.md).

Its own pnpm workspace (`nodeLinker: isolated`) — the Electron shell in
`../desktop/` has another one, and they are deliberately not joined. **Run every
command below from this directory.**

## Development

You'll want [Git](https://git-scm.com/install/) and
[mise-en-place](https://mise.jdx.dev/getting-started.html).

```bash
git clone --recurse-submodules https://github.com/enzolaOps/vortex
cd vortex/web

mise install:frozen      # packages
mise build:deps          # stoat.js, livekit, lingui

cp packages/client/.env.example packages/client/.env
mise dev
```

Then open http://localhost:5173.

The submodules are not optional: `git status` reads an empty submodule directory
as a deletion, and the build fails far from the cause. See "Submodules" in
`../VORTEX.md` if they go missing.

### Pointing at a backend

`packages/client/.env` decides. Unset, the client falls back to same-origin
`/api` — which is what the container does behind the Pi's reverse proxy. For
local work, point it at a local backend or at the instance.

Note that this fork is pinned to the pre-`VITE_HOST` configuration contract; see
"Upstream drift" in `../VORTEX.md` before rebasing onto upstream `main`.

## Build

```bash
mise build                # -> packages/client/dist
mise build:check          # types
mise lint
mise format
```

CI does not run these; the only workflow builds the container image
(`Dockerfile` here, published to GHCR by `.github/workflows/vortex-image.yml`).
Run them before pushing.

### Routes the host must serve

Single-page app, so everything falls through to `/`:

`/login` `/pwa` `/dev` `/discover` `/settings` `/invite` `/bot` `/friends`
`/server` `/channel` — see `packages/client/src/index.tsx`.

## Docs

`doc/` is upstream's mdbook on the client's architecture, still accurate for
this code. `mise mdbook` serves it. `GUIDELINES.md` is their code style, which
this fork follows.

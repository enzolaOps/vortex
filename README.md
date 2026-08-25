# Vortex

Self-hosted chat platform. Three deliverables in one repository:

| | |
|---|---|
| [`web/`](web/) | Solid.js client. Shipped as a container image to GHCR, served by the Pi. |
| [`desktop/`](desktop/) | Electron shell that loads the instance. Built by hand. |
| [`brand/`](brand/) | The mark, and the generator that renders every icon both of them use. |

Built on [Stoat](https://github.com/stoatchat): `web/` forks
`stoatchat/for-web`, `desktop/` forks `stoatchat/for-desktop`, and the backend
is upstream's, run unmodified from their images. Not affiliated with or endorsed
by the Stoat project.

**Read [`VORTEX.md`](VORTEX.md) first.** It covers what diverges from upstream,
which upstream commits to cherry-pick and which never to take, the AGPLv3
obligations, and the configuration contract the deployment depends on.

`web/` and `desktop/` are separate builds with separate lockfiles — the web
needs pnpm's `isolated` linker, the desktop's native dependencies need
`hoisted`. Run their commands from inside their own directory; each has its own
README.

Deployment lives in `pi-infra`, not here.

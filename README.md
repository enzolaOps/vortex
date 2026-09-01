# Vortex

Self-hosted chat platform. Five product areas in one repository:

| | |
| --- | --- |
| [`web/`](web/) | Upstream Solid.js client. Shipped as a container image to GHCR. |
| [`web-react/`](web-react/) | Vortex React client, under active development. |
| [`desktop/`](desktop/) | Electron shell that loads the instance. |
| [`server/`](server/) | Rust API and events services. Shipped as container images to GHCR. |
| [`brand/`](brand/) | Shared identity assets and icon generator. |

Built on [Stoat](https://github.com/stoatchat): `web/` forks
`stoatchat/for-web`, `desktop/` forks `stoatchat/for-desktop`, and `server/`
forks `stoatchat/stoatchat`. Not affiliated with or endorsed by the Stoat
project.

**Read [`VORTEX.md`](VORTEX.md) first.** It covers what diverges from upstream,
which upstream commits to cherry-pick and which never to take, the AGPLv3
obligations, and the configuration contract the deployment depends on.

`web/`, `web-react/`, `desktop/` and `server/` are independent builds with
their own toolchains. Run commands from inside the product directory; each has
its own manifest.

Deployment lives in `pi-infra`, not here.

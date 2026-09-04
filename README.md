# Vortex

Self-hosted chat platform with product source and upstream references in one repository:

| | |
| --- | --- |
| [`client/`](client/) | Vortex React client. Published as `ghcr.io/enzolaops/vortex-client`. |
| [`server/`](server/) | Rust backend. Delta and bonfire share `ghcr.io/enzolaops/vortex-server`. |
| [`brand/`](brand/) | Shared identity assets and icon generator. |
| [`vendor/`](vendor/) | Reference-only Stoat web and desktop source. Never built or published automatically. |

Built on [Stoat](https://github.com/stoatchat). The upstream web and desktop
trees are retained under `vendor/` for reference, while `server/` forks
`stoatchat/stoatchat`. Not affiliated with or endorsed by the Stoat project.

**Read [`VORTEX.md`](VORTEX.md) first.** It covers what diverges from upstream,
which upstream commits to cherry-pick and which never to take, the AGPLv3
obligations, and the configuration contract the deployment depends on.

`client/` and `server/` are independent product builds with their own toolchains.
Run commands from inside the product directory; each has its own manifest.

Deployment lives in `pi-infra`, not here.

Publish a GitHub Release tagged `vX.Y.Z` to build whatever changed since the
previous tag. Notes are generated from conventional commit subjects. Leave the
release body empty.

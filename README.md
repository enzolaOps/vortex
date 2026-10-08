# Vortex

Self-hosted chat platform with product source and upstream references in one repository:

| | |
| --- | --- |
| [`client/`](client/) | Vortex React client. Published as `ghcr.io/enzolaops/vortex-client`. |
| [`server/`](server/) | Rust backend. Delta and bonfire share `ghcr.io/enzolaops/vortex-server`. |
| [`desktop/`](desktop/) | Electron shell. Loads the client by URL. Packaged on each `v*` release. |
| [`brand/`](brand/) | Shared identity assets and icon generator. |
| [`vendor/`](vendor/) | Reference-only Stoat web source. Never built or published. |

Built on [Stoat](https://github.com/stoatchat). The upstream web tree is retained
under `vendor/` for reference. The desktop shell is product source in `desktop/`,
not a vendored mirror. `server/` forks `stoatchat/stoatchat`. Not affiliated with
or endorsed by the Stoat project.

**Read [`VORTEX.md`](VORTEX.md) first.** It covers what diverges from upstream,
which upstream commits to cherry-pick and which never to take, the AGPLv3
obligations, and the configuration contract the deployment depends on.

`client/`, `server/` and `desktop/` are independent product builds with their own
toolchains. Run commands from inside the product directory; each has its own manifest.
`vendor/` is not one of them.

Deployment lives in `pi-infra`, not here.

Publish a GitHub Release tagged `vX.Y.Z` to build whatever changed since the
previous tag. Notes are generated from conventional commit subjects. Leave the
release body empty.

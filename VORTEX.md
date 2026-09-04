# Vortex — fork notes

This repository is **Vortex**: a self-hosted chat product built on Stoat.
Everything else — the platform, the protocol, the actual work — is upstream's.

Three upstreams live here:

| Path | Upstream | Remote |
| --- | --- | --- |
| `vendor/stoat-web/` | [stoatchat/for-web](https://github.com/stoatchat/for-web) at `stoat-for-web-v0.14.1` | `upstream` |
| `vendor/stoat-desktop/` | [stoatchat/for-desktop](https://github.com/stoatchat/for-desktop) at `v1.5.3` | `desktop-upstream` |
| `server/` | [stoatchat/stoatchat](https://github.com/stoatchat/stoatchat) at `v0.15.3` plus the Vortex image commits | `server-upstream` |

The reference clients and `server/` were imported with upstream history. The
trees under `vendor/` are retained for reference and are never product CI inputs.

## Layout

```text
vortex/
├── client/     pnpm workspace, nodeLinker: isolated · Vortex product client
├── server/     Cargo workspace · ships one delta + bonfire runtime image
├── brand/      mark.svg + the generator used by the clients
├── vendor/     Stoat web and desktop reference source; not product builds
├── .github/    release-triggered image workflows
├── CLAUDE.md   architecture briefing — read before touching the front-end
└── VORTEX.md
```

Each product directory is an island: its own lockfile, toolchain and build.
The client consumes `brand/`. A GitHub Release tagged `vX.Y.Z` publishes only
the images that changed since the previous tag; notes come from conventional
commit subjects. Deployment stays in `pi-infra`. Push to `main` does not
publish.

`server/` preserves the history imported from `enzolaOps/vortex-api`. Its Vortex
changes are limited to a cross-architecture runtime containing `delta` (API)
and `bonfire` (events); the other backend services still use upstream images.

### Updating the server subtree

A fresh clone needs the backend remote once:

```bash
git remote add server-upstream https://github.com/stoatchat/stoatchat.git
```

Then update the imported source without recreating files at the repository root:

```bash
git fetch server-upstream
git subtree pull --prefix=server server-upstream main
```

Keep `.github/workflows/vortex-server-image.yml` at the repository root. Nested
workflows imported under `server/.github/` do not run and should be deleted after
an upstream update.

### Updating the vendor references

A fresh clone needs the remotes once:

```bash
git remote add upstream https://github.com/stoatchat/for-web.git
git remote add desktop-upstream https://github.com/stoatchat/for-desktop.git
```

Then pull with a prefix, the same way as `server/`. A plain merge of upstream
`main` recreates files at the repository root.

```bash
git fetch upstream
git subtree pull --prefix=vendor/stoat-web upstream main

git fetch desktop-upstream
git subtree pull --prefix=vendor/stoat-desktop desktop-upstream main
```

Base: tag `stoat-for-web-v0.14.1` (`0c31cf0`). That is the client version the
upstream self-hosted stack pairs with backend `v0.15.1`, which is what the
instance runs. **Do not rebase onto `main` without reading "Upstream drift"
below** — the environment variable contract changed after this tag.

## Why the rename exists at all

Upstream ships the software unbranded and keeps its brand assets in a private
submodule. Their FAQ is explicit: forks must not use Stoat branding or brand
assets, and must not appear associated with stoat.chat. So this fork is not
"Stoat with a different name painted on" — the branding was never included, and
supplying our own is the intended path.

AGPLv3 also applies. What it requires of a private repository is spelled out
under "Why this repository is private" below.

## What is changed

Kept deliberately small, so merging upstream stays cheap.

| Area | Change |
| --- | --- |
| `brand/` | Source artwork plus the two scripts below. New directory. |
| `vendor/stoat-web/` | Historical Solid implementation retained as reference only. |
| `.gitmodules` | Tracks the client SDK and the public vendor gitlinks. |
| `.github/workflows/vortex-client-image.yml` | Client image, on GitHub Release if `client/` changed. |
| `.github/workflows/vortex-server-image.yml` | Server runtime image, on GitHub Release if `server/` changed. |
| `.github/workflows/` | Every other upstream workflow deleted — see below. |
| `server/` | Backend source plus the Docker changes needed to publish one delta + bonfire runtime for amd64 and arm64. |
| `client/Dockerfile` | Builder stage pinned to `$BUILDPLATFORM` so it is not emulated. |
| `vendor/stoat-desktop/` | Historical Electron implementation retained as reference only. |

Most visible Stoat surfaces needed no change: upstream already hides the Lounge,
Discover and similar behind `CONFIGURATION.IS_STOAT`, which is false whenever the
API is not one of theirs.

## The desktop shell

`vendor/stoat-desktop/` is the Electron reference. It has **its own lockfile and its own
`pnpm-workspace.yaml`**, and is not part of the root pnpm workspace: the web
client needs `nodeLinker: isolated`, the desktop's native dependencies need
`hoisted`. It is not a product build.

It does not bundle the client — it loads the instance over HTTPS, from
`VORTEX_APP_URL` baked in at build time. There is deliberately no default: the
build fails without it rather than shipping a client pointed at somebody else's
server.

See `vendor/stoat-desktop/README.md` for its upstream build documentation.

The desktop workflow is manual-only and uploads reference artifacts without
publishing a release.

## Replacing the logo

Replace `brand/mark.svg`, keeping the 512×512 viewBox, then:

```bash
npm i -D sharp
node brand/generate.mjs
```

That regenerates every PNG and the `.ico` for the vendor reference trees.
`brand/monochrome.svg` and `brand/wordmark.svg` are copied as-is, so update
those by hand too.

`npm i -D sharp` leaves a `package.json` and a `package-lock.json` at the root.
Both are gitignored deliberately: nothing at the root belongs to one island,
and a root manifest carrying a single build-time tool is exactly the clutter
that rule exists to prevent. Leave them where they are — deleting them only
means recreating them the next time the mark changes.

`client/` does not consume the rasters. It serves `brand/mark.svg` straight
as its favicon through a small Vite plugin, so there is no fourth copy to keep
in sync.

Where each reference file lands is decided by `vendor/stoat-web/packages/client/scripts/copyAssets.mjs`: it
links its `assets/` into `public/assets` when that directory exists
and is non-empty, and otherwise falls back to `scripts/assets_fallback/`. This
fork has no `assets/` directory, so the fallback is the real path — which is why
the generator writes there.

## Renaming after an upstream merge

New or changed English strings arrive with "Stoat" in them. After merging:

```bash
node brand/rename-catalogs.mjs
```

It rewrites `msgstr` only, never `msgid`, and leaves domain names alone. This is
a manual vendor-maintenance utility, not product CI.

## Upstream drift

After `v0.14.1` the client changed how it is configured at runtime, and the
deployment depends on the old contract:

| | v0.14.1 (this fork) | `main` today |
| --- | --- | --- |
| API | `VITE_API_URL` | `VITE_API_URL` **plus required `VITE_HOST`** |
| WS / media / proxy | `VITE_WS_URL`, `VITE_MEDIA_URL`, `VITE_PROXY_URL` | `VITE_DEV_*`, dev-only; production reads them from the API |
| Video and screen share | gated by `VITE_CFG_ENABLE_VIDEO` | flag removed |

Rebasing onto `main` therefore requires updating `compose.vortex.yml` in
pi-infra at the same time: add `VITE_HOST`, drop the `VITE_*_URL` trio, drop
`VITE_CFG_ENABLE_VIDEO`. Doing one without the other leaves the client silently
falling back to upstream's production API.

## Why this repository is private, and what the licence still requires

The instance is for a small group, so the repository is private and so is the
published image. The Pi authenticates to GHCR to pull it.

AGPLv3 section 13 still applies: anyone who *uses* the instance over the network
is entitled to the corresponding source of the modified version. That obligation
runs to the users, not to the public — so a private repository is fine as long as
the people on the instance can actually get the source. Give them read access
here, or hand them an archive of this branch. Making the repo public also
satisfies it, and is the simpler option if the group ever grows.

## Build platform

Private repositories do not get the free native arm64 runners, and a full QEMU
build of this monorepo takes about an hour. So the Dockerfile pins its builder
stage to `$BUILDPLATFORM`:

```dockerfile
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder
```

That stage only emits static JS and CSS, which is the same on every
architecture. It runs natively on the amd64 runner; only the runtime stage,
whose sole dependency is the pure-JavaScript `sirv-cli`, is emulated. If the
repository becomes public, switch the workflow to `runs-on: ubuntu-24.04-arm`
and drop the QEMU step for a fully native build.

## Why the upstream workflows are gone

All upstream workflows were deleted. Product client and server images publish
from a `v*` GitHub Release, not from every push to `main`. A manual desktop
reference build remains. The removed upstream files were harmful:

- `renovate.yml` runs on a `0/15 * * * *` cron. Schedules are disabled in real
  forks, but this repository is standalone, so it would have fired roughly 2,900
  times a month and consumed the free Actions minutes on its own.
- `docker-build.yml` builds `ghcr.io/${{ github.repository }}` too, so it would
  publish a competing, unbranded image over the same tags — on `ubuntu-24.04-arm`,
  which a private repository pays for.
- `book`, `build-and-test`, `canary-release`, `production-release` and
  `release-please` all pull `immich-app/devtools/actions/use-mise`, which the
  Actions allow-list rejects, so every push produced a failed run.

`renovate.json` and `release-please-config.json` are kept: inert without their
workflows, and useful if the Renovate app is ever installed.

Merging upstream will try to restore these files. Delete them again — that is
the expected resolution, not a mistake.

## Actions allow-list

Settings → Actions → General must be "Allow enzolaOps, and select non-enzolaOps,
actions and reusable workflows", with **Allow actions created by GitHub** ticked
and this pattern:

```text
docker/*
```

That covers `actions/checkout` and the four `docker/*` actions, which is
everything the remaining workflow uses.

## Submodules

Four are required and all are public:

```text
vendor/stoat-web/packages/stoat.js                 stoatchat/javascript-client-sdk
vendor/stoat-web/packages/solid-livekit-components revoltchat/solid-livekit-components
vendor/stoat-web/packages/js-lingui-solid          revoltchat/js-lingui-solid
client/packages/stoat.js                           stoatchat/javascript-client-sdk
```

The SDK appears twice because the product client and vendor reference are
independent trees. Only `client/packages/stoat.js` is a product dependency.

Upstream has one more, `vendor/stoat-web/packages/client/assets`, pointing at a private brand
host. It is removed here on purpose. So is `vendor/stoat-desktop/assets`, which was the same
submodule again; it is a plain directory now, generated by `brand/generate.mjs`.

**Always clone with `--recurse-submodules`, and never run `git add -A` with the
submodule directories empty.** Git reads an empty directory as a deletion and
silently drops the gitlink from the index. The build then fails far from the
cause: `pnpm --filter` exits 0 when no project matches, so the missing packages
go unnoticed until `lingui.config.ts` cannot resolve
`@lingui-solid/babel-plugin-extract-messages/extractor` and reports
MODULE_NOT_FOUND. The workflow checks for this before building.

If they are ever lost again, the commits for this base are:

```bash
git update-index --add --cacheinfo 160000,a1aeb40396176249b1cb8dffc1a3529d1b5d40ff,vendor/stoat-web/packages/js-lingui-solid
git update-index --add --cacheinfo 160000,a67176da7f0580ea9fdad22e58a963668f047fca,vendor/stoat-web/packages/solid-livekit-components
git update-index --add --cacheinfo 160000,30b8505bc967d2de80bd170e861a2d062284c988,vendor/stoat-web/packages/stoat.js
git update-index --add --cacheinfo 160000,30b8505bc967d2de80bd170e861a2d062284c988,client/packages/stoat.js
```

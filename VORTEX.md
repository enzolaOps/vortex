# Vortex — fork notes

This is a fork of [stoatchat/for-web](https://github.com/stoatchat/for-web),
rebranded as **Vortex** for a self-hosted instance. Everything else — the
platform, the protocol, the actual work — is upstream's.

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

AGPLv3 also applies: this repository stays public so the modifications are
published, as the licence requires.

## What is changed

Kept deliberately small, so merging upstream stays cheap.

| Area | Change |
|---|---|
| `brand/` | Source artwork plus the two scripts below. New directory. |
| `packages/client/scripts/assets_fallback/web/` | Icons regenerated from `brand/mark.svg`. |
| `packages/client/index.html` | Tab title. |
| `packages/client/vite.config.ts` | PWA manifest name, short name, description. |
| `packages/client/src/serviceWorker.ts` | Fallback push-notification title. |
| `packages/client/components/common/lib/env.ts` | Last-resort API URL is same-origin `/api` instead of stoat.chat production. |
| `packages/client/src/index.tsx` | Removed the Android app nag, which advertises upstream's Google Play listing. |
| `packages/client/src/interface/Home.tsx` | Removed the upstream donation link; put the feedback entry behind `IS_STOAT`, which is how upstream already gates its own community surfaces. |
| `components/i18n/catalogs/*/messages.po` | `msgstr` renamed by script. |
| `.gitmodules` | Dropped the private `packages/client/assets` submodule. |
| `.github/workflows/vortex-image.yml` | Cross-builds arm64 and pushes to GHCR. |
| `.github/workflows/` | Every other upstream workflow deleted — see below. |
| `Dockerfile` | Builder stage pinned to `$BUILDPLATFORM` so it is not emulated. |

Most visible Stoat surfaces needed no change: upstream already hides the Lounge,
Discover and similar behind `CONFIGURATION.IS_STOAT`, which is false whenever the
API is not one of theirs.

## Replacing the logo

The current mark is a placeholder. Replace `brand/mark.svg`, keeping the
512×512 viewBox, then:

```bash
npm i -D sharp
node brand/generate.mjs
```

That regenerates every PNG and the `.ico`. `brand/monochrome.svg` and
`brand/wordmark.svg` are copied as-is, so update those by hand too.

Where each file lands is decided by `packages/client/scripts/copyAssets.mjs`: it
links `packages/client/assets/` into `public/assets` when that directory exists
and is non-empty, and otherwise falls back to `scripts/assets_fallback/`. This
fork has no `assets/` directory, so the fallback is the real path — which is why
the generator writes there.

## Renaming after an upstream merge

New or changed English strings arrive with "Stoat" in them. After merging:

```bash
node brand/rename-catalogs.mjs
```

It rewrites `msgstr` only, never `msgid`, and leaves domain names alone. CI runs
it with `--check` and fails if anything was missed.

## Upstream drift

After `v0.14.1` the client changed how it is configured at runtime, and the
deployment depends on the old contract:

| | v0.14.1 (this fork) | `main` today |
|---|---|---|
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

All of upstream's workflows were deleted; `vortex-image.yml` is the only one
left. They are their release plumbing, and in this repository they were actively
harmful:

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

Three are required and all are public:

```text
packages/stoat.js                 stoatchat/javascript-client-sdk
packages/solid-livekit-components revoltchat/solid-livekit-components
packages/js-lingui-solid          revoltchat/js-lingui-solid
```

Upstream has a fourth, `packages/client/assets`, pointing at a private brand
host. It is removed here on purpose.

**Always clone with `--recurse-submodules`, and never run `git add -A` with the
submodule directories empty.** Git reads an empty directory as a deletion and
silently drops the gitlink from the index. The build then fails far from the
cause: `pnpm --filter` exits 0 when no project matches, so the missing packages
go unnoticed until `lingui.config.ts` cannot resolve
`@lingui-solid/babel-plugin-extract-messages/extractor` and reports
MODULE_NOT_FOUND. The workflow checks for this before building.

If they are ever lost again, the commits for this base are:

```bash
git update-index --add --cacheinfo 160000,a1aeb40396176249b1cb8dffc1a3529d1b5d40ff,packages/js-lingui-solid
git update-index --add --cacheinfo 160000,a67176da7f0580ea9fdad22e58a963668f047fca,packages/solid-livekit-components
git update-index --add --cacheinfo 160000,30b8505bc967d2de80bd170e861a2d062284c988,packages/stoat.js
```

---
name: "release-process"
description: "Release pipeline knowledge covering the stable release flow (release.yml -> post-release.yml -> release-sync.yml), the manual pre-release/RC flow (prerelease.yml), branch-naming to version-bump mapping, and NPM/GHCR publishing. Use when cutting a release, verifying a completed release, or troubleshooting the release pipeline."
---

# Release Process Skill

## Overview

Lichtblick has two release tracks:

1. **Stable releases** — triggered automatically when a merged pull request into `main` comes from a `release/*` or `hotfix/*` branch. This runs `.github/workflows/release.yml`, which creates the GitHub Release and then fan-outs into post-release publishing and main→develop sync via GitHub's `release: released` event.
2. **Manual pre-release / RC builds** — triggered manually through `.github/workflows/prerelease.yml` (`workflow_dispatch` only). This builds the same production artifacts and, when `create_release: true`, creates a GitHub **Pre-release** through `ncipollo/release-action` with `prerelease: true`. Because GitHub's `release` event fires `prereleased` (not `released`) for pre-releases, this does **not** trigger `post-release.yml` or `release-sync.yml` — RC builds are never auto-published to NPM/GHCR or auto-synced to `develop`.

The stable and RC flows share the same artifact packaging shape, but only the stable flow performs the in-repo version bump, commit, and tag push to `main`.

## Branch Naming -> Version Bump Mapping

The version bump is computed by regex in the `bump_type` step of `.github/workflows/release.yml`.

| Branch prefix pattern | Bump type | Example |
|-----------------------|-----------|---------|
| `hotfix/*` | `patch` | `hotfix/fix-crash` |
| `release/major` or `release/major/*` | `major` | `release/major/v2.0.0` |
| `release/minor` or `release/minor/*` | `minor` | `release/minor/v1.5.0` |

Any other branch prefix causes the workflow to fail with an explicit error.

## Stable Release Pipeline (release.yml)

Trigger condition:

```yaml
on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  release:
    if: |
      github.event.pull_request.merged == true &&
      (startsWith(github.head_ref, 'release/') || startsWith(github.head_ref, 'hotfix/'))
```

Step order:

1. Check out the repository on `main`.
2. Set up Node.js 24 and enable Yarn via Corepack.
3. Install dependencies with `yarn install --immutable`.
4. Determine the bump type from the source branch name:
   - `hotfix/*` -> `patch`
   - `release/major(/.*)?` -> `major`
   - `release/minor(/.*)?` -> `minor`
   - anything else -> fail
5. Bump the root version with `yarn version <type>`.
6. Bump `packages/suite/package.json` with `yarn version <type>`.
7. Read the new version from the root `package.json`.
8. Update `sonar-project.properties` so `sonar.projectVersion` matches the new version.
9. Commit the version files and tag `main` as `v${version}`, then push `main` and tags.
10. Build the production desktop and web bundles:
    - `yarn desktop:build:prod`
    - `yarn web:build:prod`
11. Package release binaries for Windows, Linux, and macOS:
    - `yarn package:win`
    - `yarn package:linux`
    - `yarn package:darwin`
12. Create the web static tarball at `dist/lichtblick-web.tar.gz`.
13. Create the GitHub Release with `ncipollo/release-action@v1`.
14. Trigger `sonarqube.yml` on `main` via `gh workflow run`.

Release artifacts:

- `dist/lichtblick-${version}-linux-amd64.deb`
- `dist/lichtblick-${version}-linux-x64.tar.gz`
- `dist/lichtblick-${version}-linux-arm64.deb`
- `dist/lichtblick-${version}-linux-arm64.tar.gz`
- `dist/lichtblick-${version}-mac-universal.dmg`
- `dist/lichtblick-${version}-win.exe`
- `dist/lichtblick-web.tar.gz`
- `dist/latest-linux.yml`
- `dist/latest-mac.yml`
- `dist/latest.yml`

## Post-Release Publishing (post-release.yml)

Trigger:

- `release: types: [released]` — fires only for full (non-prerelease) GitHub Releases; pre-releases fire GitHub's separate `prereleased` event, which this workflow does not listen for.
- manual `workflow_dispatch` — requires an explicit `tag` input (for example `v1.28.1`). Both jobs use `github.event.inputs.tag || github.event.release.tag_name` for the checkout ref and Docker version tagging, so a manual run publishes the specified tag instead of depending on release-event context.

This workflow fans out into two parallel jobs:

### `npm`

> Yarn (per the `packageManager` field in `package.json`, currently 4.17.0) via Corepack remains this repo's dependency manager everywhere else; `npm publish` here is an intentional, pipeline-only exception used solely to publish the built package to the npm registry.

1. Check out the release tag (`github.event.release.tag_name`).
2. Set up Node.js 24 and point npm at `https://registry.npmjs.org`.
3. Enable Yarn and run `yarn install --immutable`.
4. Publish `./packages/suite` to npm with `npm publish ./packages/suite`.

### `docker`

1. Check out the same release tag.
2. Set up QEMU and Docker Buildx.
3. Log in to GHCR.
4. Strip the leading `v` from the release tag for the versioned container tag.
5. Build and push a multi-arch image for `linux/amd64,linux/arm64`.
6. Push both:
   - `ghcr.io/<repo>:latest`
   - `ghcr.io/<repo>:<version-without-v-prefix>`

## Release Sync (release-sync.yml)

Trigger:

- `release: types: [released]` — same caveat as `post-release.yml`: pre-releases fire `prereleased`, not `released`, so this workflow does not run for RC builds.
- manual `workflow_dispatch`

This workflow keeps `develop` descended from `main` after a release:

1. Check out `main` with full history.
2. Read the released version from `package.json`.
3. Create `sync/main-to-develop-{version}` from `origin/develop`.
4. Attempt `git merge origin/main --no-ff`.

Two paths follow:

- **Clean merge** — push the sync branch, open a PR into `develop`, and enable auto-merge with `gh pr merge --merge --auto`.
- **Conflicted merge** — commit the conflict markers, push the branch, and open a PR whose body warns that conflicts must be resolved manually.

In both cases, the workflow emphasizes the same rule: merge the sync PR with a **MERGE COMMIT** only — never squash or rebase — so `main` remains an ancestor of `develop`.

## Manual Pre-release / RC Flow (prerelease.yml)

This workflow is manual-only (`workflow_dispatch`).

| Input | Type / options | Default | Purpose |
|-------|----------------|---------|---------|
| `branch` | choice (fixed dropdown values): `develop`, `release/*` | `develop` | Branch to build the pre-release from |
| `version_type` | choice: `prerelease`, `prepatch`, `preminor`, `premajor` | `prerelease` | How to compute the next RC version |
| `create_release` | boolean | `true` | Whether to publish a GitHub Pre-release |
| `release_notes` | string | none | Optional custom release notes body |

> **Note:** `release/*` is a literal option string in the workflow's `choice` input, not a wildcard/glob pattern. Selecting it only works if a branch is literally named `release/*`; to build an RC from an actual release branch (e.g. `release/minor/v1.5.0`), that exact branch name would need to be added as its own choice option (or the input changed to a free-text `string` type).

Version computation logic:

1. Check out the selected branch with full history.
2. Find the latest RC tag matching `v*rc.*`.
3. Compute the next version:
   - If `version_type == "prerelease"`:
     - with no RC tag yet: `semver.inc(baseVersion, "prerelease", "rc")`
     - with an existing RC tag: `semver.inc(lastRcWithoutLeadingV, "prerelease", "rc")`
   - Otherwise:
     - derive a stable base version from `package.json`
     - run `semver.inc(stableBase, version_type, "rc")`
4. Use the computed version for artifact naming and release metadata.

Build and release steps:

1. Build production desktop and web bundles.
2. Package Windows, Linux, and macOS artifacts using `--config.extraMetadata.version=${version}`.
3. Create `dist/lichtblick-web.tar.gz`.
4. If `create_release == true`, create a GitHub Pre-release with `ncipollo/release-action@v1`, `prerelease: true`, and the same artifact list as the stable release flow.

> **Note:** This flow does not commit a version bump into git history. As covered above, GitHub fires `prereleased` (not `released`) for pre-releases, so `post-release.yml` and `release-sync.yml` do not run automatically after this workflow creates a GitHub Pre-release — NPM publishing, the GHCR image push, and the develop-sync PR only happen for stable releases.

## Workflow Trigger Reference

| Workflow file | Trigger | Jobs |
|---------------|---------|------|
| `.github/workflows/release.yml` | `pull_request` closed on `main`, gated to merged PRs whose head branch starts with `release/` or `hotfix/` | `release` |
| `.github/workflows/post-release.yml` | `release: released` (excludes pre-releases) or `workflow_dispatch` (requires `tag` input) | `npm`, `docker` |
| `.github/workflows/prerelease.yml` | `workflow_dispatch` | `prerelease` |
| `.github/workflows/release-sync.yml` | `release: released` (excludes pre-releases) or `workflow_dispatch` | `sync` |

## Key Files

- `.github/workflows/release.yml`
- `.github/workflows/post-release.yml`
- `.github/workflows/prerelease.yml`
- `.github/workflows/release-sync.yml`

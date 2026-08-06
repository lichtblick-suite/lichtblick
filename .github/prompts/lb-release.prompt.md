---
name: 'Release Lichtblick'
description: 'Guided runbook to cut a new Lichtblick release (major/minor/hotfix) or a manual pre-release/RC, and verify the automated build/publish pipeline afterward.'
---

Use this workflow when cutting a new stable release, a hotfix, or a manual RC/pre-release build.

## Skill Reference

Load `.github/skills/release-process/SKILL.md` for the full pipeline detail: trigger conditions, job steps, branch-to-bump mapping, and release artifact lists. Do not duplicate that workflow detail here.

## Inputs

Ask the user for the following before proceeding:

1. **Release type** — `major`, `minor`, `hotfix`, or `rc`
2. If `rc`:
   - **Branch to build from** — the workflow's `branch` input only offers two literal dropdown values, `develop` or the literal string `release/*` (not a wildcard — see the skill's note on this input)
   - **Version type** — `prerelease`, `prepatch`, `preminor`, or `premajor`
   - **Create GitHub Pre-release automatically** — `true` or `false`
   - **Custom release notes** (optional)

## Stable Release (major / minor / hotfix)

1. Check out `develop` and pull the latest changes.
2. Create a release branch per the branch-naming table in `.github/skills/release-process/SKILL.md`:
   - `release/major/<desc>`
   - `release/minor/<desc>`
   - `hotfix/<desc>`
3. Push the branch to the remote.
4. Open a pull request targeting `main`.
   - Reuse `.github/prompts/lb-open-pr.prompt.md` for PR title/body mechanics.
   - The target branch for this release PR is `main`, not `develop`.
5. Merge the PR once it is approved and ready.
6. After merge, no manual workflow dispatch is needed — `release.yml` and its downstream chain run automatically. See the "Overview" and "Workflow Trigger Reference" sections of `.github/skills/release-process/SKILL.md` for the full trigger chain.

## Manual Pre-release / RC

1. Ensure the chosen source branch is up to date.
2. Trigger `.github/workflows/prerelease.yml` with the desired inputs, for example:

```bash
gh workflow run prerelease.yml \
  -f branch=develop \
  -f version_type=prerelease \
  -f create_release=true
```

3. If custom notes are needed, add `-f release_notes="..."` to the command.

4. Watch or poll the run:
   - `gh run watch`
   - `gh run list --workflow=prerelease.yml`

## Post-Release Verification Checklist

### Stable release
- [ ] Confirm the `release.yml` run succeeded and the GitHub Release exists with all expected artifacts.
- [ ] Confirm `post-release.yml` succeeded (it fires automatically because stable releases emit GitHub's `released` event).
- [ ] Verify the published npm version at https://www.npmjs.com/package/@lichtblick/suite matches the release version.
- [ ] Verify the new GHCR image tag exists.
- [ ] Confirm `release-sync.yml` opened a `sync/main-to-develop-{version}` PR into `develop`.
- [ ] If the sync PR auto-merged after a clean merge, no further action is needed.
- [ ] If the sync PR has merge conflicts, resolve them manually and merge per the merge-commit rule in the skill's "Release Sync" section (never squash/rebase).

### Manual pre-release / RC
- [ ] Confirm the `prerelease.yml` run succeeded.
- [ ] If `create_release=true`, confirm the GitHub Pre-release was created with the expected artifacts.
- [ ] If `create_release=false`, no release or artifacts are published anywhere — the build output is discarded when the job ends.
- [ ] Do **not** expect `post-release.yml` or `release-sync.yml` to run: GitHub fires `prereleased` (not `released`) for pre-releases, and both workflows only trigger on `released`. No npm publish, no GHCR push, and no develop-sync PR happen for RCs.

## Output format

- Release type and computed version
- **Stable release:** GitHub Release URL, npm package URL, GHCR image tag, and release-sync PR status (auto-merged or needs manual conflict resolution)
- **RC / pre-release:** GitHub Pre-release URL (only if `create_release=true`) — npm package URL, GHCR image tag, and sync-PR status do not apply

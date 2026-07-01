---
name: 'Setup Worktree'
description: 'Create a Git worktree for parallel development following the Lichtblick naming convention and install dependencies.'
---

Use this workflow to set up a new worktree so you can work on a task in parallel without touching the current branch.

## Inputs

Ask the user for the following before proceeding:

1. **Task type** — `feature`, `bugfix`, or `hotfix` (determines branch prefix). Not required when setting up a worktree to review an existing PR.
2. **Branch short name** — e.g., `improve-plot-rendering` (without prefix)
3. **Base branch** — default `origin/develop`; ask if different
4. **PR number** (optional) — when creating a worktree to **review a pull request**, provide its number (e.g. `1170`). The worktree folder is named `pr-{id}` instead of `{short-name}`, and the PR's head branch is checked out from an existing branch.

## Branch Naming

Branch names are **CI-enforced**. Construct the full branch name as `{type}/{short-name}`, e.g. `feature/improve-plot-rendering`.

See [CONTRIBUTING.md — Branching Strategy](../../CONTRIBUTING.md#branching-strategy---git-flow) for the full rules.

## Detect contributor type

Check whether an `upstream` remote exists:

```bash
git remote -v
```

- If `upstream` is present → **fork contributor** (use `upstream/develop` as base, push to `origin`)
- If not → **internal team member** (use `origin/develop` as base)

For fork contributors, ensure `upstream` is up to date before branching:

```bash
git fetch upstream
```

## Create the worktree

Use the path convention `../{repository-name}.worktree/{short-name}/`. The `{short-name}` subfolder is intentional: it lets multiple worktrees (e.g. parallel SDD subagent tasks) live side by side under one parent folder.

When the worktree is for **reviewing a PR**, use `pr-{id}` as the folder name (e.g. `../lichtblick.worktree/pr-1170/`) so review worktrees are easy to identify and clean up.

```bash
git worktree add -b {type}/{short-name} \
  ../lichtblick.worktree/{short-name} \
  {base-branch}
```

> **Notes for parallel work:**
> - Git will not allow two worktrees to check out the **same** branch — each task needs a distinct branch.
> - Each worktree gets its **own full `node_modules`**, so expect significant disk usage per worktree.

To create a worktree from an **existing** branch instead (e.g. to resume work), omit `-b`:

```bash
git worktree add ../lichtblick.worktree/{short-name} {existing-branch}
```

To create a worktree for **reviewing a PR**, fetch the PR's head branch into a local `pr-{id}` ref first, then add a worktree that checks out that ref. Fetching before `git worktree add` guarantees the `pr-{id}` ref exists (unlike `gh pr checkout --detach`, which leaves HEAD detached in the current worktree without creating the ref):

```bash
git fetch origin pull/{id}/head:pr-{id}
git worktree add ../lichtblick.worktree/pr-{id} pr-{id}
```

## Install dependencies

```bash
cd ../lichtblick.worktree/{short-name}
yarn install
```

`yarn install` performs a full install in this worktree. Worktrees do **not** share `.yarn/cache` (it is gitignored, and `.yarnrc.yml` sets `enableGlobalCache: false`), and `nodeLinker: node-modules` means a real `node_modules` is created. Expect a complete install rather than a quick link step.

## Copy local config (if any)

Git worktrees only include git-tracked files. Untracked local state (e.g. a gitignored `.env`, local settings, caches) is **not** copied into the new worktree. If you rely on any such files, copy them manually:

```bash
# Only if you have a local .env or similar untracked config
cp .env ../lichtblick.worktree/{short-name}/.env
```

## Open in VS Code

```bash
code ../lichtblick.worktree/{short-name}
```

Or guide the user to **File → Open Folder** if they prefer the UI.

## Confirm

Report the result of `git worktree list` so the user can verify both worktrees are active.

## Teardown reminder

When the task is complete and the branch is merged, clean up with:

```bash
# From the main repo (not inside the worktree)
git worktree remove ../lichtblick.worktree/{short-name}
git worktree prune
```
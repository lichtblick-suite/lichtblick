---
name: 'Setup Worktree'
description: 'Create a Git worktree for parallel development following the Lichtblick naming convention and install dependencies.'
---

Use this workflow to set up a new worktree so you can work on a task in parallel without touching the current branch.

## Inputs

Ask the user for the following before proceeding:

1. **Task type** — `feature`, `bugfix`, or `hotfix` (determines branch prefix)
2. **Branch short name** — e.g., `improve-plot-rendering` (without prefix)
3. **Base branch** — default `origin/develop`; ask if different

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

Use the path convention `../{repository-name}-worktree/{short-name}/`:

```bash
git worktree add -b {type}/{short-name} \
  ../lichtblick-worktree/{short-name} \
  {base-branch}
```

## Install dependencies

```bash
cd ../lichtblick-worktree/{short-name}
yarn install
```

`yarn install` is fast because `.yarn/cache` is shared across worktrees — it only links packages.

## Open in VS Code

```bash
code ../lichtblick-worktree/{short-name}
```

Or guide the user to **File → Open Folder** if they prefer the UI.

## Confirm

Report the result of `git worktree list` so the user can verify both worktrees are active.

## Teardown reminder

When the task is complete and the branch is merged, clean up with:

```bash
# From the main repo (not inside the worktree)
git worktree remove ../lichtblick-worktree/{short-name}
git worktree prune
```

---
name: worktree-setup
description: "Sets up a Git worktree for the Lichtblick monorepo following the project naming convention, installs dependencies, and configures the workspace for parallel development. Use when starting a new task in parallel with the current branch."
---

# Worktree Setup

Git worktrees let you check out multiple branches of the same repository into separate directories simultaneously — no stashing, no branch switching, full parallel development.

---

## Naming Convention

| Purpose | Path |
|---|---|
| Single extra worktree | `../{repository-name}-worktree/` |
| Multiple parallel tasks | `../{repository-name}-worktree/{branch-name}/` |

**Examples for this repo (`lichtblick`):**

```
# One extra task
../lichtblick-worktree/

# Multiple tasks in parallel
../lichtblick-worktree/feature-ai-integration/
../lichtblick-worktree/fix-plot-rendering/
```

Always place worktrees **outside** the repository root (the `../` prefix) to prevent Git from treating them as untracked content.

---

## Branch Naming

Branch names in worktrees follow the same naming convention as any other branch — **CI enforces naming and will reject PRs with non-compliant names**.

See [CONTRIBUTING.md — Branching Strategy](../../../CONTRIBUTING.md#branching-strategy---git-flow) for the full table. Quick reference:

| Prefix | Purpose |
|---|---|
| `feature/` | New features or significant improvements |
| `bugfix/` | Non-critical bug fixes |
| `hotfix/` | Urgent critical fixes |

The worktree path uses the branch name without the prefix for readability, but the **Git branch itself must have the prefix**:

```bash
# ✅ Correct — branch has prefix, path is readable
git worktree add ../lichtblick-worktree/my-new-feature feature/my-new-feature

# ❌ Wrong — branch name missing prefix, CI will reject the PR
git worktree add ../lichtblick-worktree/my-new-feature my-new-feature
```

---

## Setup Steps

### 1. Create the worktree on an existing branch

```bash
git worktree add ../lichtblick-worktree/<branch-name> <branch-name>
```

### 2. Create the worktree and a new branch at the same time

```bash
git worktree add -b <new-branch-name> ../lichtblick-worktree/<new-branch-name> origin/develop
```

### 3. Install dependencies

```bash
cd ../lichtblick-worktree/<branch-name>
yarn install
```

Yarn's zero-install cache (`.yarn/cache`) is shared across all worktrees of the same repo, so `yarn install` is fast — it only links packages, it does not re-download.

### 4. Open in VS Code

```bash
code ../lichtblick-worktree/<branch-name>
```

Or open the folder via **File → Open Folder** to get a clean workspace for that branch.

---

## Full Example

```bash
# From the main lichtblick checkout directory
git worktree add -b feature/my-new-feature \
  ../lichtblick-worktree/my-new-feature \
  origin/develop

cd ../lichtblick-worktree/my-new-feature
yarn install

code .
```

---

## Teardown

When the branch is merged and the worktree is no longer needed:

```bash
# From the main repo (not inside the worktree)
git worktree remove ../lichtblick-worktree/<branch-name>

# If Git complains about untracked changes, force-remove
git worktree remove --force ../lichtblick-worktree/<branch-name>

# Then prune stale worktree metadata
git worktree prune
```

---

## Constraints

- You **cannot** check out the same branch in two worktrees simultaneously — each worktree needs its own branch.
- The `node_modules/` directory is **not** shared; each worktree has its own. Running `yarn install` is required per worktree.
- Husky hooks and VS Code workspace settings are read from each worktree's own `.git` config chain — behavior is identical to a normal checkout.
- If the worktree path is inside a parent folder tracked by another Git repo, add the path to that repo's `.gitignore`.

---

## Listing Active Worktrees

```bash
git worktree list
```

Output example:

```
/Users/you/main/main-workspace/lichtblick         abc1234 [feature/ai-integration/setup-sdd]
/Users/you/main/lichtblick-worktree/my-new-feature  def5678 [feature/my-new-feature]
```

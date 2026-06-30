---
name: 'SDD Feature Development'
description: 'Run Specify -> Plan -> Tasks -> Implement for a feature using a GitHub issue as the source of truth.'
---

Use this workflow when implementing a feature from a GitHub issue.

## Inputs

- GitHub issue number or URL (use `github` MCP server to read issue fields)
- Optional constraints (target files, non-goals, timeline)

## MCP servers available

| Server | Purpose |
|--------|--------|
| `github` | Read/create GitHub Issues and PRs (`github/get_issue`, `github/create_pull_request`) |
| `playwright` | Explore running web app for E2E test discovery (Chrome only; `@lb-e2e-test` agent) |

## Phase 1: Specify

1. Read the GitHub issue and extract:
   - Problem statement
   - Acceptance criteria
   - Definition of done
   - Explicit out-of-scope items
2. If criteria are ambiguous, ask clarifying questions before coding.
3. Produce a concise specification summary.

## Phase 2: Setup

Determine the contributor's git context to ensure correct branching and PR mechanics:

1. Run `git remote get-url origin` to detect whether the workspace is a **fork** or **direct clone**.
   - URL contains `lichtblick-suite/lichtblick` → **direct clone** (core team).
   - Otherwise → **fork** (community contributor).
2. Ensure the working branch follows the [branching strategy](../../CONTRIBUTING.md):
   - Features/bugfixes: `feature/` or `bugfix/` prefix, targeting `develop`.
   - Releases/hotfixes (core team only): `release/major/`, `release/minor/`, or `hotfix/` prefix, targeting `main`.
3. For fork contributors, ensure the branch is rebased on upstream `develop`:
   ```sh
   git fetch upstream && git rebase upstream/develop
   ```
4. **Optional — parallel work:** If this task runs alongside other independent SDD tasks, set it up in a dedicated git worktree first (see [setup-worktree.prompt.md](./setup-worktree.prompt.md)) and run the rest of this workflow inside that worktree. This keeps each task on its own branch and checkout.

This context is carried forward to Phase 5 (PR creation via `open-pr.prompt.md`).

## Phase 3: Plan

1. Analyze impacted areas in the codebase.
2. Propose implementation steps and testing strategy.
3. Identify risks and rollback strategy.
4. Suggest specialist delegation through `@lb-orchestrator` when needed.

Human checkpoint:
- Wait for approval of the plan before editing files.

## Phase 4: Tasks

1. Convert the plan into ordered, verifiable tasks.
2. For each task, include:
   - Files to modify
   - Expected behavior change
   - Required tests

## Phase 5: Implement

1. Execute tasks in order with minimal, focused changes.
2. Run targeted tests first, then broader validation.
3. Confirm each acceptance criterion is satisfied.

## Output format

- Specification summary
- Implementation plan
- Task checklist
- Change summary
- Validation results (tests/lint/type-check)
- Acceptance criteria coverage matrix

---
name: 'SDD Upstream Sync'
description: 'Evaluate and execute an upstream sync through Specify -> Plan -> Tasks -> Implement with explicit risk controls.'
---

Use this workflow when synchronizing a downstream fork with upstream changes.

## Inputs

- Upstream base and target refs (tag/branch/commit)
- Local target branch
- Optional scope constraints (paths/subsystems)

## Phase 1: Specify

1. Compute the upstream change set.
2. Summarize:
   - New features
   - Bug fixes
   - Breaking changes
   - Dependency updates
3. Identify local customizations likely to conflict.

## Phase 2: Plan

1. Choose sync strategy:
   - Merge
   - Rebase
   - Cherry-pick subset
2. Produce impact analysis:
   - API compatibility
   - Build/test impact
   - Extension/contribution-point impact
3. Define risk matrix and rollback plan.

Human checkpoint:
- Wait for approval of sync strategy before applying changes.

## Phase 3: Tasks

Create an ordered task list for:
1. Conflict resolution
2. Adaptation of local customizations
3. Test updates
4. Documentation updates

## Phase 4: Implement and verify

1. Execute approved sync strategy.
2. Resolve conflicts with explicit rationale.
3. Run full validation suite.
4. Summarize accepted, adapted, and deferred upstream changes.

## Output format

- Sync scope summary
- Chosen strategy + rationale
- Risk and compatibility report
- Conflict resolution log
- Validation results
- Follow-up tasks

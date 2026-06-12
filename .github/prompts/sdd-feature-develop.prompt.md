---
name: 'SDD Feature Development'
description: 'Run Specify -> Plan -> Tasks -> Implement for a feature using a GitHub issue as the source of truth.'
---

Use this workflow when implementing a feature from a GitHub issue.

## Inputs

- GitHub issue number or URL
- Optional constraints (target files, non-goals, timeline)

## Phase 1: Specify

1. Read the GitHub issue and extract:
   - Problem statement
   - Acceptance criteria
   - Definition of done
   - Explicit out-of-scope items
2. If criteria are ambiguous, ask clarifying questions before coding.
3. Produce a concise specification summary.

## Phase 2: Plan

1. Analyze impacted areas in the codebase.
2. Propose implementation steps and testing strategy.
3. Identify risks and rollback strategy.
4. Suggest specialist delegation through `@lb-orchestrator` when needed.

Human checkpoint:
- Wait for approval of the plan before editing files.

## Phase 3: Tasks

1. Convert the plan into ordered, verifiable tasks.
2. For each task, include:
   - Files to modify
   - Expected behavior change
   - Required tests

## Phase 4: Implement

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

---
name: 'SDD Bug Fix'
description: 'Run a structured bug-fix workflow: Reproduce -> Diagnose -> Plan -> Implement -> Verify.'
---

Use this workflow for bug reports and regressions.

## Inputs

- Bug report (issue number/URL)
- Environment details (platform, data source, version)
- Reproduction steps

## Phase 1: Specify the bug

1. Define current behavior and expected behavior.
2. Reproduce the issue with minimal steps.
3. Document scope:
   - Affected components
   - User impact
   - Severity

## Phase 2: Diagnose

1. Identify likely root cause.
2. Confirm root cause with code evidence or instrumentation.
3. Identify related code paths and potential side effects.

## Phase 3: Plan

1. Propose the smallest safe fix.
2. Define regression tests:
   - Unit tests via `@lb-unit-test`
   - E2E tests via `@lb-e2e-test` when behavior is integration-level
3. Define validation commands.

Human checkpoint:
- Wait for approval of diagnosis and fix strategy before editing files.

## Phase 4: Implement and verify

1. Implement the fix.
2. Add or update regression tests.
3. Run validation and report outcomes.

## Output format

- Reproduction status
- Root cause statement
- Planned fix
- Test changes
- Validation results
- Residual risks

---
name: 'Review Pull Request'
description: 'Run a structured review pass focused on code quality, behavior regressions, performance, security, and test adequacy.'
---

Use this workflow to review a pull request before merge.

## Inputs

- PR number or URL
- Optional focus areas

## Review dimensions

1. Correctness and regressions
2. API and behavior compatibility
3. Performance risks
4. Security risks
5. Test coverage gaps
6. Documentation and migration notes

## Workflow

1. Read PR summary and diff.
2. Classify findings by severity:
   - Critical
   - High
   - Medium
   - Low
3. For each finding, provide:
   - File/location
   - Problem
   - Suggested fix
4. If no findings, state residual risks and testing gaps.

## Output format

- Findings list ordered by severity
- Open questions/assumptions
- Merge readiness recommendation

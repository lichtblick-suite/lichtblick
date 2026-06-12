---
name: 'Open Pull Request'
description: 'Prepare and open a pull request with complete scope, testing evidence, and risk notes.'
---

Use this workflow when changes are ready for review.

## Inputs

- Source branch
- Target branch
- Related issue(s)

## Workflow

1. Summarize implemented scope and non-goals.
2. Generate PR title and description from actual changes.
3. Include:
   - Problem statement
   - Implementation summary
   - Testing performed
   - Risk and rollback notes
4. Ensure linked issue references are present.
5. Confirm pre-submit checks are green (lint, type-check, tests).

## Output format

- Proposed PR title
- PR description body
- Validation checklist
- Reviewer focus areas

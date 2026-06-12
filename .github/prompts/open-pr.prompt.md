---
name: 'Open Pull Request'
description: 'Prepare and open a pull request with complete scope, testing evidence, and risk notes. Uses the GitHub MCP server for PR creation.'
---

Use this workflow when changes are ready for review.

## Inputs

- Source branch
- Target branch (default: `develop`)
- Related issue number(s)

## GitHub MCP server

Use the `github` MCP server to:
- Read the linked issue (`github/get_issue`) to verify acceptance criteria coverage.
- Create the PR (`github/create_pull_request`) with the generated title and body.
- Confirm the PR URL and link it back in the issue comments.

## Workflow

1. Summarize implemented scope and non-goals.
2. Generate PR title and description from actual changes.
3. Include:
   - Problem statement
   - Implementation summary
   - Testing performed
   - Acceptance criteria coverage (cross-check against linked issue)
   - Risk and rollback notes
4. Ensure linked issue references are present in the PR body (`Closes #<number>`).
5. Confirm pre-submit checks are green (lint, type-check, tests).
6. Open as **draft** if any acceptance criterion is still unverified.

## CodeRabbit

Once the PR is opened as non-draft targeting `develop` or `main`, CodeRabbit will auto-review it.
- Do not request human review before CodeRabbit has posted its summary.
- Address CodeRabbit's Critical and High findings before requesting human review.

## Output format

- Proposed PR title
- PR description body
- Validation checklist
- Reviewer focus areas

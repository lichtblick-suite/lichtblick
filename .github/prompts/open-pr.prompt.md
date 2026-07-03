---
name: 'Open Pull Request'
description: 'Prepare and open a pull request with complete scope, testing evidence, and risk notes. Uses the GitHub MCP server for PR creation.'
---

Use this workflow when changes are ready for review.

## Inputs

- Source branch
- Target branch (default: `develop`)
- Related issue number(s)

## Detect contributor type

Before creating the PR, determine whether the contributor is working from a **fork** or a **direct branch**:

1. Run `git remote get-url origin` to obtain the push URL.
2. If the URL contains `lichtblick-suite/lichtblick` → **direct branch** (core team).
3. Otherwise → **fork** (community contributor).

This distinction controls the `head` parameter when calling `github/create_pull_request`:

| Contributor type | `head` value | Example |
|------------------|--------------|---------|
| Core team | `<branch>` | `feature/my-feature` |
| Community (fork) | `<fork-owner>:<branch>` | `octocat:feature/my-feature` |

To resolve the fork owner, parse the `origin` remote URL (e.g., `github.com/<owner>/lichtblick`).

## GitHub MCP server

Use the `github` MCP server to:
- Read the linked issue (`github/get_issue`) to verify acceptance criteria coverage.
- Create the PR (`github/create_pull_request`) with the generated title, body, and the correct `head` value from the detection step above.
- Confirm the PR URL and link it back in the issue comments.

## Workflow

1. Summarize implemented scope and non-goals.
2. Generate PR title and description using `.github/pull_request_template.md` as the PR body structure.
3. Fill each template section:
   - **User-Facing Changes**: Describe changes visible to end users (used as changelog entry).
   - **Description**: Link relevant GitHub issues (`Closes #<number>`). Add context about the implementation approach.
   - **Checklist**: Mark completed items; leave unchecked items with a note if not applicable.
4. Append the following after the template sections:
   - Acceptance criteria coverage (cross-check against linked issue)
   - Risk and rollback notes
5. Confirm pre-submit checks are green (lint, type-check, tests).
6. Open as **draft** if any acceptance criterion is still unverified.

### PR template

Use `.github/pull_request_template.md` as the PR body structure.

## CodeRabbit

Once the PR is opened as non-draft targeting `develop` or `main`, CodeRabbit will auto-review it.
- Do not request human review before CodeRabbit has posted its summary.
- Address CodeRabbit's Critical and High findings before requesting human review.

## Output format

- Proposed PR title
- PR description body
- Validation checklist
- Reviewer focus areas

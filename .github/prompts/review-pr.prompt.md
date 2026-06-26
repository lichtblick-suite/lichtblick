---
name: 'Review Pull Request'
description: 'Two-phase PR review: (1) structured analysis integrating CodeRabbit findings; (2) implement corrections from CodeRabbit AI agent prompt.'
---

Use this workflow to review a pull request before merge.
It has two independent phases — run them separately or together depending on what you need.

---

## Phase 1 — Review

### Inputs

- PR number or URL (use the `github` MCP server to fetch diff and review threads)
- Optional focus areas

### CodeRabbit integration

CodeRabbit runs automatically on every non-draft PR targeting `develop` or `main`.

Before starting a manual review:
1. Check whether CodeRabbit has already posted its review.
2. If not yet posted (PR just opened), wait or trigger manually with `@coderabbitai review`.
3. Use CodeRabbit's findings as the baseline — do not duplicate what it already flagged.
4. Focus manual review on areas CodeRabbit cannot reason about: domain correctness, architecture decisions, and acceptance-criteria coverage.

To request a fresh CodeRabbit pass on an existing PR, comment:
```sh
@coderabbitai review
```

### Review dimensions

1. Correctness and regressions
2. API and behavior compatibility
3. Performance risks
4. Security risks
5. Test coverage gaps
6. Acceptance criteria coverage (cross-check against linked GitHub issue)
7. Documentation and migration notes

### Workflow

1. Fetch PR diff via `github` MCP or read from context.
2. Read CodeRabbit's posted review (if available) and note already-covered findings.
3. Classify additional findings by severity:
   - Critical
   - High
   - Medium
   - Low
4. For each finding, provide:
   - File/location
   - Problem
   - Suggested fix
5. If no findings beyond CodeRabbit's, state residual risks and testing gaps.

### Output format

- CodeRabbit summary (link/status)
- Additional findings ordered by severity
- Open questions/assumptions
- Merge readiness recommendation

---

## Phase 2 — Implement CodeRabbit suggestions

Use this phase when CodeRabbit has posted a review and you want to implement its corrections.

### How CodeRabbit exposes its suggestions

After posting a review, CodeRabbit includes a collapsible section in its PR comment:

> **Prompt for AI Agents** (also labelled "Prompt for all review comments with AI agents")

This section contains a self-contained prompt listing every finding with file locations, problems,
and suggested fixes — ready to be given directly to a coding agent.

### Workflow

1. Use the `github` MCP server to fetch PR review comments:
   ```text
   github/list_pull_request_review_comments  (PR number)
   github/list_issue_comments                (PR number — for top-level review summaries)
   ```
2. Find the comment authored by `coderabbitai[bot]`.
3. Locate the section starting with the heading **"Prompt for AI Agents"** or
   **"Prompt for all review comments with AI agents"** inside that comment.
4. Extract the full prompt text from that section (everything until the next top-level heading
   or end of comment).
5. Present the extracted prompt to the user for confirmation before proceeding.

Human checkpoint:
- Show the extracted CodeRabbit prompt and ask the user to confirm before implementing.

6. Once confirmed, delegate implementation to the appropriate specialist agents based on the
   affected files and finding types:

   | Finding type / affected path | Delegate to |
   |------------------------------|-------------|
   | `packages/**/*.tsx`, `packages/**/*.ts` (React/UI) | `@lb-frontend-dev` |
   | `**/*.test.ts`, `**/*.test.tsx` | `@lb-unit-test` |
   | `e2e/**` | `@lb-e2e-test` |
   | `packages/suite-base/src/players/**` | `@lb-player` |
   | `packages/suite-base/src/panels/**` | relevant `@lb-panel-*` or `@lb-panels-general` |
   | Cross-cutting or unclear | `@lb-orchestrator` |

7. After each fix is applied, verify:
   - `yarn lint` passes on affected files
   - Related tests still pass: `yarn test --testPathPattern=<affected file>`
8. Do not implement findings marked as **nitpick** or **informational** unless the user
   explicitly requests it.

### Output format

- Extracted CodeRabbit AI agent prompt (verbatim, for confirmation)
- List of findings to be implemented (filtered: exclude nitpicks unless requested)
- Delegation plan (which agent handles which finding)
- Implementation results per finding
- Validation summary (lint + tests)

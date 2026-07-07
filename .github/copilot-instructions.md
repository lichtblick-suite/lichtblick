# Copilot Instructions — Lichtblick

Lichtblick is an open-source integrated visualization and diagnosis tool for robotics. It is built
primarily with **TypeScript** and **React**, available as a desktop app (Electron) and a web app.

> This file is auto-loaded by GitHub Copilot Chat at the start of every session.

---

## Global Rules

### General Principles

- **Be concise**: Prefer short, focused responses
- **Context-aware**: Check existing patterns in the codebase before suggesting changes
- **Follow existing conventions**: Match the style and structure of surrounding code
- **No breaking changes**: Preserve existing APIs and interfaces unless explicitly asked
- **Security first**: Never hardcode secrets, credentials, or sensitive data
- **Open-source**: All contributions must be compliant with the MPL-2.0 license

### Code Quality

- **Type safety**: Use TypeScript strict mode — avoid `any`; prefer `undefined` over `null`
- **Error handling**: Handle errors gracefully with meaningful messages
- **No `console.log`**: Use `console.warn`, `console.error`, `console.debug`, `console.assert` only
- **License headers**: All source files must include the MPL-2.0 SPDX header

### Formatting (enforced by Biome; linting by ESLint)

- **Print width**: 100 characters
- **Quotes**: Double quotes
- **Semicolons**: Yes
- **Trailing commas**: All
- **Line endings**: LF

> Full code style standards are documented in [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Project Structure

```
packages/
  suite-base/    # Core application logic, components, panels
  suite/         # Entry-point wrapper
  suite-desktop/ # Electron-specific functionality
  suite-web/     # Web-specific functionality
  hooks/         # Shared React hooks
  theme/         # MUI theme
  den/           # Async and utility helpers
desktop/         # Electron main/preload/renderer entry points
web/             # Web app entry point
e2e/             # Playwright E2E tests
benchmark/       # Performance benchmarks
```

### Component Structure

```
ComponentName/
  index.tsx          # Exports only
  ComponentName.tsx  # Logic and rendering
  ComponentName.test.tsx
  ComponentName.style.ts
  types.ts
  constants.ts
  hooks/
  builders/          # Test builders for this component
  utils/
```

---

## Package Manager

- **Yarn 3.6.3** via Corepack (do not use npm or pnpm)
- Enable with: `corepack enable`

### Key Commands

```bash
yarn web:serve               # Start web dev server (http://localhost:8080)
yarn desktop:serve           # Start webpack for Electron
yarn desktop:start           # Launch Electron app (requires desktop:serve)
yarn test                    # All unit tests (Jest)
yarn test:watch              # Watch mode
yarn test:coverage           # Unit tests with coverage
yarn lint                    # ESLint + Prettier
yarn test:e2e:web            # Web E2E tests (Playwright)
yarn test:e2e:desktop        # Desktop E2E tests (Playwright + Electron)
```

---

## Testing Standards

All tests follow the **Given-When-Then (GWT)** pattern. See the
[test-conventions skill](./skills/test-conventions/SKILL.md) for full rules.

- **Unit tests**: Jest, co-located with source (`.test.ts` / `.test.tsx`)
- **E2E tests**: Playwright — desktop (Electron) primary, web for distinct behaviors only
- **Mock builders**: Use builders from `testing/builders/` and component-specific `builders/` directories
- **Coverage target**: 80%+ on business logic

---

## Styling

- Use **tss-react/mui** for all component styles
- Never use `@emotion/styled`, MUI's `styled()`, `Box`, or `sx` prop
- Styles live in `ComponentName.style.ts` files

---

## Available Agents

Use these agents in Copilot Chat for specialized tasks. For the full catalog see [docs/ai-agents/README.md](../docs/ai-agents/README.md).

| Agent name | Purpose |
| --- | --- |
| `@lb-orchestrator` | Routes tasks to the right specialist when unsure which agent to use |
| `@lb-e2e-test` | Create Playwright E2E tests (Electron desktop + web) |
| `@lb-player` | IterablePlayer state machine, data source lifecycle, playback logic |
| `@lb-panels-general` | PanelExtensionAdapter, renderState, panel lifecycle, pauseFrame |
| `@lb-frontend-dev` | React/TypeScript components, hooks, state management, styling |
| `@lb-unit-test` | Unit test creation, mocking patterns, builder usage |

Agents are defined in `.github/agents/`.
Skills are defined in `.github/skills/`.

---

## MCP Servers

Configured in `.mcp.json` (repo root). Recognized by VS Code Copilot, Claude Code, Cursor, and other MCP-compatible tools. Agents reference these using the server name as prefix.

| Server | Type | Purpose |
| --- | --- | --- |
| `github` | HTTP (Copilot-native) | Read/create GitHub Issues and PRs. No extra credentials needed. |
| `playwright` | stdio | Drive Chrome for web app exploration. Used by `@lb-e2e-test`. |

---

## Available Prompts

Reusable workflow prompts live in `.github/prompts/`.

| Prompt | Purpose |
| --- | --- |
| `sdd-feature-develop.prompt.md` | Specify -> Plan -> Tasks -> Implement workflow for feature work |
| `sdd-bug-fix.prompt.md` | Reproduce -> Diagnose -> Plan -> Implement workflow for bug fixes |
| `sdd-lichtblick-upstream-sync.prompt.md` | Structured upstream sync analysis and execution workflow |
| `sdd-lichtblick-feature-adopt.prompt.md` | Evaluate and adopt a specific upstream feature safely |
| `open-pr.prompt.md` | Build a complete PR title/body with validation evidence |
| `review-pr.prompt.md` | Two-phase PR review: structured analysis integrating CodeRabbit findings, then implement CodeRabbit's AI agent prompt |

---

## Ask Before Acting When

- Making architectural changes to `packages/suite-base/`
- Adding new external dependencies
- Changing public component APIs
- Modifying the build configuration or CI pipeline

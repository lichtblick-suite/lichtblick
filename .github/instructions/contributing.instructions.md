---
applyTo: "**/*.ts,**/*.tsx"
---

# Contributing Conventions

These rules are derived from [CONTRIBUTING.md](../../CONTRIBUTING.md) and apply to all TypeScript and TSX files.

## Branch naming

Branch names must use a prefix that matches the target branch (enforced in CI by
[enforce-branch-naming.yml](../workflows/enforce-branch-naming.yml)):

| Target branch | Allowed source prefixes |
|---------------|-------------------------|
| `main` | `release/`, `hotfix/` |
| `develop` | `feature/`, `bugfix/`, `dependabot/`, `sync/` |

Use a short, descriptive, kebab-case name after the prefix (e.g. `feature/improve-ai-experience`).

## Component Structure

Every React component must follow this file organization:

| File | Purpose |
|------|---------|
| `index.tsx` | Entry point — manages exports only, no logic |
| `ComponentName.tsx` | Primary logic and rendering |
| `ComponentName.test.tsx` | Unit tests (Given-When-Then pattern) |
| `ComponentName.style.ts` | Styles using tss-react/mui |
| `types.ts` | Type definitions, interfaces, enums |
| `constants.ts` | Component-specific constants |
| `hooks/` | Custom hooks |
| `builders/` | Builder pattern classes for test data |
| `utils/` | Utility functions |

## TypeScript Rules

- **Strict mode** — avoid `any` types
- Prefer `undefined` over `null`; use `ReactNull` alias where React APIs require `null`
- Do NOT use property getters or setters — use function syntax
- Unused variables must have `_` prefix (e.g., `_unusedParam`)
- Use `@lichtblick/den/async` `race` instead of `Promise.race`
- Allowed console methods: `console.warn`, `console.error`, `console.debug`, `console.assert`

## Styling

- Use **tss-react/mui** (`makeStyles`) for all styles
- Do NOT use `@emotion/styled`, MUI's `styled()`, `sx` prop, or `Box` component for styling

## Testing

- All tests follow **Given-When-Then (GWT)** structure
- Use **Builder pattern** for mock data creation (`builders/` directories)
- Tests are colocated with source files: `*.test.ts` / `*.test.tsx`

## Localization

- Use `useTranslation(namespace)` → `t("key")` for user-facing strings
- Keys must be `camelCase`
- English translations mandatory; other languages optional
- Translation files: `packages/suite-base/src/i18n/{lang}/{namespace}.ts`

## License Header

All new source files must include:
```typescript
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
```

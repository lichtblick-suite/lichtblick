# AGENTS.md

This file helps AI coding agents work effectively in the Lichtblick monorepo.

## Quick Start

- Use Node.js 20+.
- Enable Corepack and install dependencies with Yarn 3.6.3:

```sh
corepack enable
yarn install
```

- Use Yarn commands only (not npm or pnpm).

## Core Commands

- Lint and auto-fix: `yarn lint`
- CI lint mode: `yarn lint:ci`
- Unit tests: `yarn test`
- Coverage: `yarn test:coverage`
- Type check (from contributing guide): `yarn run tsc --noEmit`
- Build internal packages: `yarn build:packages`

Desktop app development (run in separate terminals):

```sh
yarn desktop:serve
yarn desktop:start
```

Web app development:

```sh
yarn web:serve
```

E2E tests:

- Desktop: `yarn test:e2e:desktop`
- Web: `yarn test:e2e:web`

## Monorepo Map

- `desktop/`: Electron app entry points (`main/`, `preload/`, `renderer/`, `quicklook/`)
- `web/`: Web app bundling and entry point
- `packages/suite-base/`: Shared core UI and logic
- `packages/suite-desktop/`: Desktop-specific internal package
- `packages/suite-web/`: Web-specific internal package
- `packages/suite/`: Extension API types
- `e2e/`: Playwright end-to-end tests
- `ci/`: CI and repository maintenance scripts
- `patches/`: Yarn patch protocol patches for third-party dependencies

## High-Impact Conventions

- Follow TypeScript strict patterns; avoid `any` unless necessary.
- Prefer `undefined` over `null` (except where React APIs require otherwise).
- Use `tss-react/mui` patterns for styling instead of ad-hoc styling approaches.
- Keep component structure consistent with the contributing guide (`index.tsx`, component file, `types.ts`, `constants.ts`, `*.style.ts`, tests).
- New source files should include the MPL-2.0 license header used in this repo.
- If changing UI behavior, validate in both desktop and web modes when relevant.

## Testing Guidance

- Add or update tests with code changes.
- Prefer targeted test runs while iterating; run broader suites before finishing.
- Unit tests use Jest and are typically colocated with source files (`*.test.ts` / `*.test.tsx`).
- E2E tests use Playwright and follow `{feature-name}.{platform}.spec.ts`.

## Agent Guardrails

- Do not edit generated outputs unless the task explicitly requires it:
  - `coverage/`
  - `storybook-static/`
  - `dist/`
  - `.webpack/`
  - `test-results/`
  - `e2e/reports/`
  - `e2e/tests/reports/desktop/`
  - `e2e/tests/reports/web/`
  - `e2e/tmp/`
- Keep dependency patch changes isolated to `patches/` and related dependency metadata.

## Reference Docs

- Main project guide: [README.md](README.md)
- Contributing and coding standards: [CONTRIBUTING.md](CONTRIBUTING.md)
- E2E testing details: [e2e/README.md](e2e/README.md)
- Package scripts and workspace configuration: [package.json](package.json)
- Package-specific notes:
  - [packages/suite-base/README.md](packages/suite-base/README.md)
  - [packages/suite-desktop/README.md](packages/suite-desktop/README.md)
  - [packages/suite-web/README.md](packages/suite-web/README.md)
  - [packages/suite/README.md](packages/suite/README.md)

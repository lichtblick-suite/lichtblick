# Contributing Guidelines

Welcome, and thank you for your interest in contributing to Lichtblick! We value your contributions and want to make the contributing experience enjoyable and rewarding for you.

Lichtblick is an integrated visualization and diagnosis tool for robotics, built primarily with **TypeScript** and **React**. It is available as a desktop app (Electron) and a web app.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Component Structure](#component-structure)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy---git-flow)
- [Code Style & Standards](#code-style--standards)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)
- [Version Increment](#version-increment)
- [Localization](#localization)
- [License](#license)
- [Credits](#credits)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [lichtblick@bmwgroup.com](mailto:lichtblick@bmwgroup.com).

---

## Prerequisites

Before contributing, ensure you have the following installed:

| Tool                                             | Version                | Notes                                                |
| ------------------------------------------------ | ---------------------- | ---------------------------------------------------- |
| [Node.js](https://nodejs.org/)                   | >= 20                  | LTS recommended                                      |
| [Corepack](https://nodejs.org/api/corepack.html) | (bundled with Node.js) | Must be enabled: `corepack enable`                   |
| [Yarn](https://yarnpkg.com/)                     | 3.6.3                  | Managed via Corepack — do **not** install separately |
| [Git](https://git-scm.com/)                      | Latest                 | Required for version control                         |

> **Note:** If you encounter issues with Corepack after enabling it, try uninstalling and reinstalling Node.js. Ensure Yarn is installed _via_ Corepack, not from another source.

---

## Getting Started

### For community contributors (external)

External contributors do not have write access to the repository. To contribute, you must **fork** the project and open a Pull Request from your fork:

1. **Fork** the repository on GitHub.
2. **Clone your fork:**

   ```sh
   git clone https://github.com/<your-username>/lichtblick.git
   cd lichtblick
   ```

3. **Add the upstream remote** (to keep your fork up to date):

   ```sh
   git remote add upstream https://github.com/lichtblick-suite/lichtblick.git
   ```

### For internal team members

Core team members with write access can clone the repository directly and create branches following the [Branching Strategy](#branching-strategy---git-flow):

```sh
git clone https://github.com/lichtblick-suite/lichtblick.git
cd lichtblick
```

### Setup

1. **Enable Corepack** and install dependencies:

   ```sh
   corepack enable
   yarn install
   ```

2. **Launch the development environment:**

   ```sh
   # Desktop app (run in separate terminals):
   yarn desktop:serve        # Start webpack dev server
   yarn desktop:start        # Launch Electron (wait for desktop:serve to finish)

   # Web app:
   yarn web:serve            # Available at http://localhost:8080
   ```

3. **Explore available commands:**

   ```sh
   yarn run                  # List all available commands
   ```

### Other useful commands

```sh
# Launch Storybook for component development
yarn storybook

# Lint all files (with auto-fix)
yarn lint

# Run all unit tests
yarn test

# Run tests in watch mode (for active development)
yarn test:watch

# Run E2E tests
yarn test:e2e:desktop
yarn test:e2e:web
```

### Advanced: remote webpack + Electron

```sh
# Running webpack and Electron on different machines on the same network
yarn desktop:serve --host 192.168.xxx.yyy
yarn dlx electron@22.1.0 .webpack
```

---

## Project Structure

Lichtblick is organized as a **monorepo** managed with Yarn Workspaces:

```
lichtblick/
├── desktop/               # Electron desktop app entry points
│   ├── main/              # Main process
│   ├── preload/           # Preload scripts
│   ├── renderer/          # Renderer process
│   └── quicklook/         # Quick Look support
├── web/                   # Web app entry point
├── packages/
│   ├── suite/             # Core application logic
│   ├── suite-base/        # Shared base components, panels, and players
│   ├── suite-desktop/     # Desktop-specific functionality
│   ├── suite-web/         # Web-specific functionality
│   ├── theme/             # Theming and styling
│   ├── hooks/             # Shared React hooks
│   ├── log/               # Logging utilities
│   ├── den/               # Data utilities and async helpers
│   ├── mcap-support/      # MCAP file format support
│   ├── message-path/      # Message path parsing
│   └── ...                # Other internal packages
├── e2e/                   # End-to-end tests (Playwright)
├── benchmark/             # Performance benchmarks
└── ci/                    # CI scripts and utilities
```

---

## Component Structure

To ensure consistency, scalability, and a clear separation of concerns, all React components should follow the structure outlined below.

### File organization per component

| File / Directory         | Purpose                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`              | Entry point — manages exports and provides a simplified integration interface                                                                     |
| `ComponentName.tsx`      | Primary logic and rendering of the component                                                                                                      |
| `ComponentName.test.tsx` | Unit tests for the component                                                                                                                      |
| `ComponentName.style.ts` | Styles specific to the component (using [tss-react](https://www.tss-react.dev/))                                                                  |
| `<name>.types.ts`        | Type definitions scoped exclusively to a single file — applicable to components, hooks, utils, etc (e.g. `Plot.types.ts`, `usePlotData.types.ts`) |
| `types.ts`               | TypeScript type definitions, interfaces, and enums shared across the component and its sub-files                                                  |
| `constants.ts`           | Constants specific to the component (avoids magic numbers and scattered hardcoded values)                                                         |
| `hooks/`                 | Custom hooks related to the component (e.g., `useComponentData.ts`)                                                                               |
| `builders/`              | Builder classes for creating mock data, test props, and reusable configurations                                                                   |
| `utils/`                 | Utility functions specific to the component                                                                                                       |
| `shared/`                | Shared functionalities reusable across sibling components                                                                                         |

### Example directory tree

```
panels/
├── Plot/
│   ├── index.tsx                        # Entry point for exposing the component
│   ├── Plot.tsx                         # Primary logic and rendering
│   ├── Plot.style.ts                    # Styles specific to the Plot component
│   ├── Plot.test.tsx                    # Unit tests for the Plot component
│   ├── Plot.types.ts                    # Types scoped only to Plot.tsx
│   ├── PlotLegend.tsx                   # Sub-component: logic and rendering
│   ├── PlotLegend.style.ts              # Styles for the PlotLegend sub-component
│   ├── PlotLegend.test.tsx              # Unit tests for the PlotLegend sub-component
│   ├── types.ts                         # Contracts/Schemas for Plot components
│   ├── constants.ts                     # Constants specific to Plot components
│   ├── hooks/
│   │   ├── usePlotData.ts               # Custom hook for the Plot component
│   │   ├── usePlotData.types.ts         # Types scoped only to usePlotData.ts
│   │   └── usePlotData.test.ts          # Unit tests for the hook
│   ├── builders/
│   │   ├── PlotBuilder.ts               # Builder for mock data and test props
│   │   └── PlotBuilder.test.ts          # Unit tests for the builder
│   └── utils/
│       ├── formatPlotValues.ts          # Utility function for the Plot component
│       └── formatPlotValues.test.ts     # Unit tests for the utility
└── shared/
    ├── formatDate.ts                    # Shared function across panel components
    └── formatDate.test.ts               # Unit tests for the shared function
```

### Key principles

- **`index.tsx`** should focus exclusively on managing exports. Primary component logic belongs in `ComponentName.tsx`.
- **`types.ts`** centralizes type definitions shared across a component and its sub-files, making them easily accessible and reusable.
- **`<name>.types.ts`** holds type definitions scoped exclusively to a single file — this pattern applies to components, hooks, and utils alike (e.g., `Plot.types.ts`, `usePlotData.types.ts`, `formatPlotValues.types.ts`). Use it when types are internal implementation details not intended to be shared or re-exported outside that file.
- **`constants.ts`** and **`*.style.ts`** files can be excluded from code coverage tools (e.g., SonarQube) to focus metrics on relevant files.
- **Builders** follow the [Builder pattern](https://refactoring.guru/design-patterns/builder) to simplify creation of complex objects step-by-step — especially useful for test setups.
- **`shared/`** promotes reusability across sibling components and reduces duplication of common logic.

---

## Development Workflow

### 1. Create a branch

- **Internal team:** Create a branch directly in the repository following the [Branching Strategy](#branching-strategy---git-flow). Always branch off `develop` for features and bugfixes.
- **Community contributors:** Create a branch in your **fork**. When opening a PR, target the `develop` branch of the upstream repository.

### 2. Make your changes

- Write clean, well-documented TypeScript code.
- Follow the [Code Style & Standards](#art-code-style--standards) and [Component Structure](#component-structure).
- Add or update unit tests for your changes.
- If your change affects the UI, verify it in both **web** and **desktop** modes.

### 3. Validate locally

Before pushing, ensure your changes pass all checks:

```sh
yarn lint                   # Linting (ESLint + Prettier)
yarn test                   # Unit tests (Jest)
yarn run tsc --noEmit       # TypeScript type checking
```

### 4. Open a Pull Request

- **Community contributors:** Open a PR **from your fork** targeting the `develop` branch of the upstream repository.
- **Internal team:** Open a PR directly in the repository targeting `develop` for features/bugfixes, or `main` for `release/major/`, `release/minor/`, and `hotfix/` branches.
- Fill in the [PR template](#pull-request-guidelines) completely.
- Ensure CI checks pass.

---

## Branching Strategy - Git flow

Branch naming is **enforced by CI**. PRs with non-compliant branch names will be automatically rejected.

### Targeting `develop`

| Prefix        | Purpose                                  | Example                       |
| ------------- | ---------------------------------------- | ----------------------------- |
| `feature/`    | New features or significant improvements | `feature/user-authentication` |
| `bugfix/`     | Non-critical bug fixes                   | `bugfix/fix-login-redirect`   |
| `dependabot/` | Automated dependency updates             | _(auto-generated)_            |

### Targeting `main`

| Prefix           | Purpose                                                            | Example                 |
| ---------------- | ------------------------------------------------------------------ | ----------------------- |
| `release/major/` | Major production releases (breaking changes or reworked APIs)      | `release/major/2.0.0`   |
| `release/minor/` | Minor production releases (new functionality, no breaking changes) | `release/minor/1.3.0`   |
| `hotfix/`        | Urgent critical fixes                                              | `hotfix/security-patch` |

---

## Code Style & Standards

Code quality is enforced through automated tooling. All checks run in CI and must pass before merging.

### Formatting

- **Prettier** is used for code formatting with a `printWidth` of **100** characters.
- Prettier runs automatically as part of linting in CI.

### Linting

- **ESLint** with the `@lichtblick` plugin suite enforces consistent code patterns.
- Run `yarn lint` to auto-fix issues locally (Prettier integration is disabled locally to speed up linting, but enforced in CI).

### TypeScript Conventions

- **Strict mode** is enabled — avoid `any` types where possible.
- Prefer `undefined` over `null`. When required for React refs, use the `ReactNull` alias.
- Do not use property getters or setters — use function syntax instead.
- Unused variables must have a `_` prefix (e.g., `_unusedParam`).
- Avoid `@emotion/styled` and MUI's `styled`/`sx`/`Box` — use **tss-react/mui** for styling instead.
- Use `@lichtblick/den/async` `race` instead of `Promise.race` (see [V8 bug](https://bugs.chromium.org/p/v8/issues/detail?id=9858)).
- Allowed console methods: `console.warn`, `console.error`, `console.debug`, `console.assert`.

### License Headers

All source files must include the **MPL-2.0** license header. This is enforced by ESLint via the `@lichtblick/license-header` rule.

### File Organization

- Keep constants in `constants.ts`, types in `types.ts`, and styles in `*.style.ts` files.
- Organize styles using [tss-react](https://www.tss-react.dev/).
- See the [Component Structure](#component-structure) section for a complete reference.

---

## Testing

### General Principles

- All tests should follow the **Given-When-Then (GWT)** structure for improved readability and maintainability. This pattern is used consistently across both unit and E2E tests.
- Use **reusable mock builders** to create test data instead of manually setting up mocks in each test. Builders are centralized in `builders/` directories and provide consistent, flexible, and configurable data for all test levels.

### Mock Builders

The project uses a **Builder pattern** to streamline the creation of test data across unit, integration, and E2E tests:

```
/testing
├── builders/
│   ├── BasicBuilder.ts         # Basic mocks (dates, strings, lists, floats, etc.)
│   └── EntityBuilder.ts        # Mocks for specific application entities
```

- **`BasicBuilder`** provides foundational mock data types.
- **Entity builders** generate consistent domain-specific mock data.
- Component-specific builders live in the component's own `builders/` directory (see [Component Structure](#component-structure)).

### Unit Tests (Jest)

- All new features and bug fixes should be covered by unit tests.
- Tests are located alongside source files with the `.test.ts` / `.test.tsx` extension.
- Run tests:

  ```sh
  yarn test                   # Run all tests
  yarn test:watch             # Run tests on changed files
  yarn test:coverage          # Run tests with coverage report
  yarn test:debug             # Run tests with debugger attached
  ```

### End-to-End Tests (Playwright)

E2E tests cover both desktop (Electron) and web versions, with the following strategy:

- **Primary focus on desktop testing** — The desktop version is the final stage of the software, so the majority of E2E tests target it.
- **Web-specific tests only when necessary** — Tests are written for the web version only when there is a distinct behavior that needs separate validation.
- **Shared test architecture** — Page Object Models (POM) and helper functions are reused across both platforms.
- **Playwright** is the chosen E2E framework.

#### Filename pattern

```
{feature-name}.{platform}.spec.ts
```

Example: `install-multiple-extensions.web.spec.ts`

#### E2E directory structure

```
e2e/
├── tests/
│   ├── desktop/                          # Desktop E2E tests
│   │   ├── open-files/
│   │   │   └── open-mcap-via-ui.desktop.spec.ts
│   │   ├── sidebar/
│   │   ├── layout/
│   │   ├── extension/
│   │   ├── panel/
│   │   ├── utils/                        # Shared desktop test utilities
│   │   └── playwright.config.ts          # Desktop Playwright configuration
│   └── web/                              # Web E2E tests
│       ├── open-files/
│       │   └── open-mcap-via-url.web.spec.ts
│       ├── utils/
│       └── playwright.config.ts          # Web Playwright configuration
├── fixtures/                             # Test fixtures and data mocks
└── helpers/                              # Generic test helper functions
```

#### Running E2E tests

```sh
yarn test:e2e:desktop           # Desktop E2E tests
yarn test:e2e:web               # Web E2E tests
yarn test:e2e:desktop:debug     # Desktop E2E with debug mode
yarn test:e2e:web:debug         # Web E2E with debug mode
```

### CI Pipeline

The following checks run automatically on every PR:

| Check           | Description                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **npm audit**   | Security vulnerability scan                                                                     |
| **lint**        | License check, dedup check, TypeScript type checking, ESLint, unused exports, dependency checks |
| **packages**    | Build all internal packages                                                                     |
| **web**         | Production web build                                                                            |
| **desktop**     | Production desktop build                                                                        |
| **benchmark**   | Production benchmark build                                                                      |
| **test**        | Full unit test suite                                                                            |
| **e2e-desktop** | Desktop E2E tests (parallelized across 4 shards)                                                |
| **e2e-web**     | Web E2E tests                                                                                   |

> All CI checks must pass before a PR can be merged.

---

## Pull Request Guidelines

> :lock: **Direct PRs to the repository** are restricted to the internal development team. Community contributors must submit PRs **from a fork** of the repository. All contributions — internal and external — follow the same review and CI requirements.

When opening a PR, fill in the template provided:

### Required checklist

- [ ] The **web version** was tested and is running correctly
- [ ] The **desktop version** was tested and is running correctly
- [ ] Changes are covered by **unit tests**
- [ ] Files `constants.ts`, `types.ts`, and `*.style.ts` have been checked — relevant code snippets have been relocated appropriately

### PR best practices

- **Title:** Use a clear, descriptive title summarizing the change.
- **User-Facing Changes:** Describe changes visible to end users — this will be used as a changelog entry.
- **Description:** Link relevant GitHub issues. Add the `docs` label if documentation updates are needed.
- **Size:** Keep PRs focused. Smaller PRs are reviewed faster and have fewer merge conflicts.
- **Reviewers:** PRs require at least one approving review before merging.

---

## Reporting Issues

- **Bug reports:** Use the [Bug Report template](https://github.com/lichtblick-suite/lichtblick/issues/new?template=bug.md) on GitHub.
- **Feature requests:** Start a [Discussion](https://github.com/lichtblick-suite/lichtblick/discussions/new/choose) in the repository.
- **Questions:** Search existing [Discussions](https://github.com/lichtblick-suite/lichtblick/discussions) or ask on [Robotics Stack Exchange](https://robotics.stackexchange.com/questions/ask).

When reporting a bug, please include:

- Lichtblick version
- Platform (OS, browser, desktop)
- Data source type (e.g., MCAP file, ROS 1/2 native, rosbridge)
- Steps to reproduce
- Expected vs. actual behavior

---

## Version Increment

The version format: `<major>.<minor>.<patch>`. Version bumps are **determined automatically** by the CI release workflow based on the branch name used:

| Component | Branch Prefix    | Description                                                                            |
| --------- | ---------------- | -------------------------------------------------------------------------------------- |
| **MAJOR** | `release/major/` | Breaking changes — removed or reworked APIs. Users should expect a non-trivial update. |
| **MINOR** | `release/minor/` | New functionality added without breaking backward compatibility.                       |
| **PATCH** | `hotfix/`        | Bug fixes, security patches, and minor improvements.                                   |

---

## Localization

First-class support is provided in **English only**. Translations into other languages are community-driven and available on a best-effort basis.

Translation support is implemented using [`react-i18next`](https://react.i18next.com).

### Translation guidelines

- We value **high-quality** translations over complete coverage. Every PR must have up-to-date **English** translations, but updating other languages is optional.
- If you update an English translation and cannot provide accurate non-English translations, **delete the outdated non-English versions** in your PR. Optionally, open follow-up PRs with accurate translations.

### Translation files

The [`i18n` directory](packages/suite-base/src/i18n) contains translated strings organized by **namespaces** — e.g., [`i18n/en/appSettings.ts`](packages/suite-base/src/i18n/en/appSettings.ts) contains translations for the Settings tab.

### Using translations in components

1. Call the [`useTranslation(namespace)`](https://react.i18next.com/latest/usetranslation-hook) hook to get the `t` function.
2. Use `t("key")` to render translated strings.
3. Use `camelCase` for all new localization keys.

### Adding localization to a component

<table><tr><th>Before</th><th>After</th></tr><tr><td>

```ts
function MyComponent() {
  return <p>Hello!</p>;
}
```

</td><td>

```ts
function MyComponent() {
  const { t } = useTranslation("myComponent");
  return <p>{t("hello")}</p>;
}
```

```ts
// i18n/en/myComponent.ts
export const myComponent = {
  hello: "Hello!",
};
```

</td></tr></table>

### Complete example

```ts
// MyComponent.ts
import { useTranslation } from "react-i18next";

function MyComponent(props: Props): React.JSX.Element {
  const { t } = useTranslation("myComponent");
  return <p>{t("hello")}</p>;
}
```

```ts
// i18n/en/myComponent.ts
export const myComponent = {
  hello: "Hello!",
};

// i18n/en/index.ts
export * from "./myComponent";
```

```ts
// i18n/zh/myComponent.ts
export const myComponent: Partial<TypeOptions["resources"]["myComponent"]> = {
  hello: "你好！",
};

// i18n/zh/index.ts
export * from "./myComponent";
```

| English         | Chinese         |
| --------------- | --------------- |
| `<p>Hello!</p>` | `<p>你好！</p>` |

---

## License

Lichtblick is licensed under the [Mozilla Public License v2.0](LICENSE). All contributions must comply with this license.

---

## Credits

Lichtblick originally began as a fork of [Foxglove Studio](https://github.com/foxglove/studio), an open-source project developed by [Foxglove](https://foxglove.dev/).

---

_Thank you for contributing to Lichtblick! Your efforts help build better tools for the robotics community._

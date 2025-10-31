# End-to-End (E2E) Testing for Lichtblick

This directory contains all end-to-end (E2E) tests using [Playwright](https://playwright.dev/). The tests are organized and scoped by platform: **web** and **desktop** (Electron).

## 📦 How to Run

```bash
# Build desktop packages
yarn desktop:build:prod
```

```bash
# Install Playwright
yarn playwright install
```

### Web

```bash
# Run all web tests
yarn test:e2e:web

# Run in debug mode (step-by-step)
yarn test:e2e:web:debug

# View latest web test report
yarn test:e2e:web:report
```

### Desktop (Electron)

```bash
# Run all desktop tests
yarn test:e2e:desktop

# Run in debug mode
yarn test:e2e:desktop:debug

# View latest desktop test report
yarn test:e2e:desktop:report

# Run desktop tests in CI (headless mode enforced in Electron)
yarn test:e2e:desktop:ci

# Run a specific test when developing (filename: uninstall-extension.desktop.spec.ts)
yarn test:e2e:desktop:debug uninstall-extens
```

## 🧪 Filename Pattern

Test files follow the pattern:

```ts
{feature-name}.{platform}.spec.ts
```

**Example:**

```
install-multiple-extensions.web.spec.ts;
```

## 🗂 Directory Structure

```text
/e2e
  ├── tests/                         # E2E tests
  │   ├── desktop/                   # Desktop e2e tests
  │   │   ├── open-files/            # Tests for open files
  │   │   │   ├── open-mcap-via-ui.desktop.spec.ts
  │   │   │   └── ...desktop.spec.ts
  │   │   ├── sidebar/               # Tests for right and left sidebars
  │   │   ├── layout/                # Tests for layouts
  │   │   ├── extension/             # Tests for extension
  │   │   ├── panel/                 # Tests for panels
  │   │   ├── utils/                 # Shared functions
  │   │   ├── desktop-setup.ts       # Pré script to setup desktop tests
  │   │   ├── desktop-teardown.ts    # Pré script to cleanup desktop tests
  │   │   └── playwright.config.ts   # Desktop Playwright configuration
  │   └── web/                       # Web e2e tests
  │       ├── open-files/            # Tests for open files via URL
  │       │   ├── open-mcap-via-url.web.spec.ts
  │       │   └── ...web.spec.ts
  │       ├── utils/                 # Shared functions
  │       ├── web-setup.ts           # Pré script to setup web tests
  │       ├── web-teardown.ts        # Pré script to cleanup web tests
  │       └── playwright.config.ts   # Web Playwright configuration
  ├── fixtures/                      # Fixtures for testing (e.g. data mocks)
  ├── helpers/                       # Generic functions useful for testing
  ├── reports/                       # Automatically generated test reports
  ├── global-setup.ts                # Global setup before testing
  └── global-teardown.ts             # Cleanup after testing (clear DB, stored files, etc.)
```

---

> For questions or improvements, contact the QA team or refer to the [Playwright docs](https://playwright.dev/docs/intro).

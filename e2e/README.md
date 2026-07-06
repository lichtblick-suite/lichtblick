# End-to-End (E2E) Testing for Lichtblick

This directory contains all end-to-end (E2E) tests using [Playwright](https://playwright.dev/). The tests are organized and scoped by platform: **web** and **desktop** (Electron).

## 📦 How to Run

```bash
# Build desktop packages
yarn desktop:build:dev
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

# Generate test summary with timings
yarn test:e2e:summary

# Run a specific test when developing (filename: uninstall-extension.desktop.spec.ts)
yarn test:e2e:desktop:debug uninstall-extens
```

## 🏷️ Test Categories

All E2E tests are labeled with one of two tags that control which CI pipeline executes them:

| Tag           | When it runs                                    | Criteria                                                                                        |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@smoke`      | Every PR / every push                           | Critical user-path tests: opening files, basic player controls, primary layout and menu actions |
| `@regression` | Nightly (02:00 UTC) + `develop` / `main` merges | Edge cases, keyboard shortcuts, extended scenarios, slower workflows (extensions, remote data)  |

### Run by category locally

```bash
# Smoke only
yarn test:e2e:desktop:smoke
yarn test:e2e:web:smoke

# All tests (smoke + regression)
yarn test:e2e:desktop
yarn test:e2e:web
```

---

## 📊 Test Performance Analysis

After running tests, you can generate a summary report showing test execution times:

```bash
# Run tests and generate summary
yarn test:e2e:desktop
yarn test:e2e:summary
```

The summary includes:

- **Overall statistics** (total tests, passed/failed/skipped)
- **Top 10 slowest tests** to identify performance bottlenecks
- **Failed tests list** with retry information
- **Total and average execution times**

This helps identify which tests are taking too long and may need optimization.

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
  │   │   ├── desktop-setup.ts       # Pre-script to setup desktop tests
  │   │   ├── desktop-teardown.ts    # Pre-script to cleanup desktop tests
  │   │   └── playwright.config.ts   # Desktop Playwright configuration
  │   └── web/                       # Web e2e tests
  │       ├── open-files/            # Tests for open files via URL
  │       │   ├── open-mcap-via-url.web.spec.ts
  │       │   └── ...web.spec.ts
  │       ├── utils/                 # Shared functions
  │       ├── web-setup.ts           # Pre-script to setup web tests
  │       ├── web-teardown.ts        # Pre-script to cleanup web tests
  │       └── playwright.config.ts   # Web Playwright configuration
  ├── page-objects/                   # Page Object Models for UI abstraction
  │   ├── data-source-dialog.ts      # DataSourceDialog interactions
  │   ├── sidebar.ts                 # Left/right sidebar navigation
  │   ├── player-controls.ts         # Playback controls (play, pause, seek)
  │   ├── layout-manager.ts          # Layout creation and management
  │   ├── extension-manager.ts       # Extension install/uninstall workflows
  │   ├── app-menu.ts                # Application menu (File, View)
  │   ├── panels.ts                  # Panel add/configure operations
  │   └── index.ts                   # Barrel export
  ├── fixtures/                      # Fixtures for testing (e.g. data mocks)
  ├── helpers/                       # Generic functions useful for testing
  ├── reports/                       # Automatically generated test reports
  ├── global-setup.ts                # Global setup before testing
  └── global-teardown.ts             # Cleanup after testing (clear DB, stored files, etc.)
```

## AI-Assisted Test Authoring with Playwright MCP

The project integrates the [Playwright MCP server](https://github.com/microsoft/playwright-mcp) to enable AI agents (GitHub Copilot, Claude) to assist with E2E test development.

### How It Works

The Playwright MCP server exposes browser automation as MCP tools that AI agents can invoke. Instead of screenshots, the server captures structured **accessibility snapshots** (ARIA roles, names, test IDs) that LLMs reason about deterministically. This produces reliable, maintainable selectors.

### Prerequisites

- VS Code with [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- Copilot agent mode enabled (VS Code 1.99+)
- The `.mcp.json` file at the repo root configures the Playwright MCP server. It is recognized by VS Code Copilot, Claude Code, Cursor, and other MCP-compatible tools.

### Workflow

1. Start the web app: `yarn web:serve`
2. Open VS Code agent mode (Copilot Chat) and invoke `@lb-e2e-test`
3. The MCP server starts automatically and opens a Chromium browser
4. Ask the agent to navigate to `http://localhost:8080` and explore the UI
5. The agent captures accessibility snapshots to identify selectors
6. Ask the agent to generate test scaffolds following the project conventions
7. Review the generated test, add meaningful assertions, and refine

### Limitations

- The MCP server controls **Chromium** (web version), not Electron directly. Use it for selector discovery and test scaffolding; Electron-specific behavior uses the custom fixture.
- AI-generated tests require human review for correctness and meaningful assertions.
- MCP server is a development-time tool only — it does not affect CI/CD.

## Page Object Models (POMs)

Reusable UI abstractions live in `e2e/page-objects/`. They encapsulate common interactions so tests focus on behavior, not selectors.

### Available POMs

| POM                | Purpose                         | Key Methods                                                                                                            |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DataSourceDialog` | Data source dialog interactions | `close()`, `openConnection()`, `isVisible()`, `getLocator()`                                                           |
| `Sidebar`          | Left/right sidebar tabs         | `openLayoutsTab()`, `openTopicsTab()`, `toggleLeftSidebar()`, `getLeftSidebar()`, `getPanelSettingsTab()`              |
| `PlayerControls`   | Playback controls               | `play()`, `pause()`, `seekForward()`, `setSpeed()`, `getTimestampValue()`, `getPlayButton()`, `getSlider()`            |
| `LayoutManager`    | Layout CRUD                     | `openDefaultLayout()`, `createNewLayout()`, `selectPanel()`, `revertLayout()`, `getLayoutListItem()`                   |
| `ExtensionManager` | Extension workflows             | `open()`, `search()`, `findExtension()`, `uninstall()`, `getSearchBar()`                                               |
| `AppMenu`          | App menu navigation             | `openFile()`, `openViewMenu()`, `importLayoutFromMenu()`, `getMenuButton()`                                            |
| `Panels`           | Panel operations                | `addPanel()`, `addPanelFromSearch()`, `setTopicPath()`, `splitPanelDown()`, `getAddPanelButton()`, `getLogPanelRoot()` |

### Usage Example

```ts
import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, Sidebar, LayoutManager } from "../../../page-objects";

test("create a new layout", async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();

  // When
  await layout.openDefaultLayout();
  await layout.createNewLayout();
  await layout.selectPanel("Diagnostics – Detail (ROS)");

  // Then
  await expect(mainWindow.getByText("Unnamed layout").nth(0)).toBeVisible();
});
```

### When to Use POMs vs Direct Selectors

- **Use POMs** for common, repeated interactions (dismissing dialogs, navigating sidebar, player controls)
- **Use direct selectors** for one-off, test-specific elements that don't appear across multiple tests

## Selector Priority Strategy

When choosing selectors for new tests, follow this priority order:

1. **`getByTestId()`** — `data-testid` attributes. Most stable and used extensively in this project.
2. **`getByRole()`** — Accessibility roles with ARIA names. Resilient to implementation changes.
3. **`getByText()` / `getByPlaceholder()`** — Visible text content. Good for user-facing labels.
4. **`locator()` with CSS** — Last resort, for elements without accessible roles or test IDs.

Avoid XPath selectors and MUI class names (e.g., `.MuiButton-root`).

---

> For questions or improvements, contact the Lichtblick team or refer to the [Playwright docs](https://playwright.dev/docs/intro).

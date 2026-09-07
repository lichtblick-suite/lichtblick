---
name: e2e-playwright-mcp
description: Domain knowledge for Playwright MCP-assisted E2E test development in Lichtblick. Covers test architecture, fixture reference, selector strategy, page objects, MCP usage, and source instrumentation patterns.
---

# E2E Testing with Playwright MCP

This skill covers writing E2E tests for Lichtblick using Playwright, with AI-assisted exploration
via the Playwright MCP server configured in `.mcp.json` at the repo root.

Follow the **test-conventions** skill for GWT pattern and core quality rules.

---

## Test Architecture

### Two Platforms

| Platform | Runner | Base URL / Entry | Config |
| --- | --- | --- | --- |
| **Web** | Chromium | `http://localhost:8080` (via `yarn web:serve`) | `e2e/tests/web/playwright.config.ts` |
| **Desktop** | Electron | Custom `electronApp` fixture | `e2e/tests/desktop/playwright.config.ts` |

**Primary focus: desktop.** Write web tests only when the behavior is web-specific (e.g., URL-based data loading, multi-tab `BroadcastChannel` sync, timestamp URL parameters).

### File Placement

```
e2e/tests/
  desktop/
    open-files/
    sidebar/
    layout/
    extension/
    panel/
    player/
    settings/
    topics/
    variables/
    menu/
    remote-data/
  web/
    open-files/
```

Group new tests under the most relevant subdirectory. Create a new subdirectory if no existing one fits.

### Filename Pattern

```
{feature-name}.{platform}.spec.ts
```

Examples: `loop-playback.desktop.spec.ts`, `sync-playback.web.spec.ts`

---

## Test Tagging

Every test **must** carry exactly one tag. This controls which CI pipeline executes it.

| Tag | CI trigger | Criteria |
|---|---|---|
| `@smoke` | Every PR push | Primary happy-path a user encounters immediately: opening files, basic player controls (play/pause), primary layout actions (create, open), and main menu navigation. Must be fast (<30 s). |
| `@regression` | Nightly (02:00 UTC) + push to `develop` / `main` | Edge cases, secondary interactions (keyboard shortcuts, speed variants), extended scenarios (timestamp switching, topic filtering), or slower workflows (extensions, remote data, WebSocket). |

### Syntax

```typescript
// Single test
test("should open a file", { tag: "@smoke" }, async ({ mainWindow }) => { ... });

// All tests in a describe block
test.describe("extension lifecycle", { tag: "@regression" }, () => { ... });
```

---

## Fixtures Reference

### Desktop (`e2e/fixtures/electron.ts`)

```typescript
import { test, expect } from "../../../fixtures/electron";
// Provides: { mainWindow }  — a Playwright Page for the Electron renderer
// Also: { electronApp } — the ElectronApplication instance
// Also: { electronArgs } — CLI arguments passed to Electron (e.g., --source=<path>)
// Also: { preInstalledExtensions } — array of extension filenames pre-installed in temp home dir
```

### Web (`@playwright/test`)

```typescript
import { test, expect } from "@playwright/test";
// Standard Playwright test with Chromium
```

### Helper Fixtures

```typescript
import { loadFiles } from "../../../fixtures/load-files";
// loadFiles({ mainWindow, filenames: "example.mcap" })
// loadFiles({ mainWindow, filenames: ["a.mcap", "b.mcap"] })
// Uses the hidden file input element ([data-puppeteer-file-upload])

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
// changeToEpochFormat(mainWindow)
// Converts timestamp display to epoch seconds for stable numeric assertions

import { launchWebsocket } from "../../../fixtures/launch-websocket";
// launchWebsocket() — starts a local FoxgloveServer WebSocket server on port 8765
// Returns { close } for cleanup

import { loadFromFilePicker } from "../../../fixtures/load-from-file-picker";
// loadFromFilePicker(mainWindow, "filename.json")
// Mocks window.showOpenFilePicker for web file picker tests

import { TEST_MCAP_URL } from "../../../fixtures/urls";
// URL to a hosted NuScenes MCAP file for URL-based loading tests
```

---

## Selector Strategy

### Priority Order

1. **`data-testid`** — most stable, preferred for interactive controls
   ```typescript
   mainWindow.getByTestId("play-button")
   mainWindow.getByTestId("loop-playback-button")
   mainWindow.getByTestId("DataSourceDialog")
   ```

2. **`getByRole`** — semantic and accessible, preferred for menus, dialogs, buttons
   ```typescript
   mainWindow.getByRole("menuitem", { name: "Save changes" })
   mainWindow.getByRole("button", { name: "Close" })
   mainWindow.getByRole("listitem").filter({ hasText: "Default" })
   ```

3. **`getByText` / `getByPlaceholder`** — for labels that are not interactive elements
   ```typescript
   mainWindow.getByText("User Scripts panel")
   mainWindow.getByPlaceholder("Search Extensions...")
   ```

4. **`locator()` with CSS** — last resort, only for elements without accessible roles or test IDs
   ```typescript
   mainWindow.locator('[data-puppeteer-file-upload]')
   mainWindow.locator('input[value="some-value"]')
   ```

### Menu Item Selectors (Mandatory Convention)

**ALWAYS** use `getByRole("menuitem", { name: "..." })` for menu items. **NEVER** use `getByTestId(...)` for menu items, even though `data-testid` attributes exist on `<MenuItem>` elements in the source code.

```typescript
// CORRECT — matches codebase convention
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.getByRole("menuitem", { name: "Rename" }).click();
await page.getByRole("menuitem", { name: "Revert" }).click();

// WRONG — do NOT use even though data-testid="delete-layout" exists in source
await page.getByTestId("delete-layout").click();
```

### Toggle Button State Assertions

```typescript
await expect(button).toHaveAttribute("aria-pressed", "true")
```

### Avoid

- MUI class names (e.g., `.MuiButton-root`) — unstable across builds
- CSS selectors with internal component structure
- XPath selectors
- `nth(0)` without context — be specific about which element you mean

### Hover-to-Reveal Elements (CSS `visibility: hidden`)

Some interactive elements have `visibility: hidden` and only appear on hover. You **must** hover the parent element before clicking the hidden child, or Playwright will time out.

**How to detect:** Read the component's `.style.ts` file and look for `visibility: "hidden"` rules tied to `:hover` pseudo-selectors.

**Example — layout row action buttons** (`LayoutRow.style.ts`):

The `layout-actions` button is hidden when a layout has no unsaved changes:

```css
".MuiListItemSecondaryAction-root": {
  visibility: !hasModifications && !deletedOnServer && "hidden",
},
"&:hover .MuiListItemSecondaryAction-root": {
  visibility: "visible",
},
```

**Correct pattern — hover before clicking:**

```typescript
const layoutRow = page.getByRole("listitem").filter({ hasText: name });
await layoutRow.hover();
await layoutRow.getByTestId("layout-actions").click();
await page.getByRole("menuitem", { name: "Delete" }).click();
```

**Exception:** When a layout HAS unsaved changes, the icon is always visible (it becomes the `unsaved-changes-icon`). The `revertLayout()` POM method skips hover because it only applies to modified layouts.

**General rule:** Before clicking any element that might be hidden, check the component's style file for visibility rules. If the element is conditionally hidden, add a `hover()` call on its container.

---

## Page Object Models (POMs)

Reusable UI abstractions live in `e2e/page-objects/`. Import from the barrel file:

```typescript
import { DataSourceDialog, Sidebar, PlayerControls, LayoutManager, ExtensionManager, AppMenu, Panels } from "../../../page-objects";
```

### Available POMs

All POMs live in `e2e/page-objects/` and are re-exported from `e2e/page-objects/index.ts`. **Before writing a test, read the barrel file and then read the specific POM file(s) you plan to use** to discover available methods and their signatures.

| POM | Purpose |
|-----|---------|
| `DataSourceDialog` | Data source dialog interactions |
| `Sidebar` | Left/right sidebar tabs |
| `PlayerControls` | Playback controls |
| `LayoutManager` | Layout CRUD (create, rename, delete, import, revert) |
| `ExtensionManager` | Extension install/uninstall workflows |
| `AppMenu` | App menu navigation |
| `Panels` | Panel add/configure operations |

### When to Use POMs vs Direct Selectors

- **Use POMs** for common, repeated interactions (dismissing dialogs, navigating sidebar, player controls)
- **Use direct selectors** for one-off, test-specific elements that don't appear across multiple tests

---

## Common Patterns

### Dismiss the startup dialog

```typescript
const dialog = new DataSourceDialog(mainWindow);
await dialog.close();
```

### Open the Layouts left sidebar

```typescript
const sidebar = new Sidebar(mainWindow);
await sidebar.openLayoutsTab();
```

### Load a file and start playback

```typescript
await loadFiles({ mainWindow, filenames: "example.mcap" });
await changeToEpochFormat(mainWindow);
const player = new PlayerControls(mainWindow);
await player.play();
```

### Open a file via CLI arguments

```typescript
import path from "path";

const filePath = path.resolve(process.cwd(), "e2e/fixtures/assets", "example.mcap");
test.use({ electronArgs: [`--source=${filePath}`] });
```

### Seek to a position via the slider

```typescript
const slider = mainWindow.getByRole("slider");
await slider.focus();
await slider.evaluate((el, value) => {
    (el as HTMLInputElement).value = String(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
}, targetValue);
```

### Context menus (right-click)

```typescript
await item.getByRole("button", { name: "Layout name" }).click({ button: "right" });
await expect(mainWindow.getByRole("menuitem", { name: "Rename" })).toBeVisible();
await mainWindow.keyboard.press("Escape"); // dismiss after assertion
```

### Layout action menu (hover-to-reveal)

For layout rows where the layout has no unsaved changes, the actions button is hidden until hover:

```typescript
// Full pattern: hover → actions → menu item → optional confirmation
const layoutRow = page.getByRole("listitem").filter({ hasText: "My Layout" });
await layoutRow.hover();
await layoutRow.getByTestId("layout-actions").click();
await page.getByRole("menuitem", { name: "Delete" }).click();

// Destructive actions show a confirmation dialog
await page.getByRole("button", { name: "Delete" }).click();
```

**Prefer the POM** when available:

```typescript
const layout = new LayoutManager(mainWindow);
await layout.deleteLayout("My Layout");   // handles hover + menu + confirm
await layout.renameLayout("Old", "New");  // handles hover + menu + fill + Enter
```

### Confirmation dialogs (destructive actions)

Destructive actions (Delete, Revert with confirm) show a confirmation dialog:
- Heading: e.g., `Delete "layoutName"?`
- Message: `This action cannot be undone.`
- Buttons: `getByRole("button", { name: "Delete" })` and `getByRole("button", { name: "Cancel" })`

Always use `getByRole("button", { name: "..." })` for confirmation buttons, not `getByTestId`.

### Multi-tab BroadcastChannel tests (web only)

```typescript
const context = await browser.newContext();
const page1 = await context.newPage();
const page2 = await context.newPage();
await page1.goto("http://localhost:8080");
await page2.goto("http://localhost:8080");
// ...
await context.close();
```

### Pre-install extensions for a test

```typescript
test.use({
    preInstalledExtensions: ["lichtblick.suite-extension-turtlesim-0.0.1"],
});
```

---

## Instrumentation: Adding `data-testid` to Source Components

When no stable selector exists for an interactive element, add a `data-testid` to the source component. You have `edit` tool access for this purpose.

### Rules

- Add `data-testid` only when: no existing `data-testid`, `getByRole` is ambiguous, and MUI class names are the only alternative.
- Place the attribute on the outermost interactive element (the actual `<button>`, `<input>`, etc.).
- For toggle buttons, also add `aria-pressed={booleanState}` for state assertions.
- **Do not** add `data-testid` to wrapper `<div>` elements — target the element that receives focus/click.
- Use kebab-case naming: `data-testid="loop-playback-button"`, not `data-testid="LoopPlaybackButton"`.

### Example — IconButton with toggle state

```tsx
<HoverableIconButton
    data-testid="loop-playback-button"
    aria-pressed={repeat}
    onClick={toggleRepeat}
    // ... other props
/>
```

### Example — Regular Button with on/off state

```tsx
<Button
    data-testid="sync-toggle-button"
    aria-pressed={syncInstances}
    onClick={toggleSync}
>
    Sync
</Button>
```

---

## Playwright MCP Usage

The MCP server is configured in `.mcp.json` (repo root) with `--isolated`, `--browser chrome`, `--codegen typescript`, and `--caps testing`.

### Workflow

> **MCP browser exploration is for WEB tests only.** Do not open a browser or
> use any MCP browser tools when writing desktop (Electron) tests. Desktop tests
> run headless via an Electron fixture — the MCP Chromium browser cannot drive
> Electron, selectors may differ, and using it adds unnecessary overhead.
> For desktop tests, discover selectors by reading source components and
> existing test files.

1. **Start the dev server** — `yarn web:serve` (for web tests)
2. **Open Copilot in Agent mode**
3. **Use MCP to explore the UI**:
   - Navigate to the target URL or state
   - Take accessibility snapshots to discover selectors
   - Interact with elements to verify behavior
   - Use `--caps testing` assertions to verify visibility
4. **Extract stable selectors** from the snapshot (prefer `data-testid` and role-based)
5. **Write the test** using verified selectors
6. **Run the test** to confirm it passes

### Key MCP Limitations

- MCP controls the **web** app (Chrome) — it **cannot drive the Electron desktop app**
- **Do not use MCP for desktop tests** — desktop test selectors must be discovered by reading existing desktop test files, Page Object Models (`e2e/page-objects/`), and source components. The Chromium browser controlled by MCP is not equivalent to the Electron runtime used by desktop tests.
- MCP `browser_run_code` does not have access to Node.js globals (`process`, `require`) — use absolute paths or avoid file operations in code snippets
- Screenshots and snapshots are saved under `.playwright-mcp/` (gitignored)

---

## Test Commands

```bash
yarn test:e2e:web                          # All web E2E tests
yarn test:e2e:web:debug                    # Debug mode (headed)
yarn test:e2e:desktop                      # All desktop E2E tests
yarn test:e2e:desktop:debug <filter>       # Debug a single test by filename fragment
yarn test:e2e:desktop:ci                   # Headless CI mode
```

---
name: test-conventions
description: Shared test conventions for all testing agents in the Lichtblick repo. Defines GWT pattern, core quality rules, and the standard test-writing workflow.
---

# Test Conventions

Applies to **all** test agents (unit tests, E2E tests).

---

## Given-When-Then (GWT)

Every test body **must** include GWT section comments.

### Block-comment style (Desktop / E2E)

```typescript
/**
 * GIVEN a .mcap file is loaded
 * WHEN play button is clicked
 * THEN playback time should advance
 */
test("should start playing when clicking on Play button", async ({ mainWindow }) => {
    // Given
    await loadFiles({ mainWindow, filenames: "example.mcap" });
    const button = mainWindow.getByTestId("play-button");

    // When
    await button.click();

    // Then
    await expect(button).toHaveAttribute("title", "Pause");
});
```

### Inline comment style (Unit tests)

```typescript
it("should return the layout when ID is valid", async () => {
    // Given
    const layout = LayoutBuilder.layout();
    // When
    const result = await service.findOne(layout.id);
    // Then
    expect(result).toEqual(layout);
});
```

---

## Core Quality Rules

1. **One logical assertion per test** — split complex scenarios into separate `test()` / `it()` blocks.
2. **Mock external dependencies, never business logic** — mock file I/O, IPC, HTTP clients; test the real code under test.
3. **Use existing builders and fixtures** — never create raw test data inline when a builder or fixture exists.
4. **Match sibling test structure exactly** — same import style, same fixture usage, same GWT comment format as existing tests in the same directory.
5. **Run tests after writing** — execute to verify they pass before presenting results.
6. **No `any`** — use proper TypeScript types in all test code.
7. **Always read before writing** — read the source file AND at least one existing sibling test file before generating new tests.

---

## Test-Writing Workflow

1. **Read the source file** — understand the component or feature under test.
2. **Read an existing sibling test** — match the exact import style, fixture setup, and GWT comment format.
3. **Identify available builders / fixtures** — check `testing/builders/` (unit), `e2e/fixtures/` (E2E), and `e2e/page-objects/` (E2E).
4. **Write tests** covering:
   - Happy path (valid input → expected outcome)
   - Edge cases (boundary values, empty state)
   - Error paths (invalid state → expected failure behavior)
5. **Run the tests** to confirm they pass.
6. **Report** which scenarios are covered and flag any missing edge cases.

---

## Test Naming

### TypeScript (Unit tests — Jest)

- Describe blocks: `describe('ComponentName')` → `describe('methodOrBehavior')`
- Test titles: `it('should <expected outcome> when <condition>')`

### TypeScript (E2E tests — Playwright)

- Top-level `test()` with a descriptive title: `"should <expected outcome> when <condition>"`
- Use a block-comment JSDoc above the test for the full GWT scenario description

---

## Cleanup

### Jest (unit tests)

```typescript
afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});
```

### Playwright (E2E)

- Each test gets an isolated app/page via fixtures — no manual cleanup needed between tests
- If a test opens a dialog or modifies shared state, restore it at the end of that test

---

## Error Testing

### Jest

```typescript
await expect(service.create(dto)).rejects.toThrow(SomeException);
```

### Playwright

```typescript
await expect(page.getByRole("alert")).toBeVisible();
await expect(page.getByText("Error message")).toBeVisible();
```

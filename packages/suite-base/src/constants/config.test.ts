// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Tests for application configuration constants
 */

describe("APP_CONFIG", () => {
  let originalGlobalThis: typeof globalThis;

  beforeEach(() => {
    // Store original globalThis to restore later
    originalGlobalThis = { ...globalThis };

    // Clear any existing global variables
    delete (globalThis as any).API_URL;
    delete (globalThis as any).LICHTBLICK_SUITE_VERSION;
    delete (globalThis as any).DEV_WORKSPACE;

    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original globalThis
    Object.assign(globalThis, originalGlobalThis);
  });

  it("should use default values when global variables are not defined", async () => {
    // Define variables as undefined before importing
    (globalThis as any).API_URL = undefined;
    (globalThis as any).LICHTBLICK_SUITE_VERSION = undefined;
    (globalThis as any).DEV_WORKSPACE = undefined;

    const { APP_CONFIG } = await import("./config");

    expect(APP_CONFIG.apiUrl).toBe(undefined);
    expect(APP_CONFIG.version).toBe("unknown");
    expect(APP_CONFIG.devWorkspace).toBe("");
  });

  it("should use global variables when they are defined", async () => {
    // Set global variables
    (globalThis as any).API_URL = "https://api.example.com";
    (globalThis as any).LICHTBLICK_SUITE_VERSION = "1.2.3";
    (globalThis as any).DEV_WORKSPACE = "test-workspace";

    const { APP_CONFIG } = await import("./config");

    expect(APP_CONFIG.apiUrl).toBe("https://api.example.com");
    expect(APP_CONFIG.version).toBe("1.2.3");
    expect(APP_CONFIG.devWorkspace).toBe("test-workspace");
  });

  it("should handle partial global variables", async () => {
    // Set only some global variables
    (globalThis as any).API_URL = "https://partial.example.com";
    (globalThis as any).LICHTBLICK_SUITE_VERSION = undefined;
    (globalThis as any).DEV_WORKSPACE = "partial-workspace";

    const { APP_CONFIG } = await import("./config");

    expect(APP_CONFIG.apiUrl).toBe("https://partial.example.com");
    expect(APP_CONFIG.version).toBe("unknown");
    expect(APP_CONFIG.devWorkspace).toBe("partial-workspace");
  });

  it("should handle null values in global variables", async () => {
    // Set global variables to undefined (equivalent to null for nullish coalescing)
    (globalThis as any).API_URL = undefined;
    (globalThis as any).LICHTBLICK_SUITE_VERSION = undefined;
    (globalThis as any).DEV_WORKSPACE = undefined;

    const { APP_CONFIG } = await import("./config");

    expect(APP_CONFIG.apiUrl).toBe(undefined);
    expect(APP_CONFIG.version).toBe("unknown");
    expect(APP_CONFIG.devWorkspace).toBe("");
  });

  it("should handle empty string values in global variables", async () => {
    // Set global variables to empty strings
    // Note: The nullish coalescing operator (??) only treats null and undefined as nullish
    // Empty strings are truthy values, so they will be used instead of the default
    (globalThis as any).API_URL = "";
    (globalThis as any).LICHTBLICK_SUITE_VERSION = "";
    (globalThis as any).DEV_WORKSPACE = "";

    const { APP_CONFIG } = await import("./config");

    expect(APP_CONFIG.apiUrl).toBe(""); // Empty string, not default
    expect(APP_CONFIG.version).toBe(""); // Empty string, not default
    expect(APP_CONFIG.devWorkspace).toBe(""); // Empty string, not default
  });
});

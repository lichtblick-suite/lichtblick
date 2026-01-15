// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

/**
 * Tests for browser storage keys
 */

describe("browserStorageKeys", () => {
  let originalGlobalThis: typeof globalThis;

  beforeEach(() => {
    // Store original globalThis to restore later
    originalGlobalThis = { ...globalThis };

    // Clear any existing global variables
    delete (globalThis as any).DEV_WORKSPACE;

    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original globalThis
    Object.assign(globalThis, originalGlobalThis);
  });

  it("should generate keys without workspace prefix when DEV_WORKSPACE is not set", async () => {
    // Define DEV_WORKSPACE as undefined before importing
    (globalThis as any).DEV_WORKSPACE = undefined;

    const storageKeys = await import("./browserStorageKeys");

    expect(storageKeys.KEY_WORKSPACE_PREFIX).toBe("");
    expect(storageKeys.LOCAL_STORAGE_STUDIO_LAYOUT_KEY).toBe("studio.layout");
    expect(storageKeys.LOCAL_STORAGE_PROFILE_DATA).toBe("studio.profile-data");
    expect(storageKeys.LOCAL_STORAGE_APP_CONFIGURATION).toBe("studio.app-configuration.");
    expect(storageKeys.SESSION_STORAGE_LOGS_SETTINGS).toBe("blick.logs-settings");
    expect(storageKeys.SESSION_STORAGE_LICHTBLICK_WORKSPACE).toBe("fox.workspace");
    expect(storageKeys.SESSION_STORAGE_I18N_LANGUAGE).toBe("i18nextLng");
  });

  it("should generate keys with workspace prefix when DEV_WORKSPACE is set", async () => {
    // Set DEV_WORKSPACE
    const randomWorkspace = BasicBuilder.string();
    (globalThis as any).DEV_WORKSPACE = randomWorkspace;

    const storageKeys = await import("./browserStorageKeys");

    expect(storageKeys.KEY_WORKSPACE_PREFIX).toBe(`${randomWorkspace}.`);
    expect(storageKeys.LOCAL_STORAGE_STUDIO_LAYOUT_KEY).toBe(`${randomWorkspace}.studio.layout`);
    expect(storageKeys.LOCAL_STORAGE_PROFILE_DATA).toBe(`${randomWorkspace}.studio.profile-data`);
    expect(storageKeys.LOCAL_STORAGE_APP_CONFIGURATION).toBe(
      `${randomWorkspace}.studio.app-configuration.`,
    );
    expect(storageKeys.SESSION_STORAGE_LOGS_SETTINGS).toBe(
      `${randomWorkspace}.blick.logs-settings`,
    );
    expect(storageKeys.SESSION_STORAGE_LICHTBLICK_WORKSPACE).toBe(
      `${randomWorkspace}.fox.workspace`,
    );
    expect(storageKeys.SESSION_STORAGE_I18N_LANGUAGE).toBe(`${randomWorkspace}.i18nextLng`);
  });

  it("should handle empty string DEV_WORKSPACE", async () => {
    // Set DEV_WORKSPACE to empty string
    (globalThis as any).DEV_WORKSPACE = "";

    const storageKeys = await import("./browserStorageKeys");

    expect(storageKeys.KEY_WORKSPACE_PREFIX).toBe("");
    expect(storageKeys.LOCAL_STORAGE_STUDIO_LAYOUT_KEY).toBe("studio.layout");
    expect(storageKeys.LOCAL_STORAGE_PROFILE_DATA).toBe("studio.profile-data");
    expect(storageKeys.LOCAL_STORAGE_APP_CONFIGURATION).toBe("studio.app-configuration.");
    expect(storageKeys.SESSION_STORAGE_LOGS_SETTINGS).toBe("blick.logs-settings");
    expect(storageKeys.SESSION_STORAGE_LICHTBLICK_WORKSPACE).toBe("fox.workspace");
    expect(storageKeys.SESSION_STORAGE_I18N_LANGUAGE).toBe("i18nextLng");
  });

  it("should have consistent storage key naming patterns", async () => {
    // Define DEV_WORKSPACE as undefined to test default behavior
    (globalThis as any).DEV_WORKSPACE = undefined;

    const storageKeys = await import("./browserStorageKeys");

    // Test that all local storage keys are properly defined
    expect(typeof storageKeys.LOCAL_STORAGE_STUDIO_LAYOUT_KEY).toBe("string");
    expect(typeof storageKeys.LOCAL_STORAGE_PROFILE_DATA).toBe("string");
    expect(typeof storageKeys.LOCAL_STORAGE_APP_CONFIGURATION).toBe("string");

    // Test that all session storage keys are properly defined
    expect(typeof storageKeys.SESSION_STORAGE_LOGS_SETTINGS).toBe("string");
    expect(typeof storageKeys.SESSION_STORAGE_LICHTBLICK_WORKSPACE).toBe("string");
    expect(typeof storageKeys.SESSION_STORAGE_I18N_LANGUAGE).toBe("string");
  });
});

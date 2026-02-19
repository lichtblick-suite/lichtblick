/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import i18n from "i18next";

import { defaultNS, initI18n, Language, sharedI18nObject, translations } from "./index";
import { SESSION_STORAGE_I18N_LANGUAGE } from "../constants/browserStorageKeys";

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

// Mock navigator.language
Object.defineProperty(navigator, "language", {
  value: "en-US",
  configurable: true,
});

describe("i18n module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(undefined);
    mockSessionStorage.getItem.mockReturnValue(undefined);
  });

  describe("exports", () => {
    it("When checking Language type, Then it should include 'en' as valid language", () => {
      // Given When
      const languages = Object.keys(translations) as Language[];

      // Then
      expect(languages).toContain("en");
    });
  });

  describe("initI18n function", () => {
    describe("Given browser context", () => {
      it("When initI18n is called without options, Then it should initialize with browser defaults", async () => {
        // Given When
        await initI18n();

        // Then
        expect(i18n.isInitialized).toBe(true);
        expect(i18n.language).toBeDefined();
        expect(i18n.options.fallbackLng).toEqual(["en"]);
        expect(i18n.options.defaultNS).toBe("general");
        expect(i18n.options.interpolation?.escapeValue).toBe(false);
      });

      it("When initI18n is called with browser context explicitly, Then it should use language detection", async () => {
        // Given
        const options = { context: "browser" as const };

        // When
        await initI18n(options);

        // Then
        expect(i18n.isInitialized).toBe(true);
        expect(i18n.options.detection).toBeDefined();
        expect(i18n.options.detection?.order).toContain("localStorage");
        expect(i18n.options.detection?.order).toContain("navigator");
      });

      it("When initI18n is called with browser context, Then it should configure localStorage detection", async () => {
        // Given
        const options = { context: "browser" as const };

        // When
        await initI18n(options);

        // Then
        expect(i18n.options.detection?.caches).toContain("localStorage");
        expect(i18n.options.detection?.lookupLocalStorage).toBe(SESSION_STORAGE_I18N_LANGUAGE);
        expect(i18n.options.detection?.lookupSessionStorage).toBe(SESSION_STORAGE_I18N_LANGUAGE);
      });
    });

    describe("Given electron-main context", () => {
      it("When initI18n is called with electron-main context, Then it should not use language detection", async () => {
        // Given
        const options = { context: "electron-main" as const };

        // When
        await initI18n(options);

        // Then
        expect(i18n.isInitialized).toBe(true);
        expect(i18n.options.detection).toBeUndefined();
        expect(i18n.language).toMatch(/^en/);
      });

      it("When initI18n is called with electron-main context, Then it should still configure basic options", async () => {
        // Given
        const options = { context: "electron-main" as const };

        // When
        await initI18n(options);

        // Then
        expect(i18n.options.resources).toBe(translations);
        expect(i18n.options.fallbackLng).toEqual(["en"]);
        expect(i18n.options.defaultNS).toBe("general");
        expect(i18n.options.interpolation?.escapeValue).toBe(false);
      });
    });

    describe("Given translations resources", () => {
      it("When initI18n is called, Then it should load English translations correctly", async () => {
        // Given When
        await initI18n();

        // Then
        expect(i18n.hasResourceBundle("en", "general")).toBe(true);
        expect(i18n.getResourceBundle("en", "general")).toBeDefined();
      });

      it("When initI18n is called, Then it should set correct fallback language", async () => {
        // Given When
        await initI18n();

        // Then
        expect(i18n.options.fallbackLng).toEqual(["en"]);
        expect(i18n.language).toMatch(/^en/);
      });
    });

    describe("Given React integration", () => {
      it("When initI18n is called with browser context, Then it should integrate with React", async () => {
        // Given
        const options = { context: "browser" as const };

        // When
        await initI18n(options);

        // Then
        expect(i18n.isInitialized).toBe(true);
        // The React integration is handled by initReactI18next plugin
        // which is used internally, so we verify initialization completed
      });
    });

    describe("Given error scenarios", () => {
      it("When initI18n is called multiple times, Then it should handle re-initialization gracefully", async () => {
        // Given
        await initI18n();
        const firstInitState = i18n.isInitialized;

        // When
        await initI18n();

        // Then
        expect(firstInitState).toBe(true);
        expect(i18n.isInitialized).toBe(true);
      });

      it("When initI18n is called with invalid context, Then it should not use browser detection", async () => {
        // Given
        const options = { context: "invalid" as any };

        // When
        await initI18n(options);

        // Then
        expect(i18n.isInitialized).toBe(true);
        expect(i18n.options.detection).toBeUndefined();
      });
    });
  });

  describe("configuration constants", () => {
    it("When checking cache configuration, Then it should use localStorage for caching", async () => {
      // Given
      await initI18n({ context: "browser" });

      // When
      const detectionOptions = i18n.options.detection;

      // Then
      expect(detectionOptions?.caches).toContain("localStorage");
    });
  });

  describe("integration scenarios", () => {
    describe("Given a complete initialization", () => {
      it("When i18n is fully initialized, Then it should be ready for translation usage", async () => {
        // Given
        await initI18n();

        // When
        const isReady = i18n.isInitialized;
        const hasEnglish = i18n.hasResourceBundle("en", defaultNS);

        // Then
        expect(isReady).toBe(true);
        expect(hasEnglish).toBe(true);
        expect(i18n.language).toBeDefined();
        expect(i18n.t).toBeDefined();
      });

      it("When using the shared i18n object, Then it should reference the same instance", async () => {
        // Given
        await initI18n();

        // When
        const sharedInstance = sharedI18nObject;
        const directInstance = i18n;

        // Then
        expect(sharedInstance).toBe(directInstance);
        expect(sharedInstance.isInitialized).toBe(directInstance.isInitialized);
      });
    });
  });
});

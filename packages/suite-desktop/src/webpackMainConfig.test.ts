// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { WebpackArgv } from "@lichtblick/suite-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";
import { webpackMainConfig } from "./webpackMainConfig";

function createTestParams(overrides: Partial<WebpackConfigParams> = {}): WebpackConfigParams {
  return {
    packageJson: {
      productName: "Test Product",
      name: "test-product",
      version: "1.0.0",
      description: "Test Description",
      productDescription: "Test Product Description",
      license: "MPL-2.0",
      author: { name: "Test Author", email: "test@example.com" },
      homepage: "https://example.com",
    },
    mainContext: "/test/main",
    mainEntrypoint: "./index.ts",
    rendererContext: "/test/renderer",
    rendererEntrypoint: "./index.tsx",
    quicklookContext: "/test/quicklook",
    quicklookEntrypoint: "./index.ts",
    preloadContext: "/test/preload",
    preloadEntrypoint: "./index.ts",
    outputPath: "/test/output",
    prodSourceMap: "source-map",
    ...overrides,
  };
}

jest.mock("webpack", () => {
  const original = jest.requireActual("webpack");
  return {
    ...original,
    DefinePlugin: jest.fn().mockImplementation((defs) => ({
      pluginName: "DefinePlugin",
      definitions: defs,
    })),
  };
});

describe("webpackMainConfig", () => {
  describe("development mode", () => {
    it("should configure webpack for development with source maps", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "development",
        env: {},
      };

      // When
      const config = webpackMainConfig(params)({}, argv);

      // Then
      expect(config.mode).toBeUndefined();
      expect(config.devtool).toBe("eval-cheap-module-source-map");
      expect(config.target).toBe("electron-main");
    });

    it("should include electron-devtools-installer in development", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "development",
        env: {},
      };

      // When
      const config = webpackMainConfig(params)({}, argv);

      // Then
      expect(config.resolve?.alias).toBeUndefined();
    });
  });

  describe("production mode", () => {
    it("should configure webpack for production with minification", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "production",
        env: {},
      };

      // When
      const config = webpackMainConfig(params)({}, argv);

      // Then
      expect(config.devtool).toBe("source-map");
      expect(config.optimization?.minimizer).toBeDefined();
      expect(config.optimization?.removeAvailableModules).toBe(true);
    });

    it("should stub out electron-devtools-installer in production", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "production",
        env: {},
      };

      // When
      const config = webpackMainConfig(params)({}, argv);

      // Then
      expect(config.resolve?.alias).toEqual({
        "electron-devtools-installer": false,
      });
    });
  });

  describe("configuration output", () => {
    it("should configure correct entry and output paths", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "development",
        env: {},
      };

      // When
      const config = webpackMainConfig(params)({}, argv);

      // Then
      expect(config.context).toBe("/test/main");
      expect(config.entry).toBe("./index.ts");
      expect(config.output?.path).toContain("main");
    });
  });
});

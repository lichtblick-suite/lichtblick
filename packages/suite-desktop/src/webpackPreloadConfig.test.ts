// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { WebpackArgv } from "@lichtblick/suite-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";
import { webpackPreloadConfig } from "./webpackPreloadConfig";

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

jest.mock("./webpackCommonConfig", () => ({
  createCommonWebpackConfig: jest.fn().mockImplementation((_params, { isDev }) => ({
    devtool: (isDev as boolean) ? "eval-cheap-module-source-map" : "source-map",
    plugins: [{ pluginName: "MockPlugin" }],
  })),
}));

describe("webpackPreloadConfig", () => {
  describe("development mode", () => {
    it("should configure webpack for preload in development mode", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "development",
        env: {},
      };

      // When
      const config = webpackPreloadConfig(params)({}, argv);

      // Then
      expect(config.target).toBe("electron-preload");
      expect(config.devtool).toBe("eval-cheap-module-source-map");
      expect(config.context).toBe("/test/preload");
      expect(config.entry).toBe("./index.ts");
      expect(config.output?.filename).toBe("preload.js");
      expect(config.output?.path).toBe(path.join("/test/output", "main"));
    });
  });

  describe("production mode", () => {
    it("should configure webpack for preload in production mode", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "production",
        env: {},
      };

      // When
      const config = webpackPreloadConfig(params)({}, argv);

      // Then
      expect(config.target).toBe("electron-preload");
      expect(config.devtool).toBe("source-map");
      expect(config.output?.filename).toBe("preload.js");
      expect(config.output?.publicPath).toBe("");
      expect(config.output?.path).toBe(path.join("/test/output", "main"));
    });
  });

  describe("common config integration", () => {
    it("should merge common webpack config correctly", () => {
      // Given
      const params = createTestParams();
      const argv: WebpackArgv = {
        mode: "development",
        env: {},
      };

      // When
      const config = webpackPreloadConfig(params)({}, argv);

      // Then
      expect(config.plugins).toEqual([{ pluginName: "MockPlugin" }]);
      expect(config.devtool).toBe("eval-cheap-module-source-map");
    });
  });
});

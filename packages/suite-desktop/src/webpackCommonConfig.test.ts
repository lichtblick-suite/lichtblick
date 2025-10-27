// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { WebpackConfigParams } from "./WebpackConfigParams";
import { createCommonWebpackConfig } from "./webpackCommonConfig";

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

// --- mock other heavy plugins ---
jest.mock("esbuild-loader", () => ({
  EsbuildPlugin: jest.fn().mockImplementation((opts) => ({
    pluginName: "EsbuildPlugin",
    options: opts,
  })),
}));

jest.mock("fork-ts-checker-webpack-plugin", () =>
  jest.fn().mockImplementation(() => ({
    pluginName: "ForkTsCheckerWebpackPlugin",
  })),
);

describe("createCommonWebpackConfig", () => {
  it("should configure development mode with source maps", () => {
    // Given
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: true });

    // Then
    expect(config.devtool).toBe("eval-cheap-module-source-map");
    expect(config.resolve?.extensions).toContain(".tsx");
    expect((config.module?.rules?.[0] as any).use.loader).toBe("ts-loader");
  });

  it("should configure production mode with esbuild minification", () => {
    // Given
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: false });

    // Then
    expect(config.devtool).toBe("source-map");
    expect((config.optimization?.minimizer?.[0] as any).pluginName).toBe("EsbuildPlugin");
    expect(config.optimization?.removeAvailableModules).toBe(true);
  });

  it("should inject DefinePlugin with product metadata", () => {
    // Given
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: true });
    const plugins = config.plugins as any[];
    const definePlugin = plugins.find((p) => p.pluginName === "DefinePlugin");

    // Then
    expect(definePlugin).toBeDefined();
    const defs = definePlugin.definitions;

    expect(defs.LICHTBLICK_PRODUCT_NAME).toBe(JSON.stringify("Test Product"));
    expect(defs.LICHTBLICK_PRODUCT_VERSION).toBe(JSON.stringify("1.0.0"));
    expect(defs.LICHTBLICK_PRODUCT_HOMEPAGE).toBe(JSON.stringify("https://example.com"));
  });

  it("should include ForkTsCheckerWebpackPlugin", () => {
    // Given
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: true });
    const plugins = config.plugins as any[];

    // Then
    const hasForkTs = plugins.some((p) => p.pluginName === "ForkTsCheckerWebpackPlugin");
    expect(hasForkTs).toBe(true);
  });

  it("should propagate API_URL and DEV_WORKSPACE from environment if set", () => {
    // Given
    process.env.API_URL = "https://api.example.com";
    (process.env as any).DEV_WORKSPACE = "workspace-1";
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: true });
    const definePlugin = (config.plugins as any[]).find((p) => p.pluginName === "DefinePlugin");

    // Then
    expect(definePlugin.definitions.API_URL).toBe(JSON.stringify("https://api.example.com"));
    expect(definePlugin.definitions.DEV_WORKSPACE).toBe(JSON.stringify("workspace-1"));
  });

  it("should leave API_URL and DEV_WORKSPACE undefined if not set", () => {
    // Given
    delete process.env.API_URL;
    delete (process.env as any).DEV_WORKSPACE;
    const params = createTestParams();

    // When
    const config = createCommonWebpackConfig(params, { isDev: true });
    const definePlugin = (config.plugins as any[]).find((p) => p.pluginName === "DefinePlugin");

    // Then
    expect(definePlugin.definitions.API_URL).toBeUndefined();
    expect(definePlugin.definitions.DEV_WORKSPACE).toBeUndefined();
  });
});

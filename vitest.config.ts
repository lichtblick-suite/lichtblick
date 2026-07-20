// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import react from "@vitejs/plugin-react";
import path from "node:path";
import type { PluginOption } from "vite";
import babel from "vite-plugin-babel";
import { defineConfig, type ViteUserConfig } from "vitest/config";

import { assetMocksPlugin, nearleyPlugin, rawBinaryPlugin } from "./vitest.plugins";

const rootDir = __dirname;
const suiteBaseDir = path.join(rootDir, "packages/suite-base");

// Webpack DefinePlugin globals mirrored for tests (formerly Jest `globals`).
const define = {
  ReactNull: "null",
  LICHTBLICK_SUITE_VERSION: JSON.stringify("TEST"),
  API_URL: JSON.stringify("/"),
  DEV_WORKSPACE: JSON.stringify(""),
};

/**
 * Reproduces the Jest `babel-jest` pipeline (babel.config.json) minus the
 * CommonJS/import-meta transforms, which Vite/Vitest handle natively via ESM.
 * Retains the syntax plugins the codebase relies on: legacy decorators,
 * explicit resource management, and private methods.
 */
function lichtblickBabel(): PluginOption {
  return babel({
    include: /\.[jt]sx?$/,
    exclude: /node_modules/,
    babelConfig: {
      babelrc: false,
      configFile: false,
      presets: [["@babel/preset-typescript", { allowDeclareFields: true }], "@babel/preset-react"],
      plugins: [
        ["@babel/plugin-proposal-decorators", { version: "legacy" }],
        "@babel/plugin-proposal-explicit-resource-management",
        "@babel/plugin-transform-private-methods",
      ],
    },
  });
}

/** Plugins shared across every project. */
function sharedPlugins(): PluginOption[] {
  return [react({ jsxRuntime: "classic" }), lichtblickBabel(), nearleyPlugin(), rawBinaryPlugin()];
}

const suiteBaseAlias = {
  // Deep imports `@lichtblick/suite-base/<path>` resolve to source (formerly moduleNameMapper).
  find: /^@lichtblick\/suite-base\/(.*)$/,
  replacement: path.join(suiteBaseDir, "src/$1"),
};

type ProjectOptions = {
  name: string;
  root: string;
  include: string[];
  exclude?: string[];
  setupFiles?: string[];
  alias?: { find: string | RegExp; replacement: string }[];
  restoreMocks?: boolean;
  withAssetMocks?: boolean;
  testTimeout?: number;
};

function makeProject(options: ProjectOptions): ViteUserConfig {
  const plugins = sharedPlugins();
  if (options.withAssetMocks ?? false) {
    plugins.push(
      assetMocksPlugin({
        svg: path.join(suiteBaseDir, "src/test/mocks/MockSvg.tsx"),
        css: path.join(suiteBaseDir, "src/test/mocks/MockCss.ts"),
        file: path.join(suiteBaseDir, "src/test/mocks/fileMock.ts"),
        monacoEditor: path.join(suiteBaseDir, "src/test/stubs/MonacoEditor.tsx"),
      }),
    );
  }

  return {
    plugins,
    define,
    resolve: { alias: options.alias ?? [] },
    test: {
      name: options.name,
      root: options.root,
      globals: true,
      environment: "node",
      include: options.include,
      exclude: ["**/node_modules/**", "**/dist/**", ...(options.exclude ?? [])],
      setupFiles: options.setupFiles ?? [],
      restoreMocks: options.restoreMocks ?? false,
      testTimeout: options.testTimeout,
    },
  };
}

export default defineConfig({
  define,
  test: {
    coverage: {
      provider: "v8",
      reportsDirectory: path.join(rootDir, "coverage"),
      reporter: ["text", "json", "lcov", "clover", "html"],
    },
    projects: [
      makeProject({
        name: "suite-base",
        root: suiteBaseDir,
        include: ["src/**/*.test.{ts,tsx}"],
        withAssetMocks: true,
        restoreMocks: false,
        alias: [suiteBaseAlias],
        setupFiles: [
          path.join(suiteBaseDir, "src/test/setup.ts"),
          path.join(suiteBaseDir, "src/test/setupCanvasMock.ts"),
          "fake-indexeddb/auto",
          path.join(suiteBaseDir, "src/test/setupTestFramework.ts"),
        ],
      }),
      makeProject({
        name: "hooks",
        root: path.join(rootDir, "packages/hooks"),
        include: ["src/**/*.test.{ts,tsx}"],
        setupFiles: [path.join(rootDir, "packages/hooks/test/setup.ts")],
      }),
      makeProject({
        name: "message-path",
        root: path.join(rootDir, "packages/message-path"),
        include: ["src/**/*.test.{ts,tsx}"],
      }),
      makeProject({
        name: "mcap-support",
        root: path.join(rootDir, "packages/mcap-support"),
        include: ["src/**/*.test.{ts,tsx}"],
      }),
      makeProject({
        name: "den",
        root: path.join(rootDir, "packages/den"),
        include: ["**/*.test.{ts,tsx}"],
      }),
      makeProject({
        name: "eslint-plugin-suite",
        root: path.join(rootDir, "packages/eslint-plugin-suite"),
        include: ["**/*.test.{ts,tsx}"],
        testTimeout: 30_000,
      }),
      makeProject({
        name: "typescript-transformers",
        root: path.join(rootDir, "packages/typescript-transformers"),
        include: ["src/**/*.test.{ts,tsx}"],
      }),
      makeProject({
        name: "suite-desktop",
        root: path.join(rootDir, "packages/suite-desktop"),
        include: ["src/**/*.test.{ts,tsx}"],
        setupFiles: [path.join(rootDir, "packages/suite-desktop/src/test/setup.ts")],
      }),
    ],
  },
});

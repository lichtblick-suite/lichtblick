// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "node:path";
import { Configuration } from "webpack";

import type { WebpackArgv } from "../packages/suite-base/WebpackArgv";
import { makeConfig } from "../packages/suite-base/webpack";

// This is a standalone Electron shell for the benchmark app, separate from the production
// `desktop/` shell. It intentionally does not depend on `@lichtblick/suite-desktop` (auto-update,
// native menus, deep-link handling, extension loading, etc. are not relevant for a memory
// benchmark harness) -- it is only a `BrowserWindow` that renders `benchmark/src/Root.tsx` plus a
// preload bridge exposing Electron process memory metrics for the Playwright benchmark suite.

const outputPath = path.resolve(__dirname, ".webpack-desktop");

// Cleans the output directory once and writes the `package.json` that Electron reads to find its
// main entry point when launched with `electron <outputPath>`. Named so the other configs can
// declare it as a `dependencies` entry, forcing webpack to run cleanup before their compilers
// start (they run in parallel otherwise, which can delete output emitted by a sibling compiler).
const rootConfig = (_env: unknown, _argv: WebpackArgv): Configuration => ({
  name: "root",
  entry: {},
  output: {
    publicPath: "",
    path: outputPath,
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: "package.json",
      templateContent: JSON.stringify({
        main: "main/main.js",
        name: "lichtblick-benchmark-desktop",
        version: "0.0.0-benchmark",
      }),
    }),
  ],
});

const mainConfig = (_env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";

  return {
    name: "main",
    dependencies: ["root"],
    target: "electron-main",
    context: path.resolve(__dirname, "desktop/main"),
    entry: "./index.ts",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",
    output: {
      publicPath: "",
      path: path.join(outputPath, "main"),
    },
    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: { transpileOnly: true, onlyCompileBundledFiles: true },
          },
        },
      ],
    },
  };
};

const preloadConfig = (_env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";

  return {
    name: "preload",
    dependencies: ["root"],
    target: "electron-preload",
    context: path.resolve(__dirname, "desktop/preload"),
    entry: "./index.ts",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",
    output: {
      publicPath: "",
      filename: "preload.js",
      path: path.join(outputPath, "main"),
    },
    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: { transpileOnly: true, onlyCompileBundledFiles: true },
          },
        },
      ],
    },
  };
};

const rendererConfig = (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";

  const appWebpackConfig = makeConfig(env, argv, {
    allowUnusedVariables: isDev,
    version: "0.0.0-benchmark",
  });

  return {
    name: "renderer",
    ...appWebpackConfig,
    dependencies: ["root"],

    // force web target instead of electron-renderer
    // Fixes "require is not defined" errors since nodeIntegration is off
    // https://gist.github.com/msafi/d1b8571aa921feaaa0f893ab24bb727b
    target: "web",
    context: path.resolve(__dirname, "desktop/renderer"),
    entry: "./index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "",
      path: path.join(outputPath, "renderer"),
    },

    plugins: [
      ...(appWebpackConfig.plugins ?? []),
      new HtmlWebpackPlugin({
        templateContent: `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Lichtblick Benchmark (Desktop)</title>
    </head>
    <script>
      global = globalThis;
    </script>
    <body>
      <div id="root"></div>
    </body>
  </html>
  `,
      }),
    ],
  };
};

export default [rootConfig, mainConfig, preloadConfig, rendererConfig];

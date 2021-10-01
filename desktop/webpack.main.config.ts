// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration, ResolveOptions, DefinePlugin, EnvironmentPlugin } from "webpack";

import { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";

export default (_: unknown, argv: WebpackArgv): Configuration => {
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const isDev = argv.mode === "development";

  const resolve: ResolveOptions = {
    extensions: [".js", ".ts", ".tsx", ".json"],
  };

  if (!isDev) {
    // Stub out devtools installation for non-dev builds
    resolve.alias = {
      "electron-devtools-installer": false,
    };
  }

  // When running under a development server the renderer entry comes from the server.
  // When making static builds (for packaging), the renderer entry is a file on disk.
  // This switches between the two and is injected below via DefinePlugin as MAIN_WINDOW_WEBPACK_ENTRY
  const rendererEntry = isServe
    ? `"http://${argv.host ?? "localhost"}:8080/renderer/index.html"`
    : "`file://${require('path').join(__dirname, '..', 'renderer', 'index.html')}`";

  return {
    context: path.resolve(__dirname, "./main"),
    entry: "./index.ts",
    target: "electron-main",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "",
      path: path.resolve(__dirname, ".webpack", "main"),
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              // https://github.com/TypeStrong/ts-loader#onlycompilebundledfiles
              // avoid looking at files which are not part of the bundle
              onlyCompileBundledFiles: true,
              projectReferences: true,
            },
          },
        },
      ],
    },

    optimization: {
      removeAvailableModules: true,
      minimizer: [new ESBuildMinifyPlugin({ target: "es2020" })],
    },

    plugins: [
      new DefinePlugin({
        MAIN_WINDOW_WEBPACK_ENTRY: rendererEntry,
      }),
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null, // eslint-disable-line no-restricted-syntax
        SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? null, // eslint-disable-line no-restricted-syntax
        AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY ?? null, // eslint-disable-line no-restricted-syntax
        AUTH_URL: "https://foxglove.dev/auth?source=studio",
      }),
      new ForkTsCheckerWebpackPlugin(),
    ],

    resolve,
  };
};

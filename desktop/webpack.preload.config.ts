// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration, EnvironmentPlugin } from "webpack";

import { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";

export default (_: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";

  return {
    context: path.resolve(__dirname, "./preload"),
    entry: "./index.ts",
    target: "electron-preload",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "",
      filename: "preload.js",
      // Put the preload script in main since main becomes the "app path"
      // This simplifies setting the 'preload' webPrefereces option on BrowserWindow
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
      minimizer: [
        new ESBuildMinifyPlugin({
          target: "es2020",
          minifyIdentifiers: false, // readable error stack traces are helpful for debugging
          minifySyntax: true,
          minifyWhitespace: true,
        }),
      ],
    },

    plugins: [
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null, // eslint-disable-line no-restricted-syntax
        SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? null, // eslint-disable-line no-restricted-syntax
        AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY ?? null, // eslint-disable-line no-restricted-syntax
      }),
      new ForkTsCheckerWebpackPlugin(),
    ],

    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
    },
  };
};

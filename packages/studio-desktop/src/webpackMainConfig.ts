// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration, ResolveOptions, DefinePlugin } from "webpack";

import { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";

export const webpackMainConfig =
  (params: WebpackConfigParams) =>
  (_: unknown, argv: WebpackArgv): Configuration => {
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
      context: params.mainContext,
      entry: params.mainEntrypoint,
      target: "electron-main",
      devtool: isDev ? "eval-cheap-module-source-map" : params.prodSourceMap,

      output: {
        publicPath: "",
        path: path.join(params.outputPath, "main"),
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
            minify: true,
          }),
        ],
      },

      plugins: [
        new DefinePlugin({
          MAIN_WINDOW_WEBPACK_ENTRY: rendererEntry,
          FOXGLOVE_PRODUCT_NAME: JSON.stringify(params.packageJson.productName),
          FOXGLOVE_PRODUCT_VERSION: JSON.stringify(params.packageJson.version),
          FOXGLOVE_PRODUCT_HOMEPAGE: JSON.stringify(params.packageJson.homepage),
        }),
        new ForkTsCheckerWebpackPlugin(),
      ],

      resolve,
    };
  };

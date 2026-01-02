// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration } from "webpack";

import { WebpackArgv } from "@lichtblick/suite-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";

import "webpack-dev-server";

export const webpackDevServerConfig =
  (params: WebpackConfigParams) =>
  (_: unknown, argv: WebpackArgv): Configuration => {
    const isRelease = argv.mode === "production";

    // The appdata directory is derived from the product name. To have a separate directory
    // for our production and development builds we change the product name when using dev or serve.
    const productName = isRelease
      ? params.packageJson.productName
      : `${params.packageJson.productName} Dev`;

    return {
      // Use empty entry to avoid webpack default fallback to /src
      entry: {},

      // Output path must be specified here for HtmlWebpackPlugin within render config to work
      output: {
        publicPath: "",
        path: params.outputPath,
      },

      devServer: {
        static: {
          directory: params.outputPath,
        },
        devMiddleware: {
          writeToDisk: (filePath) => {
            // Electron needs to open the main thread source and preload source from disk
            // avoid writing the hot-update js and json files
            // allow writing package.json at root -> needed for electron to find entrypoint
            return /\.webpack[\\/]((main|extensions)[\\/](?!.*hot-update)|package\.json)/.test(
              filePath,
            );
          },
        },
        client: {
          overlay: {
            runtimeErrors: (error) => {
              // Suppress overlays for importScript errors from terminated webworkers.
              //
              // When a webworker is terminated, any pending `importScript` calls are cancelled by the
              // browser. These appear in the devtools network tab as "(cancelled)" and bubble up to the
              // parent page as errors which trigger `window.onerror`.
              //
              // webpack devserver attaches to the window error handler surface unhandled errors sent to
              // the page. However this kind of error is a false-positive for a worker that is
              // terminated because we do not care that its network requests were cancelled since the
              // worker itself is gone.
              //
              // Will this hide real importScript errors during development?
              // It is possible that a worker encounters this error during normal operation (if
              // importing a script does fail for a legitimate reason). In that case we expect the
              // worker logic that depended on the script to fail execution and trigger other kinds of
              // errors. The developer can still see the importScripts error in devtools console.
              if (
                error.message.startsWith(
                  `Uncaught NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope'`,
                )
              ) {
                return false;
              }

              return true;
            },
          },
        },
        hot: true,
        // The problem and solution are described at <https://github.com/webpack/webpack-dev-server/issues/1604>.
        // When running in dev mode two errors are logged to the dev console:
        //  "Invalid Host/Origin header"
        //  "[WDS] Disconnected!"
        // Since we are only connecting to localhost, DNS rebinding attacks are not a concern during dev
        allowedHosts: "all",
      },
      plugins: [
        new CleanWebpackPlugin(),
        // electron-packager needs a package.json file to indicate the entry script
        // We purpose the htmlwebpackplugin to write the json rather than an html file
        new HtmlWebpackPlugin({
          filename: "package.json",
          templateContent: JSON.stringify({
            main: "main/main.js",
            name: params.packageJson.name,
            productName,
            version: params.packageJson.version,
            description: params.packageJson.description,
            productDescription: params.packageJson.productDescription,
            license: params.packageJson.license,
            author: params.packageJson.author,
          }),
        }),
      ],
    };
  };

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dotenv from "dotenv";
import path from "path";
import { Configuration, DefinePlugin, ResolveOptions } from "webpack";

import { WebpackArgv } from "@lichtblick/suite-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";
import { createCommonWebpackConfig } from "./webpackCommonConfig";

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

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

    const common = createCommonWebpackConfig(params, { isDev });

    // When running under a development server the renderer entry comes from the server.
    // When making static builds (for packaging), the renderer entry is a file on disk.
    // This switches between the two and is injected below via DefinePlugin as MAIN_WINDOW_WEBPACK_ENTRY
    const rendererEntry = isServe
      ? `"http://${argv.host ?? "localhost"}:8080/renderer/index.html"`
      : "`file://${require('path').join(__dirname, '..', 'renderer', 'index.html')}`";

    return {
      ...common,
      context: params.mainContext,
      entry: params.mainEntrypoint,
      target: "electron-main",
      output: {
        publicPath: "",
        path: path.join(params.outputPath, "main"),
      },
      plugins: [
        ...(common.plugins ?? []),
        new DefinePlugin({
          MAIN_WINDOW_WEBPACK_ENTRY: rendererEntry,
        }),
      ],
      resolve,
    };
  };

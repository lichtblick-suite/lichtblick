// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dotenv from "dotenv";
import path from "path";
import { Configuration } from "webpack";

import { WebpackArgv } from "@lichtblick/suite-base/WebpackArgv";

import { WebpackConfigParams } from "./WebpackConfigParams";
import { createCommonWebpackConfig } from "./webpackCommonConfig";

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const webpackPreloadConfig =
  (params: WebpackConfigParams) =>
  (_: unknown, argv: WebpackArgv): Configuration => {
    const isDev = argv.mode === "development";
    const commonConfig = createCommonWebpackConfig(params, { isDev });

    return {
      ...commonConfig,
      context: params.preloadContext,
      entry: params.preloadEntrypoint,
      target: "electron-preload",
      output: {
        publicPath: "",
        filename: "preload.js",
        path: path.join(params.outputPath, "main"),
      },
    };
  };

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import dotenv from "dotenv";
import { EsbuildPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { DefinePlugin, Configuration } from "webpack";

import { WebpackConfigParams } from "./WebpackConfigParams";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export function createCommonWebpackConfig(
  params: WebpackConfigParams,
  { isDev }: { isDev: boolean },
): Partial<Configuration> {
  return {
    devtool: isDev ? "eval-cheap-module-source-map" : params.prodSourceMap,

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
        new EsbuildPlugin({
          target: "es2022",
          minify: true,
        }),
      ],
    },

    plugins: [
      new DefinePlugin({
        // Should match webpack-defines.d.ts
        ReactNull: null, // eslint-disable-line no-restricted-syntax
        LICHTBLICK_PRODUCT_NAME: JSON.stringify(params.packageJson.productName),
        LICHTBLICK_PRODUCT_VERSION: JSON.stringify(params.packageJson.version),
        LICHTBLICK_PRODUCT_HOMEPAGE: JSON.stringify(params.packageJson.homepage),
        LICHTBLICK_SUITE_VERSION: JSON.stringify(params.packageJson.version),
        API_URL: process.env.API_URL ? JSON.stringify(process.env.API_URL) : undefined,
        DEV_WORKSPACE: process.env.DEV_WORKSPACE
          ? JSON.stringify(process.env.DEV_WORKSPACE)
          : undefined,
      }),
      new ForkTsCheckerWebpackPlugin(),
    ],

    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
    },
  };
}

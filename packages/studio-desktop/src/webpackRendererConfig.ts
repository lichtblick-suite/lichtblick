// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import { ESBuildMinifyPlugin } from "esbuild-loader";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, WebpackPluginInstance } from "webpack";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { makeConfig } from "@foxglove/studio-base/webpack";

import { WebpackConfigParams } from "./WebpackConfigParams";

export const webpackRendererConfig =
  (params: WebpackConfigParams) =>
  (env: unknown, argv: WebpackArgv): Configuration => {
    const isDev = argv.mode === "development";
    const isServe = argv.env?.WEBPACK_SERVE ?? false;

    const allowUnusedVariables = isDev;

    const plugins: WebpackPluginInstance[] = [];

    if (isServe) {
      plugins.push(new ReactRefreshPlugin());
    }

    const appWebpackConfig = makeConfig(env, argv, {
      allowUnusedVariables,
      version: params.packageJson.version,
    });

    const config: Configuration = {
      ...appWebpackConfig,

      // force web target instead of electron-render
      // Fixes "require is not defined" errors if nodeIntegration is off
      // https://gist.github.com/msafi/d1b8571aa921feaaa0f893ab24bb727b
      target: "web",
      context: params.rendererContext,
      entry: params.rendererEntrypoint,
      devtool: isDev ? "eval-cheap-module-source-map" : params.prodSourceMap,

      output: {
        publicPath: isServe ? "/renderer/" : "",
        path: path.join(params.outputPath, "renderer"),
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
        ...plugins,
        ...(appWebpackConfig.plugins ?? []),
        new HtmlWebpackPlugin({
          templateContent: `
  <!doctype html>
  <html>
    <head><meta charset="utf-8"></head>
    <script>
      global = globalThis;
    </script>
    <style>
      html, body {
        background-color: #fdfdfd;
      }
      @media (prefers-color-scheme: dark) {
        html, body {
          background-color: #121217;
        }
      }
    </style>
    <body>
      <div id="root"></div>
    </body>
  </html>
  `,
        }),
      ],
    };

    return config;
  };

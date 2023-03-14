// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, WebpackPluginInstance } from "webpack";
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { makeConfig } from "@foxglove/studio-base/webpack";

interface WebpackConfiguration extends Configuration {
  devServer?: WebpackDevServerConfiguration;
}

const devServerConfig: WebpackConfiguration = {
  // Use empty entry to avoid webpack default fallback to /src
  entry: {},

  // Output path must be specified here for HtmlWebpackPlugin within render config to work
  output: {
    publicPath: "",
    path: path.resolve(__dirname, ".webpack"),
  },

  devServer: {
    static: {
      directory: path.resolve(__dirname, ".webpack"),
    },
    hot: true,
    // The problem and solution are described at <https://github.com/webpack/webpack-dev-server/issues/1604>.
    // When running in dev mode two errors are logged to the dev console:
    //  "Invalid Host/Origin header"
    //  "[WDS] Disconnected!"
    // Since we are only connecting to localhost, DNS rebinding attacks are not a concern during dev
    allowedHosts: "all",
  },

  plugins: [new CleanWebpackPlugin()],
};

const mainConfig = (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedVariables = isDev;

  const plugins: WebpackPluginInstance[] = [];

  if (isServe) {
    plugins.push(new ReactRefreshPlugin());
  }

  const appWebpackConfig = makeConfig(env, argv, { allowUnusedVariables });

  const config: Configuration = {
    name: "main",

    ...appWebpackConfig,

    target: "web",
    context: path.resolve(__dirname, "src"),
    entry: "./index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "auto",

      // Output filenames should include content hashes in order to cache bust when new versions are available
      filename: isDev ? "[name].js" : "[name].[contenthash].js",

      path: path.resolve(__dirname, ".webpack"),
    },

    plugins: [
      ...plugins,
      ...(appWebpackConfig.plugins ?? []),
      new HtmlWebpackPlugin({
        templateContent: `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Foxglove Studio Benchmark</title>
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

  return config;
};

export default [devServerConfig, mainConfig];

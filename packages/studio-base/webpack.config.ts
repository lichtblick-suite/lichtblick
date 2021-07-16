// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable filenames/match-exported */

import { CleanWebpackPlugin } from "clean-webpack-plugin";
import path from "path";
import { Configuration } from "webpack";

import { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { makeConfig } from "@foxglove/studio-base/webpack";

const mainConfig = (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const allowUnusedVariables = isDev;

  const appWebpackConfig = makeConfig(env, argv, { allowUnusedVariables });

  const config: Configuration = {
    ...appWebpackConfig,

    target: "web",
    context: path.resolve(__dirname, "src"),
    entry: "./index.ts",
    devtool: isDev ? "eval-cheap-module-source-map" : "inline-source-map",

    // There should only be one version of react (and react-dom) in a component tree
    // We expect the user to provide their version of react
    externals: {
      react: "react",
      "react-dom": "react-dom",
    },

    optimization: {
      minimize: false,
    },

    output: {
      publicPath: "",
      filename: "index.js",
      path: path.resolve(__dirname, "assets"),
      library: {
        type: "umd",
      },
    },

    plugins: [new CleanWebpackPlugin(), ...(appWebpackConfig.plugins ?? [])],
  };

  return config;
};

export default mainConfig;

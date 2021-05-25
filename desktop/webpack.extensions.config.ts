// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CopyPlugin from "copy-webpack-plugin";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import path from "path";
import { Configuration } from "webpack";

import { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";

export default (_: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedVariables = isDev && isServe;

  return {
    externals: {
      "@foxglove/studio": "FoxgloveStudio",
      react: "React",
      "react-dom": "ReactDOM",
    },

    context: path.resolve(__dirname, "..", "extensions"),
    entry: {
      "builtin/index": "./index.ts",
    },
    target: "web",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: "",
      path: path.resolve(__dirname, ".webpack", "extensions"),
      library: {
        type: "commonjs2",
      },
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
        {
          test: /\.s?css$/,
          loader: "style-loader",
          sideEffects: true,
        },
        {
          test: /\.(png|jpg|gif)$/i,
          type: "asset",
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
        },
        {
          test: /\.s?css$/,
          oneOf: [
            {
              test: /\.module\./,
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "[path][name]-[contenthash:base64:5]--[local]",
                },
                sourceMap: true,
              },
            },
            { loader: "css-loader", options: { sourceMap: true } },
          ],
        },
      ],
    },

    plugins: [
      new CopyPlugin({
        patterns: [{ from: "package.json", to: "builtin/[name][ext]" }],
      }),
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configOverwrite: {
            compilerOptions: {
              noUnusedLocals: !allowUnusedVariables,
              noUnusedParameters: !allowUnusedVariables,
            },
          },
        },
      }),
    ],

    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
      alias: {
        // prevent any imports from studio-base - extensions should import from @foxglove/studio
        "@foxglove/studio-base": false,
      },
    },
  };
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import ReactRefreshTypescript from "react-refresh-typescript";
import createStyledComponentsTransformer from "typescript-plugin-styled-components";
import { Configuration, ProvidePlugin } from "webpack";
import "webpack-dev-server";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";

const styledComponentsTransformer = createStyledComponentsTransformer({
  getDisplayName: (filename, bindingName) => {
    const sanitizedFilename = path.relative(__dirname, filename).replace(/[^a-zA-Z0-9_-]/g, "_");
    return bindingName != undefined ? `${bindingName}__${sanitizedFilename}` : sanitizedFilename;
  },
});

export default (_env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedVariables = isDev && isServe;

  return {
    name: "quicklook",

    context: path.resolve(__dirname, "./quicklook"),
    entry: "./index.tsx",
    target: "web",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: isServe ? "/quicklook/" : "",
      path: path.resolve(__dirname, ".webpack", "quicklook"),
    },

    module: {
      rules: [
        { test: /\.png$/, type: "asset/inline" },
        { test: /\.wasm$/, type: "asset/inline" },
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
              getCustomTransformers: () => ({
                before: [
                  styledComponentsTransformer,
                  // only include refresh plugin when using webpack server
                  ...(isServe ? [ReactRefreshTypescript()] : []),
                ],
              }),
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
      new HtmlWebpackPlugin({
        templateContent: `
<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <script>
    global = globalThis;
  </script>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
      }),
      new ProvidePlugin({
        // the buffer module exposes the Buffer class as a property
        Buffer: ["buffer", "Buffer"],
      }),
      ...(isServe ? [new ReactRefreshPlugin()] : []),
    ],

    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],
      fallback: {
        path: require.resolve("path-browserify"),
        stream: false,
        crypto: false,
        fs: false,
      },
    },
  };
};

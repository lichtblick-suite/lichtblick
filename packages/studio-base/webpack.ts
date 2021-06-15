// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CircularDependencyPlugin from "circular-dependency-plugin";
import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import path from "path";
import ReactRefreshTypescript from "react-refresh-typescript";
import createStyledComponentsTransformer from "typescript-plugin-styled-components";
import webpack, { Configuration, WebpackPluginInstance } from "webpack";

import { WebpackArgv } from "./WebpackArgv";

const styledComponentsTransformer = createStyledComponentsTransformer({
  getDisplayName: (filename, bindingName) => {
    const sanitizedFilename = path.relative(__dirname, filename).replace(/[^a-zA-Z0-9_-]/g, "_");
    return bindingName != undefined ? `${bindingName}__${sanitizedFilename}` : sanitizedFilename;
  },
});

type Options = {
  // During hot reloading and development it is useful to comment out code while iterating.
  // We ignore errors from unused locals to avoid having to also comment
  // those out while iterating.
  allowUnusedVariables?: boolean;
};

// Create a partial webpack configuration required to build app using webpack.
// Returns a webpack configuration containing resolve, module, plugins, and node fields.
export function makeConfig(
  _: unknown,
  argv: WebpackArgv,
  options?: Options,
): Pick<Configuration, "resolve" | "module" | "optimization" | "plugins" | "node"> {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const { allowUnusedVariables = isDev && isServe } = options ?? {};

  return {
    resolve: {
      extensions: [".js", ".ts", ".jsx", ".tsx"],
      alias: {
        "@foxglove/studio-base": path.resolve(__dirname, "src"),
        "react-dnd": require.resolve("react-dnd"),
        "styled-components": require.resolve("styled-components"),
      },
      fallback: {
        path: require.resolve("path-browserify"),
        stream: require.resolve("readable-stream"),
        zlib: require.resolve("browserify-zlib"),
        crypto: require.resolve("crypto-browserify"),
        fs: false,
        pnpapi: false,

        // TypeScript tries to use this when running in node
        perf_hooks: false,
        // Yarn patches these imports into TypeScript for PnP support
        // https://github.com/microsoft/TypeScript/pull/35206
        // https://github.com/yarnpkg/berry/pull/2889#issuecomment-849905154
        module: false,

        // These are optional for react-mosaic-component
        "@blueprintjs/core": false,
        "@blueprintjs/icons": false,
        domain: false,
      },
    },
    module: {
      rules: [
        // Add support for native node modules
        {
          test: /\.node$/,
          use: "node-loader",
        },
        {
          test: /\.wasm$/,
          type: "asset/resource",
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          resourceQuery: { not: [/raw/] },
          use: [
            {
              loader: "ts-loader",
              options: {
                transpileOnly: true,
                // https://github.com/TypeStrong/ts-loader#onlycompilebundledfiles
                // avoid looking at files which are not part of the bundle
                onlyCompileBundledFiles: true,
                projectReferences: true,
                configFile: isDev ? "tsconfig.dev.json" : "tsconfig.json",
                getCustomTransformers: () => ({
                  before: [
                    styledComponentsTransformer,
                    // only include refresh plugin when using webpack server
                    ...(isServe ? [ReactRefreshTypescript()] : []),
                  ],
                }),
              },
            },
          ],
        },
        {
          // "?raw" imports are used to load stringified typescript in Node Playground
          // https://webpack.js.org/guides/asset-modules/#replacing-inline-loader-syntax
          resourceQuery: /raw/,
          type: "asset/source",
        },
        { test: /\.(md|template)$/, type: "asset/source" },
        {
          test: /\.svg$/,
          loader: "react-svg-loader",
          options: {
            svgo: {
              plugins: [{ removeViewBox: false }, { removeDimensions: false }],
            },
          },
        },
        { test: /\.ne$/, loader: "nearley-loader" },
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
          loader: "style-loader",
          sideEffects: true,
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
        {
          test: /\.s?css$/,
          loader: "esbuild-loader",
          options: { loader: "css", minify: !isDev },
        },
        { test: /\.scss$/, loader: "sass-loader", options: { sourceMap: true } },
        { test: /\.woff2?$/, type: "asset/inline" },
        { test: /\.(glb|bag|ttf|bin)$/, type: "asset/resource" },
        {
          // TypeScript uses dynamic requires()s when running in node. We can disable these when we
          // bundle it for the renderer.
          // https://github.com/microsoft/TypeScript/issues/39436
          // Prettier's TS parser also bundles the same code: https://github.com/prettier/prettier/issues/11076
          test: /[\\/]node_modules[\\/]typescript[\\/]lib[\\/]typescript\.js$|[\\/]node_modules[\\/]prettier[\\/]parser-typescript\.js$/,
          loader: "string-replace-loader",
          options: {
            multiple: [
              {
                search: "etwModule = require(etwModulePath);",
                replace:
                  "throw new Error('[Foxglove] This module is not supported in the browser.');",
              },
              {
                search: `typescript-etw";r=require(i)`,
                replace: `typescript-etw";throw new Error('[Foxglove] This module is not supported in the browser.');`,
              },
              {
                search:
                  "return { module: require(modulePath), modulePath: modulePath, error: undefined };",
                replace:
                  "throw new Error('[Foxglove] This module is not supported in the browser.');",
              },
              {
                search: `return{module:require(n),modulePath:n,error:void 0}`,
                replace:
                  "throw new Error('[Foxglove] This module is not supported in the browser.');",
              },
            ],
          },
        },
      ],
    },
    optimization: {
      removeAvailableModules: true,
      minimizer: [new ESBuildMinifyPlugin({ target: "es2020" })],
    },
    plugins: [
      new CircularDependencyPlugin({
        exclude: /node_modules/,
        failOnError: true,
      }) as WebpackPluginInstance,
      new webpack.ProvidePlugin({
        // since we avoid "import React from 'react'" we shim here when used globally
        React: "react",
        // the buffer module exposes the Buffer class as a property
        Buffer: ["buffer", "Buffer"],
        process: "process/browser",
        setImmediate: ["@foxglove/studio-base/util/setImmediate", "default"],
      }),
      new webpack.DefinePlugin({
        // Should match webpack-defines.d.ts
        ReactNull: null, // eslint-disable-line no-restricted-syntax
      }),
      // https://webpack.js.org/plugins/ignore-plugin/#example-of-ignoring-moment-locales
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.[\\/]locale$/,
        contextRegExp: /moment$/,
      }),
      new MonacoWebpackPlugin({
        // available options: https://github.com/Microsoft/monaco-editor-webpack-plugin#options
        languages: ["typescript", "javascript"],
      }),
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configOverwrite: {
            compilerOptions: {
              noUnusedLocals: !allowUnusedVariables,
              noUnusedParameters: !allowUnusedVariables,
              paths: {
                "@foxglove/studio-base/*": [path.join(__dirname, "src/*")],
              },
            },
          },
        },
      }),
    ],
    node: {
      __dirname: true,
      __filename: true,
    },
  };
}

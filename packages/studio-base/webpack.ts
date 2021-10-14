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
      },
      fallback: {
        path: require.resolve("path-browserify"),
        stream: require.resolve("readable-stream"),
        zlib: require.resolve("browserify-zlib"),
        crypto: require.resolve("crypto-browserify"),

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

        // don't inject these things into our web build
        fs: false,
        pnpapi: false,

        // punycode is a dependency for some older webpack v4 browser libs
        // It adds unecessary bloat to the build so we make sure it isn't included
        punycode: false,
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
          test: /\.css$/,
          loader: "style-loader",
          sideEffects: true,
        },
        {
          test: /\.css$/,
          loader: "css-loader",
          options: { sourceMap: true },
        },
        {
          test: /\.css$/,
          loader: "esbuild-loader",
          options: { loader: "css", minify: !isDev },
        },
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
        {
          // By default the @fluentui/theme package registers a bunch of font faces to the document.
          // When we load all fonts with `waitForFonts` some of these URLs fail to load causing errors.
          // Since we don't need these fonts present, we remove the default font registration.
          // https://github.com/microsoft/fluentui/issues/10363
          test: /[\\/]fonts[\\/]DefaultFontStyles.js$/,
          loader: "string-replace-loader",
          options: {
            search: "registerDefaultFontFaces(_getFontBaseUrl());",
            replace: "",
            // https://github.com/Va1/string-replace-loader#strict-mode-replacement
            strict: true,
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

        // Output filenames should include content hashes in order to avoid caching issues with
        // downstream users of the studio-base package.
        filename: "[name].worker.[contenthash].js",
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

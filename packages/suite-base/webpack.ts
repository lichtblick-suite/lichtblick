// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dotenv from "dotenv";
import { ESBuildMinifyPlugin } from "esbuild-loader";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
// Monaco Editor disabled - UserScriptEditor panel is disabled
// import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import path from "path";
import ReactRefreshTypescript from "react-refresh-typescript";
import ts from "typescript";
import webpack, { Configuration } from "webpack";

import { createTssReactNameTransformer } from "@lichtblick/typescript-transformers";

import { WebpackArgv } from "./WebpackArgv";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type Options = {
  // During hot reloading and development it is useful to comment out code while iterating.
  // We ignore errors from unused locals to avoid having to also comment
  // those out while iterating.
  allowUnusedVariables?: boolean;
  /** Specify the app version. */
  version: string;
  /** Specify the path to the tsconfig.json file for ForkTsCheckerWebpackPlugin. If unset, the plugin defaults to finding the config file in the webpack `context` directory. */
  tsconfigPath?: string;
};

function buildEnvVars(): Record<string, string | undefined> {
  return {
    "process.env.DEV_WORKSPACE": JSON.stringify(process.env.DEV_WORKSPACE),
  };
}

// Create a partial webpack configuration required to build app using webpack.
// Returns a webpack configuration containing resolve, module, plugins, and node fields.
export function makeConfig(
  _: unknown,
  argv: WebpackArgv,
  options: Options,
): Pick<Configuration, "resolve" | "module" | "optimization" | "plugins" | "node"> {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const { allowUnusedVariables = isDev && isServe, version, tsconfigPath } = options;

  // Disable UserScript features in production to avoid bundling TypeScript
  const enableUserScripts = isDev || process.env.ENABLE_USER_SCRIPTS === "true";

  return {
    resolve: {
      extensions: [".js", ".ts", ".jsx", ".tsx"],
      alias: {
        "@lichtblick/suite-base": path.resolve(__dirname, "src"),
        // Exclude TypeScript and UserScriptPlayer in production builds
        ...(enableUserScripts
          ? {}
          : {
              "typescript/lib/typescript": false,
              typescript: false,
              "@lichtblick/suite-base/players/UserScriptPlayer": path.resolve(
                __dirname,
                "src/players/UserScriptPlayer/stub.ts",
              ),
            }),
      },
      fallback: {
        path: require.resolve("path-browserify"),
        stream: require.resolve("readable-stream"),
        assert: false,
        zlib: require.resolve("browserify-zlib"),
        crypto: require.resolve("crypto-browserify"),
        vm: require.resolve("vm-browserify"),

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

        // Workaround for https://github.com/react-dnd/react-dnd/issues/3423
        "react/jsx-runtime": "react/jsx-runtime.js",
        "react/jsx-dev-runtime": "react/jsx-dev-runtime.js",
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
          exclude: [
            /node_modules/,
            // Exclude storybook files from production builds to reduce bundle size
            ...(isDev ? [] : [/\.stories\.tsx?$/]),
          ],
          resourceQuery: { not: [/raw/] },
          use: [
            {
              loader: "ts-loader", // foxglove-depcheck-used: ts-loader
              options: {
                transpileOnly: true,
                // https://github.com/TypeStrong/ts-loader#onlycompilebundledfiles
                // avoid looking at files which are not part of the bundle
                onlyCompileBundledFiles: true,
                projectReferences: true,
                // Note: configFile should not be overridden, it needs to differ between web,
                // desktop, etc. so that files specific to each build (not just shared files) are
                // also type-checked. The default behavior is to find it from the webpack `context`
                // directory.
                compilerOptions: {
                  sourceMap: true,
                  jsx: isDev ? "react-jsxdev" : "react-jsx",
                },
                getCustomTransformers: (program: ts.Program) => ({
                  before: [
                    // only include refresh plugin when using webpack server
                    isServe && ReactRefreshTypescript(),
                    isDev && createTssReactNameTransformer(program),
                  ].filter(Boolean),
                }),
              },
            },
          ],
        },
        {
          // "?raw" imports are used to load the original un-modified source
          // https://webpack.js.org/guides/asset-modules/#replacing-inline-loader-syntax
          resourceQuery: /raw/,
          type: "asset/source",
        },
        { test: /\.(md|template)$/, type: "asset/source" },
        {
          test: /\.svg$/,
          loader: "@svgr/webpack", // foxglove-depcheck-used: @svgr/webpack
          options: {
            svgo: {
              plugins: [{ removeViewBox: false }, { removeDimensions: false }],
            },
          },
        },
        { test: /\.ne$/, loader: "nearley-loader" }, // foxglove-depcheck-used: nearley-loader
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
          loader: "style-loader", // foxglove-depcheck-used: style-loader
          sideEffects: true,
        },
        {
          test: /\.css$/,
          loader: "css-loader", // foxglove-depcheck-used: css-loader
          options: { sourceMap: true },
        },
        {
          test: /\.css$/,
          loader: "esbuild-loader", // foxglove-depcheck-used: esbuild-loader
          options: { loader: "css", minify: !isDev },
        },
        { test: /\.woff2?$/, type: "asset/inline" },
        { test: /\.(glb|bag|ttf|bin)$/, type: "asset/resource" },
        {
          // TypeScript uses dynamic requires()s when running in node. We can disable these when we
          // bundle it for the renderer.
          // https://github.com/microsoft/TypeScript/issues/39436
          // Prettier's TS parser also bundles the same code: https://github.com/prettier/prettier/issues/11076
          test: /[\\/]node_modules[\\/]typescript[\\/]lib[\\/]typescript\.js$|[\\/]node_modules[\\/]prettier[\\/]plugins[\\/]typescript\.m?js$/,
          loader: "string-replace-loader", // foxglove-depcheck-used: string-replace-loader
          options: {
            multiple: [
              {
                search: /etwModule\s*=\s*require\(etwModulePath\);/,
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
              {
                search: `return { module:   require(modulePath), modulePath, error: void 0 };`,
                replace: `throw new Error('[Foxglove] This module is not supported in the browser.');`,
              },
              {
                search: `getModuleResolver=function(e){let t;try{t=require(e)}`,
                replace:
                  "getModuleResolver=function(e){let t;try{throw new Error('[Foxglove] This module is not supported in the browser.')}",
              },
            ],
          },
        },
      ],
    },
    optimization: {
      removeAvailableModules: true,

      // Separate runtime chunk to reduce main bundle size
      runtimeChunk: {
        name: "runtime",
      },

      // Split chunks for better caching and parallel loading
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        cacheGroups: {
          // Separate vendor code (node_modules) but split into smaller chunks
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            reuseExistingChunk: true,
            name(module: any) {
              // Split large vendor libraries into individual chunks
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
              return packageName ? `vendor.${packageName.replace("@", "")}` : "vendors";
            },
            maxSize: 200000, // 200 KB max per vendor chunk
            minSize: 20000, // 20 KB minimum size for a chunk
          },
          // Separate Three.js (large library) - split further for async loading
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: "three",
            chunks: "async", // Load three.js asynchronously
            priority: 20,
            reuseExistingChunk: true,
            maxSize: 150000, // Split if larger than 150 KB
          },
          // Separate MUI (Material-UI) - already smaller, keep initial
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: "mui",
            chunks: "initial", // Load MUI with initial bundle (needed for UI)
            priority: 30,
            reuseExistingChunk: true,
          },
          // Separate React and React DOM - critical for initial render
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: "react",
            chunks: "initial", // Load React with initial bundle
            priority: 40,
            reuseExistingChunk: true,
          },
          // Common code shared across chunks
          common: {
            minChunks: 2,
            chunks: "all",
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 100000, // 100 KB max for common chunks
          },
        },
      },

      minimizer: [
        new ESBuildMinifyPlugin({
          target: "es2022",
          minify: true,
        }),
      ],
    },
    plugins: [
      new webpack.ProvidePlugin({
        // since we avoid "import React from 'react'" we shim here when used globally
        React: "react",
        // the buffer module exposes the Buffer class as a property
        Buffer: ["buffer", "Buffer"],
        process: ["@lichtblick/suite-base/util/process", "default"],
        setImmediate: ["@lichtblick/suite-base/util/setImmediate", "default"],
      }),
      new webpack.DefinePlugin({
        // Should match webpack-defines.d.ts
        ReactNull: null, // eslint-disable-line no-restricted-syntax
        LICHTBLICK_SUITE_VERSION: JSON.stringify(version),
        API_URL: JSON.stringify(process.env.API_URL),
        DEV_WORKSPACE: JSON.stringify(process.env.DEV_WORKSPACE),
        ENABLE_USER_SCRIPTS: JSON.stringify(enableUserScripts),
        ...buildEnvVars(),
      }),
      // Ignore TypeScript and UserScriptPlayer modules in production builds
      ...(!enableUserScripts
        ? [
            new webpack.IgnorePlugin({
              resourceRegExp: /^typescript$/,
            }),
            new webpack.IgnorePlugin({
              resourceRegExp: /typescript[\\/]lib[\\/]typescript/,
            }),
            new webpack.IgnorePlugin({
              resourceRegExp: /UserScriptPlayer[\\/]transformerWorker/,
              contextRegExp: /players/,
            }),
          ]
        : []),
      // https://webpack.js.org/plugins/ignore-plugin/#example-of-ignoring-moment-locales
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.[\\/]locale$/,
        contextRegExp: /moment$/,
      }),
      // Monaco Editor disabled to reduce bundle size (UserScriptEditor panel is disabled)
      // new MonacoWebpackPlugin({
      //   // available options: https://github.com/Microsoft/monaco-editor-webpack-plugin#options
      //   languages: ["typescript", "javascript"],
      //
      //   // Output filenames should include content hashes in order to avoid caching issues with
      //   // downstream users of the suite-base package.
      //   filename: "[name].worker.[contenthash].js",
      // }),
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: tsconfigPath,
          configOverwrite: {
            compilerOptions: {
              noUnusedLocals: !allowUnusedVariables,
              noUnusedParameters: !allowUnusedVariables,
              jsx: isDev ? "react-jsxdev" : "react-jsx",
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

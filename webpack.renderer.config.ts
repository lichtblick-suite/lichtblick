// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import CircularDependencyPlugin from "circular-dependency-plugin";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import path from "path";
import webpack, {
  Configuration,
  EnvironmentPlugin,
  RuleSetUseItem,
  WebpackPluginInstance,
} from "webpack";

import { WebpackArgv } from "./WebpackArgv";
import packageJson from "./package.json";

type Options = {
  // During hot reloading and development it is useful to comment out code while iterating.
  // We ignore errors from unused locals to avoid having to also comment
  // those out while iterating.
  allowUnusedLocals?: boolean;
};

// Common configuration shared by Storybook and the main Webpack build
export function makeConfig(_: unknown, argv: WebpackArgv, options?: Options): Configuration {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const { allowUnusedLocals = isDev && isServe } = options ?? {};

  const plugins: WebpackPluginInstance[] = [];
  const ruleUse: RuleSetUseItem[] = [];

  if (isServe) {
    plugins.push(new ReactRefreshPlugin());
    ruleUse.push({
      loader: "babel-loader",
      options: { plugins: ["react-refresh/babel"] },
    });
  }

  return {
    // force web target instead of electron-render
    // Fixes "require is not defined" errors if nodeIntegration is off
    // https://gist.github.com/msafi/d1b8571aa921feaaa0f893ab24bb727b
    target: "web",
    context: path.resolve("./app"),
    entry: "./index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    optimization: {
      minimize: false,
    },

    output: {
      publicPath: isServe ? "/renderer/" : "",
      path: path.resolve(__dirname, ".webpack", "renderer"),
    },

    resolve: {
      extensions: [".js", ".ts", ".jsx", ".tsx"],
      alias: {
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
            ...ruleUse,
            {
              loader: "ts-loader",
              options: {
                transpileOnly: true,
                // https://github.com/TypeStrong/ts-loader#onlycompilebundledfiles
                // avoid looking at files which are not part of the bundle
                onlyCompileBundledFiles: true,
                configFile: isDev ? "tsconfig.dev.json" : "tsconfig.json",
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
        { test: /\.scss$/, loader: "sass-loader", options: { sourceMap: true } },
        { test: /\.woff2?$/, type: "asset/inline" },
        { test: /\.(glb|bag|ttf|bin)$/, type: "asset/resource" },
      ],
    },
    plugins: [
      ...plugins,
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
        setImmediate: ["@foxglove-studio/app/util/setImmediate", "default"],
      }),
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null, // eslint-disable-line no-restricted-syntax
        AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY ?? null, // eslint-disable-line no-restricted-syntax
        SIGNUP_API_URL: "https://foxglove.dev/api/signup",
        SLACK_INVITE_URL: "https://foxglove.dev/join-slack",
      }),
      new webpack.DefinePlugin({
        // Should match webpack-defines.d.ts
        APP_NAME: JSON.stringify(packageJson.productName),
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
              noUnusedLocals: !allowUnusedLocals,
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

export default (env: unknown, argv: WebpackArgv): Configuration => {
  const config = makeConfig(env, argv);
  config.plugins?.push(
    new HtmlWebpackPlugin({
      templateContent: `
<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <script>
    global = globalThis;
    window.FabricConfig = ${
      // don't load @fabricui fonts from Microsoft servers
      // https://github.com/microsoft/fluentui/issues/10363
      JSON.stringify({ fontBaseUrl: "" })
    };
  </script>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    }),
  );
  return config;
};

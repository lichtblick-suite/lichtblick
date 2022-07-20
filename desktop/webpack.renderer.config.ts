// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import SentryWebpackPlugin from "@sentry/webpack-plugin";
import { ESBuildMinifyPlugin } from "esbuild-loader";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, EnvironmentPlugin, WebpackPluginInstance } from "webpack";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { buildEnvironmentDefaults } from "@foxglove/studio-base/environment";
import { makeConfig } from "@foxglove/studio-base/webpack";

import packageJson from "../package.json";

export default (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedVariables = isDev;

  const plugins: WebpackPluginInstance[] = [];

  if (isServe) {
    plugins.push(new ReactRefreshPlugin());
  }

  // Source map upload if configuration permits
  if (
    !isDev &&
    process.env.SENTRY_AUTH_TOKEN != undefined &&
    process.env.SENTRY_ORG != undefined &&
    process.env.SENTRY_PROJECT != undefined
  ) {
    plugins.push(
      new SentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: `${process.env.SENTRY_PROJECT}@${packageJson.version}`,
        setCommits:
          process.env.SENTRY_REPO && process.env.SENTRY_CURRENT_COMMIT
            ? { repo: process.env.SENTRY_REPO, commit: process.env.SENTRY_CURRENT_COMMIT }
            : undefined,

        // Since the render config appears last in the list of webpack configs, we use it to upload
        // all the source maps under .webpack (main and renderer).
        include: path.resolve(__dirname, ".webpack"),
        // in production, sources are loaded from app:/// so we need to explicitly indicate this url prefix
        urlPrefix: "app:///",
      }),
    );
  }

  const appWebpackConfig = makeConfig(env, argv, { allowUnusedVariables });

  const config: Configuration = {
    ...appWebpackConfig,

    // force web target instead of electron-render
    // Fixes "require is not defined" errors if nodeIntegration is off
    // https://gist.github.com/msafi/d1b8571aa921feaaa0f893ab24bb727b
    target: "web",
    context: path.resolve(__dirname, "./renderer"),
    entry: "./index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    output: {
      publicPath: isServe ? "/renderer/" : "",
      path: path.resolve(__dirname, ".webpack", "renderer"),
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
      ...plugins,
      ...(appWebpackConfig.plugins ?? []),
      new EnvironmentPlugin(buildEnvironmentDefaults(argv.env?.FOXGLOVE_BACKEND ?? argv.mode)),
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

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import SentryWebpackPlugin from "@sentry/webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, EnvironmentPlugin, WebpackPluginInstance } from "webpack";

import type { WebpackArgv } from "@foxglove/studio-base/WebpackArgv";
import { makeConfig } from "@foxglove/studio-base/webpack";

export default (env: unknown, argv: WebpackArgv): Configuration => {
  const isDev = argv.mode === "development";
  const isServe = argv.env?.WEBPACK_SERVE ?? false;

  const allowUnusedLocals = isDev && isServe;

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
        include: path.resolve(__dirname, ".webpack"),
      }),
    );
  }

  const appWebpackConfig = makeConfig(env, argv, { allowUnusedLocals });

  const config: Configuration = {
    ...appWebpackConfig,

    target: "web",
    context: path.resolve(__dirname),
    entry: "./src/index.tsx",
    devtool: isDev ? "eval-cheap-module-source-map" : "source-map",

    devServer: {
      contentBase: path.resolve(__dirname, ".webpack"),
      hot: true,
      // The problem and solution are described at <https://github.com/webpack/webpack-dev-server/issues/1604>.
      // When running in dev mode two errors are logged to the dev console:
      //  "Invalid Host/Origin header"
      //  "[WDS] Disconnected!"
      // Since we are only connecting to localhost, DNS rebinding attacks are not a concern during dev
      disableHostCheck: true,
    },

    output: {
      publicPath: "/",
      path: path.resolve(__dirname, ".webpack"),
    },

    plugins: [
      new CleanWebpackPlugin(),
      ...plugins,
      ...(appWebpackConfig.plugins ?? []),
      new EnvironmentPlugin({
        SENTRY_DSN: process.env.SENTRY_DSN ?? null, // eslint-disable-line no-restricted-syntax
        SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? null, // eslint-disable-line no-restricted-syntax
        AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY ?? null, // eslint-disable-line no-restricted-syntax
        SIGNUP_API_URL: "https://foxglove.dev/api/signup",
        SLACK_INVITE_URL: "https://foxglove.dev/join-slack",
      }),
      new CopyPlugin({
        patterns: [{ from: "public" }],
      }),
      new HtmlWebpackPlugin({
        templateContent: `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <title>Foxglove Studio</title>
    </head>
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
    ],
  };

  return config;
};

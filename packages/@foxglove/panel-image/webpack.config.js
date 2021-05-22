// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-check

"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "web",
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  experiments: { outputModule: true }, // enable support for `libraryTarget: "module"`

  entry: "./src/extension.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "module",
  },
  devtool: "nosources-source-map",
  externals: {},
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
};
module.exports = config;

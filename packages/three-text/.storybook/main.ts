// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import webpack, { Configuration } from "webpack";

export default {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: "@storybook/react",
  core: {
    builder: "webpack5",
  },
  webpackFinal: (config: Configuration): Configuration => {
    return {
      ...config,
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [{ loader: "ts-loader", options: { compilerOptions: { rootDir: "." } } }],
          },
        ],
      },
      plugins: [
        ...(config.plugins ?? []),
        new webpack.DefinePlugin({
          // Should match webpack-defines.d.ts
          ReactNull: null, // eslint-disable-line no-restricted-syntax
        }),
      ],
    };
  },
};

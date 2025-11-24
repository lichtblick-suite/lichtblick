// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable filenames/match-exported */

import { StorybookConfig } from "@storybook/react-webpack5";
import path from "path";
import { Configuration } from "webpack";

import { makeConfig } from "@lichtblick/suite-base/webpack";

const storybookConfig: StorybookConfig = {
  // Workaround for https://github.com/storybookjs/storybook/issues/19446
  stories: ["../packages/**/!(node_modules)**/*.stories.tsx"],
  framework: {
    name: "@storybook/react-webpack5",
    options: {
      legacyRootApi: true,
    },
  },
  // Carefully merge our main webpack config with the Storybook default config.
  // For the most part, our webpack config has already been designed to handle
  // all the imports and edge cases we need to support. However, at least some of
  // Storybook's config is required, for instance the HtmlWebpackPlugin that they
  // use to generate the main iframe page.
  webpackFinal: (config: Configuration): Configuration => {
    const studioWebpackConfig = makeConfig(
      undefined,
      { mode: config.mode },
      {
        allowUnusedVariables: true,
        version: "0.0.0-storybook",
        // We are only setting the configFile from Storybook as it is required to properly resolve
        // some assumptions made while traversing the dependency tree in Chromatic.
        tsconfigPath: `${path.resolve(__dirname)}/tsconfig.json`,
      },
    );
    return {
      ...config,
      // context is required for ForkTsCheckerWebpackPlugin to find .storybook/tsconfig.json
      optimization: {
        ...config.optimization,
        minimize: false, // disabling minification improves build performance
      },

      resolve: {
        ...studioWebpackConfig.resolve,
        fallback: {
          ...(typeof studioWebpackConfig.resolve?.fallback === "object" &&
          !Array.isArray(studioWebpackConfig.resolve.fallback)
            ? studioWebpackConfig.resolve.fallback
            : {}),
          ...(config.resolve?.fallback &&
          typeof config.resolve.fallback === "object" &&
          !Array.isArray(config.resolve.fallback)
            ? config.resolve.fallback
            : {}),
        },
      },
      module: studioWebpackConfig.module,
      plugins: [
        ...(config.plugins ?? []).filter((plugin) => plugin?.constructor.name !== "DocgenPlugin"),
        ...(studioWebpackConfig.plugins ?? []),
      ],
      node: studioWebpackConfig.node,
    };
  },
};

module.exports = storybookConfig;

import { Configuration } from "webpack";
import { makeConfig } from "../../webpack.renderer.config";

module.exports = {
  stories: ["../**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-actions", "storycap"],

  core: {
    builder: "webpack5",
  },

  // Carefully merge our main webpack config with the Storybook default config.
  // For the most part, our webpack config has already been designed to handle
  // all the imports and edge cases we need to support. However, at least some of
  // Storybook's config is required, for instance the HtmlWebpackPlugin that they
  // use to generate the main iframe page.
  webpackFinal: (config: Configuration): Configuration => {
    const rendererConfig = makeConfig(undefined, { mode: config.mode });
    return {
      ...config,
      resolve: {
        ...rendererConfig.resolve,
        alias: {
          ...rendererConfig.resolve?.alias,
          // Modules to replace with mock equivalents in the storybook build:
          "@foxglove-studio/app/panels/WelcomePanel/subscribeToNewsletter": require.resolve(
            "./__mocks__/subscribeToNewsletter",
          ),
        },
      },
      module: rendererConfig.module,
      plugins: [...(config.plugins ?? []), ...(rendererConfig.plugins ?? [])],
    };
  },
};

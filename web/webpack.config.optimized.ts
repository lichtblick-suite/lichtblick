// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import {
  ConfigParams,
  devServerConfig,
  mainConfig,
} from "@lichtblick/suite-web/src/webpackConfigs";

import packageJson from "../package.json";

const params: ConfigParams = {
  outputPath: path.resolve(__dirname, ".webpack"),
  contextPath: path.resolve(__dirname, "src"),
  entrypoint: "./entrypoint.tsx",
  prodSourceMap: "source-map",
  version: packageJson.version,
};

// Optimized configuration for faster development builds
const optimizedDevServerConfig = (params: ConfigParams) => {
  const baseConfig = devServerConfig(params);
  return {
    ...baseConfig,
    devServer: {
      ...baseConfig.devServer,
      // Enable faster compilation
      hot: true,
      liveReload: false, // Disable live reload for faster builds
      // Optimize for speed
      compress: false, // Disable compression in dev for speed
      // Reduce memory usage
      client: {
        overlay: {
          // Reduce overlay complexity for faster rendering
          warnings: false,
          errors: true,
        },
      },
    },
  };
};

// Optimized main config with performance improvements
const optimizedMainConfig = (params: ConfigParams) => (env: unknown, argv: any) => {
  const baseConfig = mainConfig(params)(env, argv);

  return {
    ...baseConfig,

    // Enable aggressive caching for faster rebuilds
    cache: {
      type: "filesystem",
      buildDependencies: {
        config: [__filename],
      },
      // Increase cache size for better performance
      maxMemoryGenerations: 1,
    },

    // Optimize for development speed
    optimization: {
      ...baseConfig.optimization,
      // Disable minification in development for speed
      minimize: false,
      // Enable faster module concatenation
      concatenateModules: false,
      // Optimize chunk splitting for faster loading
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          // Separate vendor chunks for better caching
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          // Separate large libraries
          fluentui: {
            test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
            name: "fluentui",
            chunks: "all",
            priority: 20,
          },
          // Separate three.js for faster loading
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: "three",
            chunks: "all",
            priority: 20,
          },
          // Separate monaco editor
          monaco: {
            test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
            name: "monaco",
            chunks: "all",
            priority: 20,
          },
        },
      },
    },

    // Optimize module resolution
    resolve: {
      ...baseConfig.resolve,
      // Enable faster module resolution
      symlinks: false,
      // Cache module resolution
      cacheWithContext: false,
    },

    // Optimize for development
    devtool: "eval-cheap-module-source-map", // Faster than eval-cheap-module-source-map

    // Enable experiments for better performance
    experiments: {
      ...baseConfig.experiments,
      // Enable lazy compilation for faster initial builds
      lazyCompilation: {
        entries: false, // Don't lazy compile entry points
        imports: true,  // Lazy compile dynamic imports
      },
    },

    // Optimize plugins for development
    plugins: [
      ...(baseConfig.plugins || []).filter(plugin => {
        // Remove heavy plugins in development
        if (plugin && plugin.constructor) {
          const pluginName = plugin.constructor.name;
          return !["ForkTsCheckerWebpackPlugin"].includes(pluginName);
        }
        return true;
      }),
    ],

    // Optimize module rules for faster processing
    module: {
      ...baseConfig.module,
      rules: [
        ...(baseConfig.module?.rules || []).map(rule => {
          // Optimize TypeScript compilation
          if (rule && typeof rule === 'object' && 'test' in rule && rule.test && rule.test.toString().includes("tsx?")) {
            return {
              ...rule,
              use: [
                {
                  loader: "ts-loader",
                  options: {
                    transpileOnly: true, // Skip type checking for speed
                    onlyCompileBundledFiles: true,
                    projectReferences: false, // Disable project references for speed
                    compilerOptions: {
                      sourceMap: true,
                      jsx: "react-jsxdev",
                      // Disable strict checks for faster compilation
                      noUnusedLocals: false,
                      noUnusedParameters: false,
                      strict: false,
                    },
                  },
                },
              ],
            };
          }
          return rule;
        }),
      ],
    },
  };
};

// foxglove-depcheck-used: webpack-dev-server
export default [optimizedDevServerConfig(params), optimizedMainConfig(params)];

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer"; // <--- 1. Import Plugin

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
  prodSourceMap: false,
  version: packageJson.version,
};

const generateConfig = mainConfig(params);

const analyzedMainConfig = (env: any, argv: any) => {
  const config = generateConfig(env, argv);

  if (process.env.ANALYZE === "true") {
    config.plugins = config.plugins || [];

    config.plugins.push(new BundleAnalyzerPlugin() as any);
  }

  return config;
};

export default [devServerConfig(params), analyzedMainConfig];

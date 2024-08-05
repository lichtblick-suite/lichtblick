// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ConfigParams,
  devServerConfig,
  mainConfig,
} from "@lichtblick/suite-web/src/webpackConfigs";
import path from "path";

import packageJson from "../package.json";

const params: ConfigParams = {
  outputPath: path.resolve(__dirname, ".webpack"),
  contextPath: path.resolve(__dirname, "src"),
  entrypoint: "./entrypoint.tsx",
  prodSourceMap: "source-map",
  version: packageJson.version,
};

// foxglove-depcheck-used: webpack-dev-server
export default [devServerConfig(params), mainConfig(params)];

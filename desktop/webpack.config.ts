// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import { WebpackConfigParams } from "@foxglove/studio-desktop/src/WebpackConfigParams";
import { webpackDevServerConfig } from "@foxglove/studio-desktop/src/webpackDevServerConfig";
import { webpackMainConfig } from "@foxglove/studio-desktop/src/webpackMainConfig";
import { webpackPreloadConfig } from "@foxglove/studio-desktop/src/webpackPreloadConfig";
import { webpackQuicklookConfig } from "@foxglove/studio-desktop/src/webpackQuicklookConfig";
import { webpackRendererConfig } from "@foxglove/studio-desktop/src/webpackRendererConfig";

import packageJson from "../package.json";

const params: WebpackConfigParams = {
  packageJson,
  outputPath: path.resolve(__dirname, ".webpack"),
  prodSourceMap: "source-map",
  rendererContext: path.resolve(__dirname, "renderer"),
  rendererEntrypoint: "./index.ts",
  mainContext: path.resolve(__dirname, "main"),
  mainEntrypoint: "./index.ts",
  quicklookContext: path.resolve(__dirname, "quicklook"),
  quicklookEntrypoint: "./index.ts",
  preloadContext: path.resolve(__dirname, "preload"),
  preloadEntrypoint: "./index.ts",
};

export default [
  webpackDevServerConfig(params),
  webpackMainConfig(params),
  webpackPreloadConfig(params),
  webpackRendererConfig(params),
  webpackQuicklookConfig(params),
];

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import webpack from "webpack";

import { WebpackArgv } from "../WebpackArgv";
import webpackConfig from "../webpack.config";

// global jest test setup builds the webpack build before running any integration tests
export default async (): Promise<void> => {
  if ((process.env.INTEGRATION_SKIP_BUILD ?? "") !== "") {
    return;
  }

  const webpackArgs: WebpackArgv = { mode: "production" };
  const compiler = webpack(
    webpackConfig.map((config) => {
      if (typeof config === "function") {
        return config(undefined, webpackArgs);
      }

      return config;
    }),
  );

  return new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line no-restricted-syntax
    console.info("Building Webpack");
    compiler.run((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (!result || result.hasErrors()) {
        reject(new Error("webpack build failed"));
        return;
      }
      // eslint-disable-next-line no-restricted-syntax
      console.info("Webpack build complete");
      resolve();
    });
  });
};

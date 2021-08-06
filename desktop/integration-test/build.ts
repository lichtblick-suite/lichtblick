// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import path from "path";
import webpack from "webpack";

import webpackConfig from "../webpack.config";

const appPath = path.join(__dirname, "..", ".webpack");
export { appPath };

// global jest test setup builds the webpack build before running any integration tests
export default async (): Promise<void> => {
  if ((process.env.INTEGRATION_SKIP_BUILD ?? "") !== "") {
    return;
  }

  const compiler = webpack(
    webpackConfig.map((config) => {
      if (typeof config === "function") {
        return config(undefined, { mode: "production" });
      }

      return config;
    }),
  );

  return await new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line no-restricted-syntax
    console.info("Building Webpack. To skip, set INTEGRATION_SKIP_BUILD=1");
    compiler.run((err, result) => {
      compiler.close(() => {});
      if (err) {
        reject(err);
        return;
      }
      if (!result || result.hasErrors()) {
        console.error(result?.toString());
        reject(new Error("webpack build failed"));
        return;
      }
      // eslint-disable-next-line no-restricted-syntax
      console.info("Webpack build complete");
      resolve();
    });
  });
};

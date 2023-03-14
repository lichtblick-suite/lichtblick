// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type WebpackConfigParams = {
  packageJson: {
    productName: string;
    name: string;
    version: string;
    description: string;
    productDescription: string;
    license: string;
    author: { name: string; email: string };
    homepage: string;
  };

  /** Directory to find `rendererEntrypoint` and `tsconfig.json`. */
  rendererContext: string;
  rendererEntrypoint: string;

  /** Directory to find `mainEntrypoint` and `tsconfig.json`. */
  mainContext: string;
  mainEntrypoint: string;

  /** Directory to find `quicklookEntrypoint` and `tsconfig.json`. */
  quicklookContext: string;
  quicklookEntrypoint: string;

  /** Directory to find `preloadEntrypoint` and `tsconfig.json`. */
  preloadContext: string;
  preloadEntrypoint: string;

  outputPath: string;
  /** Source map (`devtool`) setting to use for production builds */
  prodSourceMap: string | false;
};

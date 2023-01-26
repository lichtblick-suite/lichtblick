// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import type { Configuration } from "webpack";
import "webpack-dev-server";

import main from "./webpack.main.config";
import preload from "./webpack.preload.config";
import quicklook from "./webpack.quicklook.config";
import renderer from "./webpack.renderer.config";
import packageJson from "../package.json";

const isRelease = process.env.RELEASE != undefined;

// The appdata directory is derived from the product name. To have a separate directory
// for our production and development builds we change the product name when using dev or serve.
const productName = isRelease ? packageJson.productName : `${packageJson.productName} Dev`;

const devServerConfig: Configuration = {
  // Use empty entry to avoid webpack default fallback to /src
  entry: {},

  // Output path must be specified here for HtmlWebpackPlugin within render config to work
  output: {
    publicPath: "",
    path: path.resolve(__dirname, ".webpack"),
  },

  devServer: {
    static: {
      directory: path.resolve(__dirname, ".webpack"),
    },
    devMiddleware: {
      writeToDisk: (filePath) => {
        // Electron needs to open the main thread source and preload source from disk
        // avoid writing the hot-update js and json files
        // allow writing package.json at root -> needed for electron to find entrypoint
        return /\.webpack[\\/]((main|extensions)[\\/](?!.*hot-update)|package\.json)/.test(
          filePath,
        );
      },
    },
    hot: true,
    // The problem and solution are described at <https://github.com/webpack/webpack-dev-server/issues/1604>.
    // When running in dev mode two errors are logged to the dev console:
    //  "Invalid Host/Origin header"
    //  "[WDS] Disconnected!"
    // Since we are only connecting to localhost, DNS rebinding attacks are not a concern during dev
    allowedHosts: "all",
  },
  plugins: [
    new CleanWebpackPlugin(),
    // electron-packager needs a package.json file to indicate the entry script
    // We purpose the htmlwebpackplugin to write the json rather than an html file
    new HtmlWebpackPlugin({
      filename: "package.json",
      templateContent: JSON.stringify({
        main: "main/main.js",
        name: packageJson.name,
        productName,
        version: packageJson.version,
        description: packageJson.description,
        productDescription: packageJson.productDescription,
        license: packageJson.license,
        author: packageJson.author,
      }),
    }),
  ],
};

export default [devServerConfig, main, preload, renderer, quicklook];

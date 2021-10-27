// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import URDFLoader from "urdf-loader";
import { XacroParser } from "xacro-parser";

import Logger from "@foxglove/log";
import {
  AssetLoader,
  Asset,
  parsePackageUrl,
  rewritePackageUrl,
} from "@foxglove/studio-base/context/AssetsContext";

const log = Logger.getLogger(__filename);

const URDF_ROOT = "$URDF_ROOT";

export default class URDFAssetLoader implements AssetLoader {
  async load(
    file: File,
    { basePath }: { basePath: string | undefined },
  ): Promise<Asset | undefined> {
    if (!/\.(urdf|xacro|xml)$/.test(file.name)) {
      return undefined;
    }
    const text = await file.text();
    if (text.trim().length === 0) {
      throw new Error(`${file.name} is empty`);
    }

    const xacroParser = new XacroParser();
    xacroParser.rospackCommands = {
      // Translate find commands to `package://` URLs, which makes the XacroParser treat them as
      // absolute paths while allowing us to re-parse and translate these to
      // x-foxglove-ros-package URLs later.
      find: (targetPkg) => `package://${targetPkg}`,
    };
    xacroParser.getFileContents = async (path: string) => {
      // Given a fully formed package:// URL, translate it to something we can actually fetch.
      if (!parsePackageUrl(path)) {
        throw new Error(`Unable to get file contents for ${path}`);
      }
      const url = rewritePackageUrl(path, { basePath });
      return await (await fetch(url)).text();
    };

    const urdf = await xacroParser.parse(text);
    if (urdf.getElementsByTagName("parsererror").length !== 0) {
      throw new Error(`${file.name} could not be parsed as XML`);
    }
    log.info("Parsing URDF", urdf);

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      // TIFF images are not supported by Chrome. Use a custom protocol handler to locate and decode TIFFs.
      if (/^x-foxglove-ros-package:.+\.tiff?$/i.test(url)) {
        return url.replace(/^x-foxglove-ros-package:/, "x-foxglove-ros-package-converted-tiff:");
      }
      return url;
    });

    const loader = new URDFLoader(manager);
    const finishedLoading = new Promise<void>((resolve, reject) => {
      manager.onLoad = () => resolve();
      manager.onError = (url) =>
        reject(
          new Error(
            `Failed to load ${url}. Loading assets from ROS packages requires the ROS_PACKAGE_PATH environment variable to be set.`,
          ),
        );
    });

    // URDFLoader appends the resource path to the URL we give it. We include the ROS package name
    // and the path of the URDF file so the protocol handler can look up the package location
    // relative to the dropped URDF file.
    loader.packages = (targetPkg: string) => {
      let url = `x-foxglove-ros-package:?targetPkg=${encodeURIComponent(targetPkg)}`;
      if (basePath != undefined) {
        url += `&basePath=${encodeURIComponent(basePath)}`;
      }
      return url + `&relPath=`;
    };

    // If there are no nested assets to load, then the LoadingManager will never emit onLoad unless
    // we tell it the top-level load has finished.
    manager.itemStart(URDF_ROOT);
    const robot = loader.parse(urdf);
    manager.itemEnd(URDF_ROOT);
    await finishedLoading;

    if (robot.children.length === 0) {
      throw new Error(`The URDF file ${file.name} contained no visual elements.`);
    }

    return { name: file.name, type: "urdf", model: robot };
  }
}

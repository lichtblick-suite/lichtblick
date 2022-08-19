// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { extname } from "path";
import * as THREE from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import URDFLoader from "urdf-loader";
import { XacroParser } from "xacro-parser";

import Logger from "@foxglove/log";
import { AssetLoader, Asset, parsePackageUrl } from "@foxglove/studio-base/context/AssetsContext";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);

const URDF_ROOT = "$URDF_ROOT";

// https://github.com/ros/urdf_tutorial

export default class URDFAssetLoader implements AssetLoader {
  public async load(file: File): Promise<Asset | undefined> {
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
      // absolute paths.
      find: (targetPkg) => `package://${targetPkg}`,
    };
    xacroParser.getFileContents = async (path: string) => {
      // Given a fully formed package:// URL, translate it to something we can actually fetch.
      if (!parsePackageUrl(path)) {
        throw new Error(`Unable to get file contents for ${path}`);
      }
      return await (await fetch(path)).text();
    };

    const urdf = await xacroParser.parse(text);
    if (urdf.getElementsByTagName("parsererror").length !== 0) {
      throw new Error(`${file.name} could not be parsed as XML`);
    }
    log.info("Parsing URDF", urdf);

    const manager = new THREE.LoadingManager();

    // URDFLoader uses the ColladaLoader internally.
    // The ColladaLoader uses a TextureLoader internally and provides no way to override
    // the texture loader or specific texture loading.
    //
    // The TextureLoader does not support loading .tiff files into textures. To work around this
    // we re-write any `package://` url pointing at a .tiff file into a url which returns a png.
    // The x-foxglove-converted-tiff protocol is used because the electron protocol handler
    // for package:// uses registerFileProtocol and for converted tiff we need registerBufferProtocol
    manager.setURLModifier((url) => {
      if (url.startsWith("package://") && (url.endsWith(".tiff") || url.endsWith(".tif"))) {
        return url.replace("package://", "x-foxglove-converted-tiff://");
      }
      return url;
    });

    const loader = new URDFLoader(manager);

    const unsupportedMeshes: string[] = [];
    loader.loadMeshCb = (path, meshManager, done) => {
      const extension = extname(path);

      if (extension === ".stl") {
        const meshLoader = new STLLoader(meshManager);
        meshLoader.load(path, (geom) => {
          const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial());
          done(mesh);
        });
      } else if (extension === ".dae") {
        const meshLoader = new ColladaLoader(meshManager);
        meshLoader.load(path, (dae) => done(dae.scene));
      } else if (extension === ".obj") {
        const meshLoader = new OBJLoader(meshManager);
        meshLoader.load(path, (obj) => done(obj));
      } else {
        unsupportedMeshes.push(path);
      }
    };

    const finishedLoading = new Promise<void>((resolve, reject) => {
      manager.onLoad = () => resolve();
      manager.onError = (url) => {
        // x-foxglove-converted-tiff is an internal detail around loading tiff images
        // If there is an error with the url, we show the user the original package:// url rather
        // than the x-foxglove-converted-tiff url.
        const sanitizedUrl = url.replace("x-foxglove-converted-tiff://", "package://");

        if (/^package:\/\//.test(sanitizedUrl)) {
          if (!isDesktopApp()) {
            reject(new Error("package:// urls require the desktop app."));
            return;
          }

          reject(
            new Error(
              `Could not load ${sanitizedUrl}. Check that you've set the ROS_PACKAGE_PATH environment variable or app setting.`,
            ),
          );
          return;
        }

        reject(new Error(`Failed to load ${sanitizedUrl}.`));
      };
    });

    // URDFLoader calls this function for every `package://` url it encounters.
    //
    // The desktop app supports package:// urls via protocol handlers so we need to re-construct
    // a package url for the loader.
    loader.packages = (targetPkg: string) => {
      return `package://${targetPkg}`;
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

    if (unsupportedMeshes.length > 0) {
      throw new Error(`Unsupported meshes: ${unsupportedMeshes.join(", ")}`);
    }

    return { name: file.name, type: "urdf", model: robot };
  }
}

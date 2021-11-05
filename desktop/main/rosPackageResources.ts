// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { DOMParser } from "@xmldom/xmldom";
import { protocol } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { PNG } from "pngjs";
import UTIF from "utif";

import Logger from "@foxglove/log";

import pkgInfo from "../../package.json";

const log = Logger.getLogger(__filename);

/** Extract a package name from a ROS package.xml file. */
function rosPackageName(packageXmlContents: string) {
  const doc = new DOMParser().parseFromString(packageXmlContents, "text/xml");
  const packageName = Array.from(doc.documentElement?.childNodes ?? []).find(
    (n) => n.nodeName.toLowerCase() === "name",
  )?.textContent;
  return packageName ?? undefined;
}

/**
 * Read package.xml from the given directory to determine if it is a ROS package. If so, return the
 * `<name/>` of the package.
 */
async function rosPackageNameAtPath(packagePath: string): Promise<string | undefined> {
  try {
    const contents = await fs.readFile(path.join(packagePath, "package.xml"), {
      encoding: "utf-8",
    });
    return rosPackageName(contents);
  } catch (err) {
    return undefined;
  }
}

/**
 * Return a map of ROS package names to their absolute paths.
 */
async function listRosPackages(rootPath: string): Promise<Map<string, string>> {
  const packagePaths = await fs.readdir(rootPath, { withFileTypes: true });
  const packagesArray: { name: string | undefined; absolutePath: string }[] = await Promise.all(
    packagePaths.map(async (packagePath) => {
      const absolutePath = path.join(rootPath, packagePath.name);
      try {
        const name = packagePath.isDirectory()
          ? await rosPackageNameAtPath(absolutePath)
          : undefined;
        return { name, absolutePath };
      } catch (err) {
        return { name: undefined, absolutePath };
      }
    }),
  );

  const packages = new Map<string, string>();
  for (const { name, absolutePath } of packagesArray) {
    if (name != undefined) {
      packages.set(name, absolutePath);
    }
  }
  return packages;
}

/**
 * Search for the ROS package named `pkg` relative to `rosPackagePath` and/or `env.ROS_PACKAGE_PATH`
 * if it is set.
 */
async function findRosPackageRoot(
  pkg: string,
  { rosPackagePath, searchPath }: { rosPackagePath?: string; searchPath?: string },
): Promise<string | undefined> {
  // log.debug(`findRosPackageRoot(${pkg}, ${rosPackagePath}, ${searchPath})`);

  // Search relative to the given path
  if (searchPath != undefined) {
    let currentPath = searchPath;
    for (;;) {
      if ((await rosPackageNameAtPath(currentPath)) === pkg) {
        // log.debug(`Found ROS package ${pkg} at ${currentPath} (searched relative to ${searchPath})`);
        return currentPath;
      }
      if (path.dirname(currentPath) === currentPath) {
        break;
      }
      currentPath = path.dirname(currentPath);
    }
  }

  // Search relative to ROS_PACKAGE_PATH
  const ROS_PACKAGE_PATH = rosPackagePath ?? process.env.ROS_PACKAGE_PATH ?? "";
  if (ROS_PACKAGE_PATH != undefined && ROS_PACKAGE_PATH !== "") {
    const packages = await listRosPackages(ROS_PACKAGE_PATH);
    const packagePath = packages.get(pkg);
    if (packagePath) {
      // log.info(`Found ROS package "${pkg}" at "${packagePath}" (in ROS_PACKAGE_PATH "${ROS_PACKAGE_PATH}")`);
      return packagePath;
    }
  }

  log.warn(`Could not find ROS package "${pkg}" (in ROS_PACKAGE_PATH "${ROS_PACKAGE_PATH}")`);
  return undefined;
}

/** Translate a x-foxglove-ros-package: style URL to the actual resource path on disk. */
async function findRosPackageResource(urlString: string): Promise<string> {
  const url = new URL(urlString);
  const params = new URLSearchParams(url.search);
  const targetPkg = params.get("targetPkg");
  const basePath = params.get("basePath");
  const rosPackagePath = params.get("rosPackagePath");
  const relPath = params.get("relPath");
  if (targetPkg == undefined) {
    throw new Error("ROS package URL missing targetPkg");
  }
  if (relPath == undefined) {
    throw new Error("ROS package URL missing relPath");
  }

  const resourcePathParts = relPath.split("/");
  const pkgRoot = await findRosPackageRoot(targetPkg, {
    rosPackagePath: rosPackagePath ?? undefined,
    searchPath: basePath ? path.dirname(basePath) : undefined,
  });
  if (pkgRoot == undefined) {
    throw new Error(
      `ROS package ${targetPkg} not found${
        basePath != undefined ? ` relative to ${basePath}` : ""
      }. Set the ROS_PACKAGE_PATH environment variable before launching ${pkgInfo.productName}.`,
    );
  }
  return path.join(pkgRoot, ...resourcePathParts);
}

/**
 * Register handlers for x-foxglove-ros-package: and x-foxglove-ros-package-converted-tiff:
 * protocols. These URLs contain parameters for the ROS package name, the resource name relative to
 * the package root, and a search path (the path to the URDF file itself, when the file was dropped
 * in). We use the given search path and/or `env.ROS_PACKAGE_PATH` to locate the resource files.
 *
 * The -converted-tiff: protocol reads TIFF images and converts them to PNG before sending the
 * response, because Chromium doesn't support TIFFs. The urdf_tutorial examples use .tif textures on
 * their meshes.
 */
export function registerRosPackageProtocolHandlers(): void {
  protocol.registerFileProtocol("x-foxglove-ros-package", async (request, callback) => {
    try {
      const resPath = await findRosPackageResource(request.url);
      callback({ path: resPath });
    } catch (err) {
      log.warn("Error loading from ROS package url", request.url, err);
      callback({ error: 404 });
    }
  });

  protocol.registerBufferProtocol(
    "x-foxglove-ros-package-converted-tiff",
    async (request, callback) => {
      try {
        const resPath = await findRosPackageResource(request.url);
        const buf = await fs.readFile(resPath);
        const [ifd] = UTIF.decode(buf);
        if (!ifd) {
          throw new Error("TIFF decoding failed");
        }
        UTIF.decodeImage(buf, ifd);
        const png = new PNG({ width: ifd.width, height: ifd.height });
        png.data = Buffer.from(UTIF.toRGBA8(ifd));
        const pngData = PNG.sync.write(png);
        callback({ mimeType: "image/png", data: pngData });
      } catch (err) {
        log.warn("Error loading from ROS package url", request.url, err);
        callback({ error: 404 });
      }
    },
  );
}

/** Enable fetch for custom URL schemes. */
export function registerRosPackageProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "x-foxglove-ros-package", privileges: { supportFetchAPI: true } },
  ]);
}

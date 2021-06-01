// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { join as pathJoin } from "path";

import Logger from "@foxglove/log";

import { DesktopExtension } from "../common/types";

const log = Logger.getLogger(__filename);

export async function loadExtensions(rootFolder: string): Promise<DesktopExtension[]> {
  const extensions: DesktopExtension[] = [];

  if (!existsSync(rootFolder)) {
    return extensions;
  }

  const rootFolderContents = await readdir(rootFolder, { withFileTypes: true });
  for (const entry of rootFolderContents) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      log.debug(`Loading extension at ${entry.name}`);
      const extensionRootPath = pathJoin(rootFolder, entry.name);
      const packagePath = pathJoin(extensionRootPath, "package.json");

      const packageData = await readFile(packagePath, { encoding: "utf8" });

      const packageJson = JSON.parse(packageData);
      const sourcePath = pathJoin(extensionRootPath, packageJson.main);

      const source = await readFile(sourcePath, { encoding: "utf-8" });
      extensions.push({ packageJson, source });
    } catch (err) {
      log.error(err);
    }
  }

  return extensions;
}

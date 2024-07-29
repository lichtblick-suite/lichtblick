// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { join as pathJoin } from "path";

import Logger from "@foxglove/log";

import { DesktopLayout } from "../common/types";

const log = Logger.getLogger(__filename);

export async function fetchLayouts(rootFolder: string): Promise<DesktopLayout[]> {
  const layouts: DesktopLayout[] = [];

  if (!existsSync(rootFolder)) {
    return layouts;
  }

  const rootFolderContents = await readdir(rootFolder, { withFileTypes: true });

  for (const entry of rootFolderContents) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      const layoutPath = pathJoin(rootFolder, entry.name);
      const layoutData = await readFile(layoutPath, { encoding: "utf8" });

      layouts.push({ from: entry.name, layoutJson: JSON.parse(layoutData) });
    } catch (err) {
      log.error(err);
    }
  }

  return layouts;
}

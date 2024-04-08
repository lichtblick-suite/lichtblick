// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { readdir, stat } from "fs/promises";
import * as path from "path";

// Adjust this byte size as needed if the app is growing for a valid reason.
// This check is here to catch unexpected ballooning of the build size
const MAX_BUILD_SIZE = 160_000_000;

async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  const files = await readdir(dirPath, { withFileTypes: true });

  for (const file of files) {
    if (file.isDirectory()) {
      // eslint-disable-next-line no-param-reassign
      arrayOfFiles = await getAllFiles(path.join(dirPath, file.name), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file.name));
    }
  }

  return arrayOfFiles;
}

async function getTotalSize(directoryPath: string): Promise<number> {
  const arrayOfFiles = await getAllFiles(directoryPath);
  let totalSize = 0;
  for (const filename of arrayOfFiles) {
    totalSize += (await stat(filename)).size;
  }
  return totalSize;
}

it("build size should not grow significantly", async () => {
  const buildDir = path.join(__dirname, "..", ".webpack");
  const buildSizeInBytes = await getTotalSize(buildDir);
  // eslint-disable-next-line no-restricted-syntax
  console.info(`Total production build size: ${buildSizeInBytes} bytes`);
  expect(buildSizeInBytes).toBeLessThan(MAX_BUILD_SIZE);
});

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/* eslint-disable filenames/match-exported */

import fs from "fs";
import os from "os";
import path from "path";

async function clearStorage(): Promise<void> {
  console.debug("Cleaning extensions and layouts folders");

  const baseDir = path.join(os.homedir(), ".lichtblick-suite");
  const dirsToClean = ["extensions", "layouts"];

  for (const dir of dirsToClean) {
    const fullPath = path.join(baseDir, dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

export default clearStorage;

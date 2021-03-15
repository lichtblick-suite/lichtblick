// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ipcRenderer } from "electron";
import { promises as fs } from "fs";
import path from "path";

import type { Storage, StorageContent } from "@foxglove-studio/app/OsContext";

export default class LocalFileStorage implements Storage {
  #userDataPath = ipcRenderer.invoke("getUserDataPath");

  async list(datastore: string): Promise<string[]> {
    const datastoreDir = await this.ensureDatastorePath(datastore);
    const result = new Array<string>();

    const entries = await fs.readdir(datastoreDir);
    for (const entry of entries) {
      result.push(entry);
    }

    return result;
  }

  async all(datastore: string): Promise<Uint8Array[]> {
    const datastoreDir = await this.ensureDatastorePath(datastore);
    const result = new Array<Uint8Array>();

    try {
      const entries = await fs.readdir(datastoreDir);
      for (const entry of entries) {
        const filePath = path.join(datastoreDir, entry);
        const content = await fs.readFile(filePath);
        result.push(content);
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    return result;
  }

  async get(datastore: string, key: string): Promise<StorageContent | undefined> {
    const filePath = await this.makeFilePath(datastore, key);
    return fs.readFile(filePath).catch((err) => {
      if (err.code !== "EEXIST") {
        throw err;
      }
      return undefined;
    });
  }

  async put(datastore: string, key: string, value: StorageContent): Promise<void> {
    const filePath = await this.makeFilePath(datastore, key);
    await fs.writeFile(filePath, value);
  }

  async delete(datastore: string, key: string): Promise<void> {
    const filePath = await this.makeFilePath(datastore, key);
    await fs.unlink(filePath);
  }

  private async makeFilePath(datastore: string, key: string): Promise<string> {
    const datastoreDir = await this.ensureDatastorePath(datastore);
    // check that datastore matches regex [a-z]*
    // since keys becomes paths under our datastore, we use this to sanitize
    if (!/[a-z-]/.test(key)) {
      throw new Error(`key (${key}) contains invalid characters`);
    }

    return path.join(datastoreDir, key);
  }

  private async ensureDatastorePath(datastore: string): Promise<string> {
    const basePath = await this.#userDataPath;
    // check that datastore matches regex [a-z]*
    // since datastore becomes a path under our userDataPath, we use this to sanitize
    if (!/[a-z-]/.test(datastore)) {
      throw new Error(`datastore (${datastore}) contains invalid characters`);
    }

    // There are other files and folders in the userDataPath. To avoid conflict we
    // store our datastores under a studio specific directory
    const datastoreDir = path.join(basePath, "studio-datastores", datastore);
    try {
      await fs.mkdir(datastoreDir);
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }
    return datastoreDir;
  }
}

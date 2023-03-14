// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ipcRenderer } from "electron";
import { promises as fs } from "fs";
import path from "path";

import Logger from "@foxglove/log";

import { DATASTORES_DIR_NAME } from "../common/storage";
import type { Storage, StorageContent } from "../common/types";

const log = Logger.getLogger(__filename);

export default class LocalFileStorage implements Storage {
  private _userDataPath = ipcRenderer.invoke("getUserDataPath") as Promise<string>;

  public async list(datastore: string): Promise<string[]> {
    const datastoreDir = await this.ensureDatastorePath(datastore);
    const result = new Array<string>();

    const entries = await fs.readdir(datastoreDir);
    for (const entry of entries) {
      result.push(entry);
    }

    return result;
  }

  public async all(datastore: string): Promise<Uint8Array[]> {
    const datastoreDir = await this.ensureDatastorePath(datastore);
    const result = new Array<Uint8Array>();

    try {
      for (const entry of await this.list(datastore)) {
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

  public async get(
    datastore: string,
    key: string,
    options?: { encoding: undefined },
  ): Promise<Uint8Array | undefined>;
  public async get(
    datastore: string,
    key: string,
    options: { encoding: "utf8" },
  ): Promise<string | undefined>;
  public async get(
    datastore: string,
    key: string,
    options?: { encoding?: "utf8" },
  ): Promise<StorageContent | undefined> {
    const filePath = await this.makeFilePath(datastore, key);
    return await fs.readFile(filePath, options).catch((err) => {
      if (err.code !== "ENOENT") {
        throw err;
      }
      return undefined;
    });
  }

  public async put(datastore: string, key: string, value: StorageContent): Promise<void> {
    const filePath = await this.makeFilePath(datastore, key);
    log.debug(`Writing ${key} to ${filePath}`);
    await fs.writeFile(filePath, value);
  }

  public async delete(datastore: string, key: string): Promise<void> {
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
    const basePath = await this._userDataPath;
    // check that datastore matches regex [a-z]*
    // since datastore becomes a path under our userDataPath, we use this to sanitize
    if (!/[a-z-]/.test(datastore)) {
      throw new Error(`datastore (${datastore}) contains invalid characters`);
    }

    const datastoresDir = path.join(basePath, DATASTORES_DIR_NAME);
    try {
      await fs.mkdir(datastoresDir);
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }

    // There are other files and folders in the userDataPath. To avoid conflict we
    // store our datastores under a studio specific directory
    const datastoreDir = path.join(datastoresDir, datastore);
    await fs.mkdir(datastoreDir, { recursive: true });
    return datastoreDir;
  }
}

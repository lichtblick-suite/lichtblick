// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as IDB from "idb/with-async-ittr";

import Log from "@foxglove/log";
import {
  IExtensionStorage,
  StoredExtension,
} from "@foxglove/studio-base/services/IExtensionStorage";
import { ExtensionInfo } from "@foxglove/studio-base/types/Extensions";

const log = Log.getLogger(__filename);

const DATABASE_BASE_NAME = "foxglove-extensions";
const METADATA_STORE_NAME = "metadata";
const EXTENSION_STORE_NAME = "extensions";

interface ExtensionsDB extends IDB.DBSchema {
  metadata: {
    key: string;
    value: ExtensionInfo;
  };
  extensions: {
    key: string;
    value: StoredExtension;
  };
}

export class IdbExtensionStorage implements IExtensionStorage {
  #db: Promise<IDB.IDBPDatabase<ExtensionsDB>>;
  public namespace: string;

  public constructor(namespace: string) {
    this.namespace = namespace;
    this.#db = IDB.openDB<ExtensionsDB>([DATABASE_BASE_NAME, namespace].join("-"), 1, {
      upgrade: (db) => {
        log.debug("Creating extension object stores");

        db.createObjectStore(METADATA_STORE_NAME, {
          keyPath: "id",
        });

        db.createObjectStore(EXTENSION_STORE_NAME, {
          keyPath: "info.id",
        });
      },
    });
  }

  public async list(): Promise<ExtensionInfo[]> {
    const start = performance.now();
    const records = await (await this.#db).getAll(METADATA_STORE_NAME);

    log.debug(
      `Loaded ${records.length} extensions in`,
      (performance.now() - start).toFixed(1),
      "ms",
    );

    return records;
  }

  public async get(id: string): Promise<undefined | StoredExtension> {
    const start = performance.now();
    const extension = await (await this.#db).get(EXTENSION_STORE_NAME, id);
    log.debug("Getting extension", id, "took", (performance.now() - start).toFixed(1), "ms");
    return extension;
  }

  public async put(extension: StoredExtension): Promise<StoredExtension> {
    const start = performance.now();

    const transaction = (await this.#db).transaction(
      [METADATA_STORE_NAME, EXTENSION_STORE_NAME],
      "readwrite",
    );
    await Promise.all([
      transaction.db.put(METADATA_STORE_NAME, extension.info),
      transaction.db.put(EXTENSION_STORE_NAME, extension),
      transaction.done,
    ]);
    log.debug(
      "Stored extension",
      { extension },
      "in",
      (performance.now() - start).toFixed(1),
      "ms",
    );

    return extension;
  }

  public async delete(id: string): Promise<void> {
    const start = performance.now();

    const transaction = (await this.#db).transaction(
      [METADATA_STORE_NAME, EXTENSION_STORE_NAME],
      "readwrite",
    );
    await Promise.all([
      transaction.db.delete(METADATA_STORE_NAME, id),
      transaction.db.delete(EXTENSION_STORE_NAME, id),
      transaction.done,
    ]);
    log.debug("Deleted extension", id, "in", (performance.now() - start).toFixed(1), "ms");
  }
}

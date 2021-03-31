// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import idb, { DB, UpgradeDB, Transaction, Index, ObjectStore } from "idb";
import type { Writable } from "stream";

import DbWriter from "./DbWriter";
import { WritableStreamOptions } from "./types";

type UpgradeCallback = (db: UpgradeDB) => void;

type IDBTransactionMode = "readonly" | "readwrite";

export type Key = string | string[];

type WritableStream = Writable & {
  write: (arg0: any) => boolean;
  total: number;
};

export type Record = {
  key: IDBKeyRange | IDBValidKey;
  value: any;
};

type IndexDefinition = {
  name: string;
  keyPath: Key;
};

type ObjectStoreDefinition = {
  name: string;
  options?: IDBObjectStoreParameters;
  indexes?: IndexDefinition[];
};

export type DatabaseDefinition = {
  name: string;
  version: number;
  objectStores: ObjectStoreDefinition[];
};

// a wrapper around indexeddb database with flowtype definitions
// and a few helper methods to make doing common things easier
export default class Database {
  db: DB;

  // open a database - low level call if you want to migrate the database manually
  // mostly used in tests or when the structure of the database is created elsewhere
  static async open(name: string, version: number, onChange: UpgradeCallback): Promise<Database> {
    const db = await idb.open(name, version, onChange);
    return new Database(db);
  }

  // gets a database at the specified version and handles creating object stores
  // and indexes based on the supplied DatabaseDefinition object
  static async get(definition: DatabaseDefinition): Promise<Database> {
    const { name, version, objectStores } = definition;
    const db = await idb.open(name, version, (change) => {
      [...change.objectStoreNames].forEach((storeName) => change.deleteObjectStore(storeName));
      objectStores.forEach((storeDefinition) => {
        const { indexes = [] } = storeDefinition;
        const store = change.createObjectStore(storeDefinition.name, storeDefinition.options);
        indexes.forEach((index) => {
          store.createIndex(index.name, index.keyPath);
        });
      });
    });
    return new Database(db);
  }

  constructor(db: DB) {
    this.db = db;
  }

  close(): void {
    return this.db.close();
  }

  // get a single value by key - returns undefined if object cannot be found
  async get(objectStore: string, key: IDBValidKey): Promise<any> {
    const tx = this.transaction(objectStore);
    const value = await tx.objectStore(objectStore).get(key);
    await tx.complete;
    return value;
  }

  // Get all values
  async getAll(objectStore: string): Promise<any> {
    const tx = this.transaction(objectStore);
    const values = await tx.objectStore(objectStore).getAll();
    await tx.complete;
    return values;
  }

  // Get all values and keys
  async getAllKeyValues(objectStore: string): Promise<{ key: any; value: any }[]> {
    const tx = this.transaction(objectStore);
    const store = tx.objectStore(objectStore);
    const items: { key: any; value: any }[] = [];
    store.iterateCursor((cursor) => {
      if (!cursor) {
        return;
      }
      const { key, value } = cursor;
      items.push({ key, value });
      cursor.continue();
    });
    await tx.complete;
    return items;
  }

  // put a single value with an optional key - uses autoIncrement if no key provided - returns the key
  async put(objectStore: string, value: any, key?: IDBValidKey): Promise<IDBValidKey> {
    const tx = this.transaction(objectStore, "readwrite");
    const result = await tx.objectStore(objectStore).put(value, key);
    await tx.complete;
    return result;
  }

  // deletes an object by key
  async delete(objectStore: string, key: IDBValidKey): Promise<void> {
    const tx = this.transaction(objectStore, "readwrite");
    await tx.objectStore(objectStore).delete(key);
    await tx.complete;
  }

  // merges new data with existing object in store at key
  // if object is not found, throws error
  async merge(objectStore: string, value: any, key: IDBValidKey): Promise<any> {
    const tx = this.transaction(objectStore, "readwrite");
    const existing = await tx.objectStore(objectStore).get(key);
    if (!existing) {
      throw new Error(`Could not merge with ${JSON.stringify(key)}: key not found`);
    }
    const result = { ...existing, ...value };
    await tx.objectStore(objectStore).put(result, key);
    await tx.complete;
    return result;
  }

  // returns the count of objects in the object store
  async count(objectStore: string): Promise<number> {
    const tx = this.transaction(objectStore);
    const store = tx.objectStore(objectStore);
    const count = await store.count();
    await tx.complete;
    return count;
  }

  async keys(objectStore: string): Promise<(IDBKeyRange | IDBValidKey)[]> {
    const tx = this.transaction(objectStore);
    const store = tx.objectStore(objectStore);
    const items: (IDBValidKey | IDBKeyRange)[] = [];
    store.iterateKeyCursor((cursor) => {
      if (!cursor) {
        return;
      }
      items.push(cursor.key);
      cursor.continue();
    });
    await tx.complete;
    return items;
  }

  // gets a range of objects by key inclusive of start and end
  async getRange(
    objectStore: string,
    index: string | undefined,
    start: IDBValidKey,
    end: IDBValidKey,
  ): Promise<Record[]> {
    const tx = this.transaction(objectStore);
    let store: ObjectStore<any, any> | Index<any, any> = tx.objectStore(objectStore);
    if (index) {
      store = store.index(index);
    }
    const range = IDBKeyRange.bound(start, end);
    const items: { key: any; value: any }[] = [];
    store.iterateCursor(range, (cursor) => {
      if (!cursor) {
        return;
      }
      const { key, value } = cursor;
      items.push({ key, value });
      cursor.continue();
    });
    await tx.complete;
    return items;
  }

  transaction(
    storeNames: string | Array<string>,
    transactionMode: IDBTransactionMode = "readonly",
  ): Transaction {
    return this.db.transaction(storeNames, transactionMode);
  }

  // returns a writable (object mode) stream which does batching writes of records to the database
  createWriteStream(objectStore: string, options: WritableStreamOptions = {}): WritableStream {
    return (new DbWriter(this.db, objectStore, options) as any) as WritableStream;
  }
}

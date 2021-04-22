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

import { DB } from "idb";
import { Writable } from "stream";

import { WritableStreamOptions } from "./types";

const DEFAULT_BATCH_SIZE = 5000;

type WriteCallback = (err?: Error) => void;

// a node.js writable stream interface for writing records to indexeddb in batch
// this isn't meant to be created alone, but rather via database.createWriteStream()
export default class DbWriter extends Writable {
  db: DB;
  objectStore: string;
  batch: any[];
  options: WritableStreamOptions;
  total: number = 0;

  constructor(db: DB, objectStore: string, options: WritableStreamOptions) {
    super({ objectMode: true });
    this.db = db;
    this.objectStore = objectStore;
    this.options = options;
    this.batch = [];
  }

  // write a batch of records - in my experimenting its much faster than doing transactional write per item
  writeBatch(callback: WriteCallback): void {
    const batch = this.batch;
    // reset the instance batch
    this.batch = [];
    const tx = this.db.transaction(this.objectStore, "readwrite");
    const store = tx.objectStore(this.objectStore);
    for (const item of batch) {
      const toInsert = this.options.extra ? { ...item, ...this.options.extra } : item;
      store.put(toInsert);
    }
    // use setTimeout to yield the thread a bit - even with their quasi-asyncness
    // node streams can sometimes cause a bit too much throughput pressure on writes
    tx.complete.then(() => setTimeout(callback, 1)).catch(callback);
  }

  // node.js stream api implementation
  _write(chunk: any, encoding: string, callback: WriteCallback) {
    this.batch.push(chunk);
    this.total++;
    if (this.batch.length < (this.options.batchSize ?? DEFAULT_BATCH_SIZE)) {
      // can handle more data immediately
      callback();
      return;
    }
    // cannot handle more data until transaction completes
    this.writeBatch(callback);
  }

  // node.js stream api implementation
  _final(callback: WriteCallback) {
    this.writeBatch(callback);
  }
}

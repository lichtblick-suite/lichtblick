// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { set as idbSet, get as idbGet, createStore as idbCreateStore, UseStore } from "idb-keyval";
import { v4 as uuid } from "uuid";

export type RecentRecord = {
  // Record id - use IndexedDbRecentsStore.GenerateRecordId() to generate
  id: string;

  // The source id
  sourceId: string;

  // The primary text for the recent record
  title: string;

  // Optional label for the recent record
  label?: string;

  // Optional arguments stored with the recent entry
  extra?: Record<string, unknown>;
};

/**
 * IndexedDbRecentStore provides load/save operations for retrieving recent records from indexeddb
 */
export class IndexedDbRecentsStore {
  private store: UseStore;
  private key: string = "recents";

  constructor() {
    this.store = idbCreateStore("foxglove-recents", "recents");
  }

  /** Get all the recent records from the store */
  async get(): Promise<RecentRecord[]> {
    const untypedRecents = await idbGet(this.key, this.store);
    return untypedRecents as RecentRecord[];
  }

  /** Save the recents into the store */
  async set(recents: RecentRecord[]): Promise<void> {
    await idbSet(this.key, recents, this.store);
  }

  static GenerateRecordId(): string {
    return uuid();
  }
}

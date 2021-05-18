// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { fromPairs, difference } from "lodash";

import { parse as parseMessageDefinition, RosMsgDefinition } from "@foxglove/rosmsg";
import MemoryStorage from "@foxglove/studio-base/test/MemoryStorage";
import Storage, { BackingStore, BustStorageFn } from "@foxglove/studio-base/util/Storage";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import { inWebWorker } from "@foxglove/studio-base/util/workers";

export const STORAGE_ITEM_KEY_PREFIX = "msgdefn/";

let storage = new Storage();

export function bustAllMessageDefinitionCache(backingStore: BackingStore, keys: string[]): void {
  keys.forEach((key) => {
    if (key.startsWith(STORAGE_ITEM_KEY_PREFIX)) {
      backingStore.removeItem(key);
    }
  });
}

// Register the bust function once so that when localStorage is running out, the
// message definition cache can be busted.
storage.registerBustStorageFn(bustAllMessageDefinitionCache);

export const setStorageForTest = (quota?: number): void => {
  storage = new Storage(new MemoryStorage(quota));
  storage.registerBustStorageFn(bustAllMessageDefinitionCache);
};
export const restoreStorageForTest = (): void => {
  storage = new Storage();
};

export const getStorageForTest = (): Storage => storage;

function maybeWriteLocalStorageCache(
  md5Sum: string,
  newValue: RosMsgDefinition[],
  allStoredMd5Sums: string[],
  usedmd5Sums: string[],
): void {
  const newKey = `${STORAGE_ITEM_KEY_PREFIX}${md5Sum}`;
  const bustUnusedMessageDefinition: BustStorageFn = (usedStorage) => {
    // Keep all localStorage entries that aren't parsed message definitions.
    const itemsToRemove = difference(allStoredMd5Sums, usedmd5Sums);
    itemsToRemove.forEach((md5ToRemove) => {
      usedStorage.removeItem(`${STORAGE_ITEM_KEY_PREFIX}${md5ToRemove}`);
    });
  };
  storage.setItem(newKey, newValue, bustUnusedMessageDefinition);
}

class ParseMessageDefinitionCache {
  // Used because we may load extraneous definitions that we need to clear.
  _usedMd5Sums = new Set<string>();
  _stringDefinitionsToParsedDefinitions: {
    [key: string]: RosMsgDefinition[];
  } = {};
  _md5SumsToParsedDefinitions: {
    [key: string]: RosMsgDefinition[];
  } = {};
  _hashesToParsedDefinitions: {
    [key: string]: RosMsgDefinition[];
  } = {};
  _localStorageCacheDisabled = false;

  constructor() {
    const hashesToParsedDefinitionsEntries = storage
      .keys()
      .filter((key) => key.startsWith(STORAGE_ITEM_KEY_PREFIX))
      .map((key) => [key.substring(STORAGE_ITEM_KEY_PREFIX.length), storage.getItem(key)]);
    this._md5SumsToParsedDefinitions = fromPairs(hashesToParsedDefinitionsEntries);
  }

  parseMessageDefinition(messageDefinition: string, md5Sum?: string): RosMsgDefinition[] {
    // What if we already have this message definition stored?
    if (md5Sum != undefined) {
      const storedDefinition = this.getStoredDefinition(md5Sum);
      if (storedDefinition != undefined) {
        return storedDefinition;
      }
    }

    // If we don't have it stored, we have to parse it.
    const parsedDefinition =
      this._stringDefinitionsToParsedDefinitions[messageDefinition] ??
      parseMessageDefinition(messageDefinition);
    this._stringDefinitionsToParsedDefinitions[messageDefinition] = parsedDefinition;
    if (md5Sum != undefined) {
      this._hashesToParsedDefinitions[md5Sum] = parsedDefinition;
      if (!this._localStorageCacheDisabled) {
        this._md5SumsToParsedDefinitions[md5Sum] = parsedDefinition;
        try {
          maybeWriteLocalStorageCache(
            md5Sum,
            parsedDefinition,
            Object.keys(this._md5SumsToParsedDefinitions),
            [...this._usedMd5Sums],
          );
        } catch (e) {
          sendNotification("Unable to save message definition to localStorage", e, "user", "warn");
          this._localStorageCacheDisabled = true;
        }
      }
    }
    return parsedDefinition;
  }

  getStoredDefinition(md5Sum: string): RosMsgDefinition[] | undefined {
    this._usedMd5Sums.add(md5Sum);

    if (this._hashesToParsedDefinitions[md5Sum]) {
      return this._hashesToParsedDefinitions[md5Sum];
    }
    if (this._md5SumsToParsedDefinitions[md5Sum]) {
      const parsedDefinition = this._md5SumsToParsedDefinitions[md5Sum];
      if (parsedDefinition) {
        this._hashesToParsedDefinitions[md5Sum] = parsedDefinition;
      }
      return parsedDefinition;
    }
    return undefined;
  }

  getMd5sForStoredDefinitions(): string[] {
    if (this._localStorageCacheDisabled) {
      return [];
    }
    return Object.keys(this._md5SumsToParsedDefinitions);
  }
}

export const CacheForTesting = ParseMessageDefinitionCache;

// We use this as a singleton - don't expose it in workers.
if (inWebWorker()) {
  throw new Error("Cannot require parseMessageDefinitionCache in a web worker context");
}
export default new ParseMessageDefinitionCache();

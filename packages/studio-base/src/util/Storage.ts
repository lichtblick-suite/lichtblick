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

export interface BackingStore {
  // eslint-disable-next-line no-restricted-syntax
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
  clear(): void;
  removeItem(key: string): void;
}

// Small wrapper around localStorage for convenience.
export default class Storage {
  private _backingStore: BackingStore;

  constructor(backingStore: BackingStore = window.localStorage) {
    this._backingStore = backingStore;
  }

  clear(): void {
    this._backingStore.clear();
  }

  keys(): string[] {
    // Filter out internal keys for MemoryStorage instances.
    return Object.keys(this._backingStore).filter((key) => !key.startsWith("_internal_"));
  }

  getItem<T>(key: string): T | undefined {
    const val = this._backingStore.getItem(key);

    // if a non-json value gets into local storage we should ignore it
    try {
      return val != undefined && val.length > 0 ? (JSON.parse(val) as T) : undefined;
    } catch (e) {
      // suppress logging during tests - otherwise it prints out a stack trace
      // which makes it look like a test is failing
      if (process.env.NODE_ENV !== "test") {
        console.error("Unable to retrieve key", key, "from storage", e);
      }
      return undefined;
    }
  }

  setItem(key: string, value: unknown): void {
    const strValue = JSON.stringify(value);
    this._backingStore.setItem(key, strValue);
  }

  removeItem(key: string): void {
    this._backingStore.removeItem(key);
  }
}

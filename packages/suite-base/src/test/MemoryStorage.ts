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

// mock storage object to monkeypatch missing localstorage for tests

const DEFAULT_LOCAL_STORAGE__QUOTA = 5000000;

export default class MemoryStorage {
  // Use `__` to mark the fields as internal so we can filter them out in Storage when getting keys using Object.keys(storage).
  #internal_items: Record<string, string> = {};
  #internal_quota: number;
  [key: string]: unknown;

  public constructor(quota?: number) {
    this.#internal_quota = quota ?? DEFAULT_LOCAL_STORAGE__QUOTA;
  }

  public clear(): void {
    this.#internal_items = {};
  }

  public getItem(key: string): string | undefined {
    return this.#internal_items[key];
  }

  #getUsedSize(): number {
    return Object.keys(this.#internal_items).reduce((memo, key) => {
      return memo + new Blob([this.getItem(key)!]).size;
    }, 0);
  }

  public setItem(key: string, value: string): void {
    const valueByteSize = new Blob([value]).size;
    const newSize = this.#getUsedSize() + valueByteSize;
    if (newSize > this.#internal_quota) {
      throw new Error("Exceeded storage limit");
    }
    this.#internal_items[key] = value;
    this[key] = value;
  }

  public removeItem(key: string): void {
    delete this.#internal_items[key];
    delete this[key];
  }
}

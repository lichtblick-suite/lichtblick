// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A map that allows multiple values for a single key.
 */
export class MultiMap<TKey, TValue> {
  #map = new Map<TKey, TValue[]>();

  public get(key: TKey): TValue[] | undefined {
    return this.#map.get(key);
  }

  public set(key: TKey, value: TValue): void {
    const values = this.#map.get(key);
    if (values == undefined) {
      this.#map.set(key, [value]);
    } else if (!values.includes(value)) {
      values.push(value);
    }
  }

  public delete(key: TKey, value: TValue): void {
    const values = this.#map.get(key);
    if (values != undefined) {
      const index = values.indexOf(value);
      if (index >= 0) {
        values.splice(index, 1);
        if (values.length === 0) {
          this.#map.delete(key);
        }
      }
    }
  }

  public deleteAll(key: TKey): void {
    this.#map.delete(key);
  }

  public clear(): void {
    this.#map.clear();
  }
}

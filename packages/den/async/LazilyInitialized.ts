// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Holds a value generated from a calling a given async function. The function is called at most
 * once and is not called until the first `get()` of the LazilyInitialized object.
 */
export default class LazilyInitialized<T> {
  // The promise and compute function are held separately so the function can be garbage collected
  // when it is no longer needed.
  #state: { promise: Promise<T> } | { promise?: undefined; compute: () => Promise<T> };

  public constructor(compute: () => Promise<T>) {
    this.#state = { compute };
  }

  public async get(): Promise<T> {
    if (this.#state.promise) {
      return await this.#state.promise;
    }
    const promise = this.#state.compute();
    this.#state = { promise };
    return await promise;
  }
}

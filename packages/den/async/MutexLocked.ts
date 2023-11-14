// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex } from "async-mutex";

/**
 * A wrapper around an object that ensures all accesses are guarded by a mutex lock.
 *
 * This is less race-prone than using an async-mutex directly because it requires all external
 * access to be protected by the mutex.
 */
export default class MutexLocked<T> {
  #mutex = new Mutex();
  public constructor(private value: T) {}

  public async runExclusive<Result>(body: (value: T) => Promise<Result>): Promise<Result> {
    return await this.#mutex.runExclusive(async () => await body(this.value));
  }

  /**
   * @returns a boolean indicating if the mutex is currently locked. Does not block or wait.
   */
  public isLocked(): boolean {
    return this.#mutex.isLocked();
  }
}

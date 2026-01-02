// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type ObjectPoolOptions = {
  /**
   * Limits the number of elements in the pool at a given time.
   * After the limit is reached, releasing an object will not add it to the pool.
   */
  maxCapacity?: number;
};
/**
 * An object pool for reusing objects.
 * Can be helpful for reusing objects that are either expensive to create or
 * frequently used and discarded to avoid garbage collection.
 *
 * Options can be passed to it to limit the number of elements it has at once.
 *
 */
export class ObjectPool<T> {
  #init: () => T;
  #maxCapacity?: number;
  #objects: T[] = [];

  /**
   *
   * @param init - A function that returns a new object.
   * @param options.maxCapacity - Limits the number of elements in the pool at a given time.
   */
  public constructor(init: () => T, options: ObjectPoolOptions = {}) {
    this.#init = init;
    this.#maxCapacity = options.maxCapacity;
  }

  /** Returns an object from the pool or instantiates and returns a new one if
   * there are none.
   */
  public acquire(): T {
    return this.#objects.pop() ?? this.#init();
  }

  /** Release a object back to the pool to be reused.
   * If the maxCapacity is defined and has been reached it will be dropped.
   */
  public release(obj: T): void {
    if (this.#maxCapacity == undefined || this.#objects.length < this.#maxCapacity) {
      this.#objects.push(obj);
    }
  }

  /**
   * Clears all objects in the pool.
   * Returns the objects that were cleared; this can be helpful if they have
   * custom dispose logic.
   */
  public clear(): T[] {
    return this.#objects.splice(0);
  }
}

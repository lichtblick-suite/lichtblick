// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * VecQueue provides an interface for a FIFO queue backed by a growing circular buffer.
 *
 * `enqueue` inserts items at the end of the queue (possibly growing the underlying buffer)
 * `dequeue` removes items from the front of the queue
 */
export class VecQueue<T> {
  #readPos = 0;
  #writePos = 0;
  #buffer = new Array<T | undefined>(4);

  /**
   * Add an item at the end of the queue. If the queue is full the underlying buffer is grown.
   * @param item the item to insert into the queue
   */
  public enqueue(item: T): void {
    // When the write position is past the buffer end, we need to take one of two actions:
    // 1. If read position is at 0, we grow the array and write to the end
    // 2. Otherwise, we wrap write to the front and continue writing
    if (this.#writePos >= this.#buffer.length) {
      // Read head is at the start, we will write at the end
      if (this.#readPos === 0) {
        this.#addCapacity();
      } else {
        this.#writePos = this.#writePos % this.#buffer.length;
      }
    }

    // Read is only 1 away from write, so once the item is written our write head would be at the read head
    // we can't allow that so we need to add capacity
    if (this.#readPos - this.#writePos === 1) {
      this.#addCapacity();
    }

    // write to position and increment
    this.#buffer[this.#writePos] = item;
    this.#writePos++;
  }

  /**
   * Remove an item from the front of the queue and return it.
   * @returns the first item in the queue or undefined if the queue is empty
   */
  public dequeue(): T | undefined {
    if (this.#readPos === this.#writePos) {
      return undefined;
    }

    // Read position may have incremented from a previous read
    // and we need to maybe wrap it to our size
    if (this.#readPos >= this.#buffer.length) {
      this.#readPos = this.#readPos % this.#buffer.length;
    }

    const item = this.#buffer[this.#readPos];
    this.#buffer[this.#readPos] = undefined;
    this.#readPos += 1;
    return item;
  }

  /**
   * @returns the number of items in the queue
   */
  public size(): number {
    if (this.#writePos >= this.#readPos) {
      return this.#writePos - this.#readPos;
    }

    return this.#buffer.length - this.#readPos + this.#writePos;
  }

  /**
   * @returns the capacity of the underlying circular buffer
   */
  public capacity(): number {
    return this.#buffer.length;
  }

  /**
   * Clear the queue.
   */
  public clear(): void {
    this.#buffer.length = 0;
    this.#writePos = 0;
    this.#readPos = 0;
  }

  #addCapacity() {
    const oldLen = this.#buffer.length;
    this.#buffer.length = this.#buffer.length * 2;

    // if the read head is before write, then there's no change to index management and write can continue at end
    // if the read head is ahead of write, then we can un-wrap the write bytes
    if (this.#readPos <= this.#writePos) {
      return;
    }

    const newLen = this.#buffer.length;

    // if writePos is past half it is cheaper to move the read elements
    if (this.#writePos >= oldLen / 2) {
      const oldCount = oldLen - this.#readPos;
      // move the read elements to the end giving us the most room to write
      const offset = newLen - oldCount;
      for (let i = 0; i < oldCount; ++i) {
        this.#buffer[offset + i] = this.#buffer[this.#readPos + i];
        this.#buffer[this.#readPos + i] = undefined;
      }
      this.#readPos = offset;
    } else {
      // copy all the elements from start to writePos - 1 to the end of the extended buffer
      for (let i = 0; i < this.#writePos; ++i) {
        this.#buffer[oldLen + i] = this.#buffer[i];
        this.#buffer[i] = undefined;
      }

      this.#writePos = oldLen + this.#writePos;
    }
  }
}

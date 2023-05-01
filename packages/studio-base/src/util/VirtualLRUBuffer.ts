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

import { simplify, substract, unify } from "intervals-fn";

import { isRangeCoveredByRanges, Range } from "./ranges";

// VirtualLRUBuffer works similarly to a regular Node.js `Buffer`, but it has some additional features:
// 1. It can span buffers larger than `buffer.kMaxLength` (typically 2GiB).
// 2. It can take up much less memory when needed by evicting its least recently used ranges from
//    memory.
//
// This works by allocating multiple smaller buffers underneath, which we call "blocks". There are
// two main operations:
// - `VirtualLRUBuffer#slice`: works just like `Buffer#slice`, but stitches data together from the
//    underlying blocks. It throws an error when the underlying data is not currently set, so be
//    sure to check that first using `VirtualLRUBuffer#hasData`, because the underlying block might
//    have been evicted.
// - `VirtualLRUBuffer#copyFrom`: similar to `Buffer#copy`. Will set `VirtualLRUBuffer#hasData` to true
//    for the range that you copied in, until the data gets evicted through subsequent
//    `VirtualLRUBuffer#copyFrom` calls.
//
// As said above, you can use `VirtualLRUBuffer#hasData` to see if a range can be sliced out. You can
// also use `VirtualLRUBuffer#getRangesWithData` to get the full list of ranges for which data is set,
// as an array of `Range` objects with `start` (inclusive) and `end` (exclusive) numbers.
//
// Create a new instance by calling `new VirtualLRUBuffer({ size })`. By default this will not do any
// eviction, and so it will take up `size` bytes of memory.
//
// To limit the memory usage, you can pass in a additional options to the constructor: `blockSize`
// (in bytes) and `numberOfBlocks`. The least recently used block will get evicted when writing to
// an unallocated block using `VirtualLRUBuffer.copyFrom`.

const kMaxLength = Math.pow(2, 32);

export default class VirtualLRUBuffer {
  public readonly byteLength: number; // How many bytes does this buffer represent.
  #blocks: Uint8Array[] = []; // Actual `Buffer` for each block.
  // How many bytes is each block. This used to work up to 2GiB minus a byte, and now seems to crash
  // past 2GiB minus 4KiB. Default to 1GiB so we don't get caught out next time the limit drops.
  #blockSize: number = Math.trunc(kMaxLength / 2);
  #numberOfBlocks: number = Infinity; // How many blocks are we allowed to have at any time.
  #lastAccessedBlockIndices: number[] = []; // Indexes of blocks, from least to most recently accessed.
  #rangesWithData: Range[] = []; // Ranges for which we have data copied in (and have not been evicted).

  public constructor(options: { size: number; blockSize?: number; numberOfBlocks?: number }) {
    this.byteLength = options.size;
    this.#blockSize = options.blockSize ?? this.#blockSize;
    this.#numberOfBlocks = options.numberOfBlocks ?? this.#numberOfBlocks;
  }

  // Check if the range between `start` (inclusive) and `end` (exclusive) fully contains data
  // copied in through `VirtualLRUBuffer#copyFrom`.
  public hasData(start: number, end: number): boolean {
    return isRangeCoveredByRanges({ start, end }, this.#rangesWithData);
  }

  // Get the minimal number of start-end pairs for which `VirtualLRUBuffer#hasData` will return true.
  // The array is sorted by `start`.
  public getRangesWithData(): Range[] {
    return this.#rangesWithData;
  }

  // Copy data from the `source` buffer to the byte at `targetStart` in the VirtualLRUBuffer.
  public copyFrom(source: Uint8Array, targetStart: number): void {
    if (targetStart < 0 || targetStart >= this.byteLength) {
      throw new Error("VirtualLRUBuffer#copyFrom invalid input");
    }

    const range = { start: targetStart, end: targetStart + source.byteLength };

    // Walk through the blocks and copy the data over. If the input buffer is too large we will
    // currently just evict the earliest copied in data.
    let position = range.start;
    while (position < range.end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock } =
        this.#calculatePosition(position);
      copy(source, this.#getBlock(blockIndex), positionInBlock, position - targetStart);
      position += remainingBytesInBlock;
    }

    this.#rangesWithData = simplify(unify([range], this.#rangesWithData));
  }

  // Get a slice of data. Throws if `VirtualLRUBuffer#hasData(start, end)` is false, so be sure to check
  // that first. Will use an efficient `slice` instead of a copy if all the data happens to
  // be contained in one block.
  public slice(start: number, end: number): Uint8Array {
    const size = end - start;
    if (start < 0 || end > this.byteLength || size <= 0 || size > kMaxLength) {
      throw new Error("VirtualLRUBuffer#slice invalid input");
    }
    if (!this.hasData(start, end)) {
      throw new Error("VirtualLRUBuffer#slice range has no data set");
    }

    const startPositionData = this.#calculatePosition(start);
    if (size <= startPositionData.remainingBytesInBlock) {
      // If the entire range that we care about are contained in one block, do an efficient
      // `Buffer#slice` instead of copying data to a new Buffer.
      const { blockIndex, positionInBlock } = startPositionData;
      return this.#getBlock(blockIndex).slice(positionInBlock, positionInBlock + size);
    }

    const result = new Uint8Array(size);
    let position = start;
    while (position < end) {
      const { blockIndex, positionInBlock, remainingBytesInBlock } =
        this.#calculatePosition(position);
      // Note that these calls to `_getBlock` will never cause any eviction, since we verified using
      // the `VirtualLRUBuffer#hasData` precondition that all these buffers exist already.
      copy(this.#getBlock(blockIndex), result, position - start, positionInBlock);
      position += remainingBytesInBlock;
    }
    return result;
  }

  // Get a reference to a block, and mark it as most recently used. Might evict older blocks.
  #getBlock(index: number): Uint8Array {
    if (!this.#blocks[index]) {
      // If a block is not allocated yet, do so.
      let size = this.#blockSize;
      if ((index + 1) * this.#blockSize > this.byteLength) {
        size = this.byteLength % this.#blockSize; // Trim the last block to match the total size.
      }
      // It's okay to use `allocUnsafe` because we don't allow reading data from ranges that have
      // not explicitly be filled using `VirtualLRUBuffer#copyFrom`.
      this.#blocks[index] = new Uint8Array(size);
    }
    // Put the current index to the end of the list, while avoiding duplicates.
    this.#lastAccessedBlockIndices = [
      ...this.#lastAccessedBlockIndices.filter((idx) => idx !== index),
      index,
    ];
    if (this.#lastAccessedBlockIndices.length > this.#numberOfBlocks) {
      // If we have too many blocks, remove the least recently used one.
      // Note that we don't reuse blocks, since other code might still hold a reference to it
      // via the `VirtualLRUBuffer#slice` method.
      const deleteIndex = this.#lastAccessedBlockIndices.shift();
      if (deleteIndex != undefined) {
        delete this.#blocks[deleteIndex];
        // Remove the range that we evicted from `_rangesWithData`, since the range doesn't have data now.
        this.#rangesWithData = simplify(
          substract(this.#rangesWithData, [
            { start: deleteIndex * this.#blockSize, end: (deleteIndex + 1) * this.#blockSize },
          ]),
        );
      }
    }
    const block = this.#blocks[index];
    if (!block) {
      throw new Error("invariant violation - no block at index");
    }
    return block;
  }

  // For a given position, calculate `blockIndex` (which block is this position in);
  // `positionInBlock` (byte index of `position` within that block); and `remainingBytesInBlock`
  // (how many bytes are there in that block after that position).
  #calculatePosition(position: number) {
    if (position < 0 || position >= this.byteLength) {
      throw new Error("VirtualLRUBuffer#_calculatePosition invalid input");
    }
    const blockIndex = Math.floor(position / this.#blockSize);
    const positionInBlock = position - blockIndex * this.#blockSize;
    const remainingBytesInBlock = this.#getBlock(blockIndex).byteLength - positionInBlock;
    return { blockIndex, positionInBlock, remainingBytesInBlock };
  }
}

/**
 * Copy part of a Uint8Array into another Uint8Array
 * @param source Source to copy from
 * @param target Destination to copy to
 * @param targetStart Index to start copying bytes to in `target`
 * @param sourceStart Index to start copying bytes from in `source`
 * @param sourceEnd Index to stop copying bytes from in `source`
 */
function copy(
  source: Uint8Array,
  target: Uint8Array,
  targetStart: number,
  sourceStart: number,
  sourceEnd?: number,
): void {
  const count = (sourceEnd ?? source.byteLength) - sourceStart;
  for (let i = 0; i < count; i++) {
    target[targetStart + i] = source[sourceStart + i]!;
  }
}

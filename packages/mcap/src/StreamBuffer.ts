// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A growable buffer for use when processing a stream of data.
 */
export default class StreamBuffer {
  private buffer: ArrayBuffer;
  public view: DataView;

  constructor(initialCapacity = 0) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer, 0, 0);
  }

  bytesRemaining(): number {
    return this.view.byteLength;
  }

  /** Mark some data as consumed, so the memory can be reused when new data is appended. */
  consume(count: number): void {
    this.view = new DataView(
      this.buffer,
      this.view.byteOffset + count,
      this.view.byteLength - count,
    );
  }

  /** Add data to the buffer, shifting existing data or reallocating if necessary. */
  append(data: Uint8Array): void {
    if (this.view.byteOffset + this.view.byteLength + data.byteLength <= this.buffer.byteLength) {
      // Data fits by appending only
      const array = new Uint8Array(this.view.buffer, this.view.byteOffset);
      array.set(data, this.view.byteLength);
      this.view = new DataView(
        this.buffer,
        this.view.byteOffset,
        this.view.byteLength + data.byteLength,
      );
    } else if (this.view.byteLength + data.byteLength <= this.buffer.byteLength) {
      // Data fits in allocated buffer but requires moving existing data to start of buffer
      const oldData = new Uint8Array(this.buffer, this.view.byteOffset, this.view.byteLength);
      const array = new Uint8Array(this.buffer);
      array.set(oldData, 0);
      array.set(data, oldData.byteLength);
      this.view = new DataView(this.buffer, 0, this.view.byteLength + data.byteLength);
    } else {
      // New data doesn't fit, copy to a new buffer

      // Currently, the new buffer size may be smaller than the old size. For future optimizations,
      // we could consider making the buffer size increase monotonically.

      const oldData = new Uint8Array(this.buffer, this.view.byteOffset, this.view.byteLength);
      this.buffer = new ArrayBuffer((this.view.byteLength + data.byteLength) * 2);
      const array = new Uint8Array(this.buffer);
      array.set(oldData, 0);
      array.set(data, oldData.byteLength);
      this.view = new DataView(this.buffer, 0, this.view.byteLength + data.byteLength);
    }
  }
}

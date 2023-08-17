// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IWritable, McapTypes } from "@mcap/core";

/**
 * In-memory buffer used for reading and writing MCAP files in tests. Can be used as both an IReadable and an IWritable.
 */
export class TempBuffer implements McapTypes.IReadable, IWritable {
  #buffer = new ArrayBuffer(1024);
  #size = 0;

  public position(): bigint {
    return BigInt(this.#size);
  }

  public async write(data: Uint8Array): Promise<void> {
    if (this.#size + data.byteLength > this.#buffer.byteLength) {
      const newBuffer = new ArrayBuffer(this.#size + data.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(this.#buffer));
      this.#buffer = newBuffer;
    }
    new Uint8Array(this.#buffer, this.#size).set(data);
    this.#size += data.byteLength;
  }

  public async size(): Promise<bigint> {
    return BigInt(this.#size);
  }

  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset < 0n || offset + size > BigInt(this.#buffer.byteLength)) {
      throw new Error("read out of range");
    }
    return new Uint8Array(this.#buffer, Number(offset), Number(size));
  }

  public get(): Uint8Array {
    return new Uint8Array(this.#buffer, 0, this.#size);
  }
}

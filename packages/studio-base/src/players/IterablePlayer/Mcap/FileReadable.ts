// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export class FileReadable {
  public constructor(private file: File) {}
  public async size(): Promise<bigint> {
    return BigInt(this.file.size);
  }
  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset + size > this.file.size) {
      throw new Error(
        `Read of ${size} bytes at offset ${offset} exceeds file size ${this.file.size}`,
      );
    }
    return new Uint8Array(
      await this.file.slice(Number(offset), Number(offset + size)).arrayBuffer(),
    );
  }
}

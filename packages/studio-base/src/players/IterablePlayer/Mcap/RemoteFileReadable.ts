// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import BrowserHttpReader from "@foxglove/studio-base/util/BrowserHttpReader";
import CachedFilelike from "@foxglove/studio-base/util/CachedFilelike";

export class RemoteFileReadable {
  private remoteReader: CachedFilelike;

  public constructor(url: string) {
    const fileReader = new BrowserHttpReader(url);
    this.remoteReader = new CachedFilelike({
      fileReader,
      cacheSizeInBytes: 1024 * 1024 * 200, // 200MiB
    });
  }

  public async open(): Promise<void> {
    await this.remoteReader.open(); // Important that we call this first, because it might throw an error if the file can't be read.
  }

  public async size(): Promise<bigint> {
    return BigInt(this.remoteReader.size());
  }
  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset + size > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Read too large: offset ${offset}, size ${size}`);
    }
    return await this.remoteReader.read(Number(offset), Number(size));
  }
}

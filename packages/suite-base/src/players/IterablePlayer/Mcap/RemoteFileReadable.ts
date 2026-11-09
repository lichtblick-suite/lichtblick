// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

import BrowserHttpReader from "@lichtblick/suite-base/util/BrowserHttpReader";
import CachedFilelike from "@lichtblick/suite-base/util/CachedFilelike";
import { getTelemetry } from "@lichtblick/suite-base/util/telemetry";

import { BatchingReadable } from "./BatchingReadable";
import type { RemoteFileReadableOptions } from "./RemoteFileReadable.types";
import { BYTES_READ_METRIC, DEFAULT_CACHE_SIZE_BYTES, READ_REQUESTS_METRIC } from "./constants";

export class RemoteFileReadable {
  readonly #remoteReader: CachedFilelike;
  readonly #batchingReadable: BatchingReadable;

  public constructor(url: string, options?: RemoteFileReadableOptions) {
    const fileReader = new BrowserHttpReader(url);
    this.#remoteReader = new CachedFilelike({
      fileReader,
      cacheSizeInBytes: options?.cacheSizeInBytes ?? DEFAULT_CACHE_SIZE_BYTES,
      readAheadEnabled: options?.readAheadEnabled,
      readAheadBufferBytes: options?.readAheadBufferBytes,
    });

    const inner: McapTypes.IReadable = {
      size: async () => BigInt(this.#remoteReader.size()),
      read: async (offset, size) => {
        if (offset + size > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error(`Read too large: offset ${offset}, size ${size}`);
        }
        // Resolved per call: in the source worker the realm sink is installed after construction.
        const telemetry = getTelemetry();
        if (!telemetry.isEnabled()) {
          return await this.#remoteReader.read(Number(offset), Number(size));
        }
        telemetry.counter(READ_REQUESTS_METRIC, 1, "count", "pipeline");
        const data = await this.#remoteReader.read(Number(offset), Number(size));
        telemetry.counter(BYTES_READ_METRIC, data.byteLength, "bytes", "pipeline");
        return data;
      },
    };
    this.#batchingReadable = new BatchingReadable(inner);
  }

  public async open(): Promise<void> {
    await this.#remoteReader.open(); // Important that we call this first, because it might throw an error if the file can't be read.
  }

  public async size(): Promise<bigint> {
    return BigInt(this.#remoteReader.size());
  }
  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    return await this.#batchingReadable.read(offset, size);
  }

  public close(): void {
    this.#remoteReader.close();
  }
}

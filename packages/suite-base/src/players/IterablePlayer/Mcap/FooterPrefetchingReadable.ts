// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

// Footer (29 bytes) + trailing magic (8), fixed by the MCAP spec; matches `footerAndMagicReadLength`
// in @mcap/core's McapIndexedReader.
const FOOTER_AND_MAGIC_READ_LENGTH = 37n;

// Starts fetching the MCAP footer as soon as size() resolves, so it runs in parallel with the
// header reads that McapIndexedReader.Initialize() performs first. Any other range passes through.
export class FooterPrefetchingReadable implements McapTypes.IReadable {
  // Public so tests can match Initialize() calls to the wrapped readable.
  public readonly inner: McapTypes.IReadable;
  #footerOffset?: bigint;
  #footerPrefetch?: Promise<Uint8Array>;

  public constructor(inner: McapTypes.IReadable) {
    this.inner = inner;
  }

  public async size(): Promise<bigint> {
    const size = await this.inner.size();
    if (!this.#footerPrefetch) {
      const offset = size - FOOTER_AND_MAGIC_READ_LENGTH;
      if (offset >= 0n) {
        const prefetch = this.inner.read(offset, FOOTER_AND_MAGIC_READ_LENGTH);
        // Avoid an unhandled rejection if the footer is never read; read() still surfaces it.
        prefetch.catch(() => undefined);
        this.#footerOffset = offset;
        this.#footerPrefetch = prefetch;
      }
    }
    return size;
  }

  public async read(offset: bigint, length: bigint): Promise<Uint8Array> {
    if (
      this.#footerPrefetch &&
      offset === this.#footerOffset &&
      length === FOOTER_AND_MAGIC_READ_LENGTH
    ) {
      // A failed prefetch is retried once on demand.
      return await this.#footerPrefetch.catch(async () => await this.inner.read(offset, length));
    }
    return await this.inner.read(offset, length);
  }
}

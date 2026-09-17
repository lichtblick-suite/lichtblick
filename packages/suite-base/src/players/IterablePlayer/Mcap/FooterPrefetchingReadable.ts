// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

// The MCAP footer record is fixed-size by the file FORMAT SPEC itself (not just this @mcap/core
// version), so this constant is stable across @mcap/core releases:
//   Opcode(1) + record content length(8) + summaryStart(8) + summaryOffsetStart(8) + crc(4) = 29
// bytes, plus the 8-byte trailing magic = 37 bytes. `McapIndexedReader.Initialize()` computes and
// reads this exact same length/offset from the end of the file; see its `footerAndMagicReadLength`
// in @mcap/core's source.
const FOOTER_AND_MAGIC_READ_LENGTH = 37n;

/**
 * Wraps an `IReadable` so that, as soon as `size()` resolves, it speculatively starts fetching the
 * MCAP footer region (fixed-size, see above) *in parallel* -- before the caller
 * (`McapIndexedReader.Initialize()`, from the external `@mcap/core` package) even finishes reading
 * the file header. `Initialize()` reads the header and then the footer sequentially even though
 * the footer's location only depends on `size()` (already known, not on anything parsed from the
 * header) -- so those two reads are independent and this removes one full network round-trip's
 * worth of latency from the file-open critical path, without needing to modify `@mcap/core` itself
 * (an external dependency we can't patch -- see ORIONINIT-211029 backlog item #10).
 *
 * Purely additive and safe: if the caller ever requests a different range than the one prefetched
 * (e.g. a different/older @mcap/core version computes the footer length differently, or the file
 * is too small to have a footer at all), this transparently falls back to a normal `read()` call --
 * it never changes *what* bytes are returned, only *when* the underlying fetch for the footer
 * region is started.
 */
export class FooterPrefetchingReadable implements McapTypes.IReadable {
  // Kept public (not `#inner`) so callers/tests can identify the underlying readable this wraps,
  // e.g. to confirm connection pooling/reuse decisions made against the *unwrapped* instance still
  // apply correctly across this transparent wrapper.
  public readonly inner: McapTypes.IReadable;
  #footerPrefetch?: Promise<{ offset: bigint; length: bigint; data: Uint8Array }>;

  public constructor(inner: McapTypes.IReadable) {
    this.inner = inner;
  }

  public async size(): Promise<bigint> {
    const size = await this.inner.size();
    if (!this.#footerPrefetch) {
      const length = FOOTER_AND_MAGIC_READ_LENGTH;
      const offset = size - length;
      if (offset >= 0n) {
        const prefetch = this.inner
          .read(offset, length)
          .then((data) => ({ offset, length, data }));
        // Swallow here to avoid an "unhandled rejection" warning if Initialize() never actually
        // requests this exact range (e.g. it errors out earlier for an unrelated reason) -- the
        // real rejection still surfaces normally through read() below if it IS awaited there.
        prefetch.catch(() => {
          // Intentionally empty: see comment above.
        });
        this.#footerPrefetch = prefetch;
      }
    }
    return size;
  }

  public async read(offset: bigint, length: bigint): Promise<Uint8Array> {
    if (this.#footerPrefetch) {
      const prefetch = await this.#footerPrefetch;
      if (prefetch.offset === offset && prefetch.length === length) {
        return prefetch.data;
      }
    }
    return await this.inner.read(offset, length);
  }
}

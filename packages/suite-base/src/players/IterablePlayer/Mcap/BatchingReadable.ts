// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

const BATCH_GAP_THRESHOLD_BYTES = 64n * 1024n;
const BATCH_MAX_COALESCED_BYTES = 4n * 1024n * 1024n;

type PendingRead = {
  offset: bigint;
  size: bigint;
  resolve: (data: Uint8Array) => void;
  reject: (error: Error) => void;
};

/**
 * Coalesces read() calls that arrive within the same microtask tick into fewer,
 * larger reads against the wrapped readable, reducing HTTP Range requests for
 * MCAP files with many small chunks. Reads are merged when the gap between them
 * is smaller than `gapThresholdBytes`, up to a merged span of `maxCoalescedBytes`.
 */
export class BatchingReadable implements McapTypes.IReadable {
  readonly #inner: McapTypes.IReadable;
  readonly #gapThresholdBytes: bigint;
  readonly #maxCoalescedBytes: bigint;
  readonly #pending: PendingRead[] = [];
  #scheduled = false;

  public constructor(
    inner: McapTypes.IReadable,
    options?: { gapThresholdBytes?: bigint; maxCoalescedBytes?: bigint },
  ) {
    this.#inner = inner;
    this.#gapThresholdBytes = options?.gapThresholdBytes ?? BATCH_GAP_THRESHOLD_BYTES;
    this.#maxCoalescedBytes = options?.maxCoalescedBytes ?? BATCH_MAX_COALESCED_BYTES;
  }

  public async size(): Promise<bigint> {
    return await this.#inner.size();
  }

  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    return await new Promise<Uint8Array>((resolve, reject) => {
      this.#pending.push({ offset, size, resolve, reject });
      if (!this.#scheduled) {
        this.#scheduled = true;
        void Promise.resolve().then(async () => {
          await this.#flush();
        });
      }
    });
  }

  async #flush(): Promise<void> {
    this.#scheduled = false;
    const batch = this.#pending.splice(0);
    if (batch.length === 0) {
      return;
    }

    batch.sort((a, b) => {
      if (a.offset < b.offset) {
        return -1;
      }
      if (a.offset > b.offset) {
        return 1;
      }
      return 0;
    });

    type Group = { start: bigint; end: bigint; members: PendingRead[] };
    const groups: Group[] = [];
    for (const read of batch) {
      const current = groups.at(-1);
      const readEnd = read.offset + read.size;
      const mergedEnd = current != undefined && current.end > readEnd ? current.end : readEnd;
      if (
        current != undefined &&
        read.offset <= current.end + this.#gapThresholdBytes &&
        mergedEnd - current.start <= this.#maxCoalescedBytes
      ) {
        current.end = mergedEnd;
        current.members.push(read);
      } else {
        groups.push({ start: read.offset, end: readEnd, members: [read] });
      }
    }

    await Promise.all(
      groups.map(async (group) => {
        const groupStart = group.start;
        try {
          const data = await this.#inner.read(groupStart, group.end - groupStart);
          const first = group.members[0];
          if (group.members.length === 1 && first != undefined) {
            // Single-member read: forward unchanged to avoid a copy in this hot path.
            first.resolve(data);
          } else {
            // Copy each sub-region so a small member does not pin the merged buffer.
            for (const member of group.members) {
              const begin = Number(member.offset - groupStart);
              member.resolve(data.slice(begin, begin + Number(member.size)));
            }
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          for (const member of group.members) {
            member.reject(error);
          }
        }
      }),
    );
  }
}

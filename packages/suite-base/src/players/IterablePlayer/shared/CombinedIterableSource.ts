// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeInitializations } from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/mergeInitialization";
import { mergeMessageIterators } from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/mergeIterators";
import {
  getBackfillMessagesFromSources,
  filterSourcesByTimeRange,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/sourceTimeOverlap";
import { MessageEvent, PlayerAlert } from "@lichtblick/suite-base/players/types";

import {
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
} from "../IIterableSource";

/**
 * Merges a required primary serialized source with zero or more optional, heterogeneous additional
 * serialized sources into a single serialized source.
 *
 * Unlike {@link MultiIterableSource} — which constructs many sources of the *same* type from a
 * config object — this combiner accepts already-built sources of potentially different types. It is
 * used to merge the primary MCAP source(s) of a session with any additional sources delivered
 * alongside it.
 *
 * Additional sources are best-effort: if one fails to initialize it is dropped (with a warning
 * alert surfaced through the merged initialization) so it never breaks the primary source. The
 * primary source's failure, by contrast, is fatal — it is the recording the user opened.
 *
 * Messages are interleaved in receive-time order via {@link mergeMessageIterators}, which eagerly
 * primes every source's iterator. This guarantees correct ordering even when an additional source
 * spans the whole timeline (e.g. tags), which a lazy sequential merge would mis-order.
 */
export class CombinedIterableSource implements ISerializedIterableSource {
  public readonly sourceType = "serialized";
  readonly #primary: ISerializedIterableSource;
  readonly #additionalSources: ISerializedIterableSource[];

  /**
   * Sources that successfully initialized and should be read from. Defaults to all sources so the
   * combiner is usable defensively before `initialize()`; `initialize()` narrows it to the primary
   * plus any additional sources that initialized successfully.
   */
  #activeSources: ISerializedIterableSource[];

  public constructor(
    primary: ISerializedIterableSource,
    additionalSources: ISerializedIterableSource[] = [],
  ) {
    this.#primary = primary;
    this.#additionalSources = additionalSources;
    this.#activeSources = [primary, ...additionalSources];
  }

  public async initialize(): Promise<Initialization> {
    // The primary source must initialize successfully — its failure is fatal.
    const primaryInit = await this.#primary.initialize();

    const initializations: Initialization[] = [primaryInit];
    const activeSources: ISerializedIterableSource[] = [this.#primary];
    const alerts: PlayerAlert[] = [];

    // Additional sources are best-effort: a failure must not break the primary source.
    const results = await Promise.allSettled(
      this.#additionalSources.map(async (source) => await source.initialize()),
    );
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        initializations.push(result.value);
        activeSources.push(this.#additionalSources[index]!);
      } else {
        alerts.push({
          message: "Failed to initialize an additional data source",
          severity: "warn",
          tip: String(result.reason),
        });
      }
    });

    this.#activeSources = activeSources;

    const merged = mergeInitializations(initializations);
    merged.alerts.push(...alerts);
    return merged;
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    // Only iterate sources overlapping the requested time range. Sources that do not report a
    // time range are always considered relevant.
    const relevantSources = filterSourcesByTimeRange(this.#activeSources, opt.start, opt.end);

    yield* mergeMessageIterators(relevantSources.map((source) => source.messageIterator(opt)));
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    return await getBackfillMessagesFromSources(this.#activeSources, args);
  }
}

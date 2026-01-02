// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Immutable as Im, MessageEvent } from "@lichtblick/suite";
import type { MessageBlock } from "@lichtblick/suite-base/players/types";

type BlockItem = { inputEvents: Im<MessageEvent[]>; aliased: Record<string, MessageEvent[]> };
type SparseArray<T> = (T | undefined)[];

/**
 * BlockTopicProcessor adds alias messages to blocks.
 *
 * It tries to keep referential stability for aliased messages by tracking the input messages on the
 * original topic and storing the aliased message arrays to return them if the input messages are
 * unchanged.
 */
export class BlockTopicProcessor {
  #originalTopic: string;
  #aliases: Im<string[]>;

  #blocks: SparseArray<BlockItem> = [];

  public constructor(originalTopic: string, aliases: Im<string[]>) {
    this.#originalTopic = originalTopic;
    this.#aliases = aliases;
  }

  /**
   * Alias the block and return the aliased messages by topic. The aliases and the input messages
   * are stored so if the block has already been aliased and is unchanged, then the existing aliased
   * messages by topic are returned.
   */
  public aliasBlock(block: Im<MessageBlock>, index: number): Record<string, MessageEvent[]> {
    const inputEvents = block.messagesByTopic[this.#originalTopic];
    if (!inputEvents) {
      this.#blocks[index] = undefined;
      return {};
    }

    const existing = this.#blocks[index];
    if (existing?.inputEvents === inputEvents) {
      return existing.aliased;
    }

    const aliased: Record<string, MessageEvent[]> = {};
    for (const alias of this.#aliases) {
      aliased[alias] = inputEvents.map((event) => ({
        ...event,
        topic: alias,
      }));
    }

    // Save the input events and the aliased data
    this.#blocks[index] = {
      inputEvents,
      aliased,
    };

    return aliased;
  }
}

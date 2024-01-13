// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable, MessageEvent } from "@foxglove/studio";
import { MessageBlock } from "@foxglove/studio-base/players/types";

/**
 * BlockTopicCursor tracks the last seen block messages for a given topic and can produce the next
 * block that has not yet been processed.
 *
 * When block topic data changes, it re-starts _next_.
 */
export class BlockTopicCursor {
  #firstBlockRef: Immutable<MessageEvent[]> | undefined;
  #lastBlockRef: Immutable<MessageEvent[]> | undefined;

  #nextBlockIdx = 0;
  #topic: string;

  public constructor(topic: string) {
    this.#topic = topic;
  }

  /**
   * Return true if the cursor is invalidated and reading next will start from the beginning
   */
  public nextWillReset(blocks: Immutable<(MessageBlock | undefined)[]>): boolean {
    const firstBlockRef = blocks[0]?.messagesByTopic[this.#topic];

    const lastIdx = Math.max(0, this.#nextBlockIdx - 1);
    const lastBlockRef = blocks[lastIdx]?.messagesByTopic[this.#topic];

    return firstBlockRef !== this.#firstBlockRef || lastBlockRef !== this.#lastBlockRef;
  }

  /**
   * Given an array of blocks, return the next set of messages.
   *
   * When the underlying topic data changes, the cursor is reset.
   */
  public next(
    blocks: Immutable<(MessageBlock | undefined)[]>,
  ): Immutable<MessageEvent[]> | undefined {
    if (this.nextWillReset(blocks)) {
      const firstBlockRef = blocks[0]?.messagesByTopic[this.#topic];
      this.#nextBlockIdx = 0;
      this.#firstBlockRef = firstBlockRef;
    }

    const idx = this.#nextBlockIdx;
    if (idx >= blocks.length) {
      return undefined;
    }

    // if the block is not yet loaded we do not increment next
    const block = blocks[idx];
    if (!block) {
      return;
    }

    ++this.#nextBlockIdx;
    const blockTopic = block.messagesByTopic[this.#topic];
    this.#lastBlockRef = blockTopic;
    return blockTopic;
  }
}

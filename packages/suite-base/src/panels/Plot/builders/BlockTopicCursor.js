// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/**
 * BlockTopicCursor tracks the last seen block messages for a given topic and can produce the next
 * block that has not yet been processed.
 *
 * When block topic data changes, it re-starts _next_.
 */
export class BlockTopicCursor {
    #firstBlockRef;
    #lastBlockRef;
    #nextBlockIdx = 0;
    #topic;
    constructor(topic) {
        this.#topic = topic;
    }
    /**
     * Return true if the cursor is invalidated and reading next will start from the beginning
     */
    nextWillReset(blocks) {
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
    next(blocks) {
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
        const blockTopic = blocks[idx]?.messagesByTopic[this.#topic];
        if (blockTopic == undefined) {
            return undefined;
        }
        this.#nextBlockIdx += 1;
        this.#lastBlockRef = blockTopic;
        return blockTopic;
    }
}

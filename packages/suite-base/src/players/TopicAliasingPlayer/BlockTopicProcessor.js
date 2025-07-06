// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/**
 * BlockTopicProcessor adds alias messages to blocks.
 *
 * It tries to keep referential stability for aliased messages by tracking the input messages on the
 * original topic and storing the aliased message arrays to return them if the input messages are
 * unchanged.
 */
export class BlockTopicProcessor {
    #originalTopic;
    #aliases;
    #blocks = [];
    constructor(originalTopic, aliases) {
        this.#originalTopic = originalTopic;
        this.#aliases = aliases;
    }
    /**
     * Alias the block and return the aliased messages by topic. The aliases and the input messages
     * are stored so if the block has already been aliased and is unchanged, then the existing aliased
     * messages by topic are returned.
     */
    aliasBlock(block, index) {
        const inputEvents = block.messagesByTopic[this.#originalTopic];
        if (!inputEvents) {
            this.#blocks[index] = undefined;
            return {};
        }
        const existing = this.#blocks[index];
        if (existing && existing.inputEvents === inputEvents) {
            return existing.aliased;
        }
        const aliased = {};
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

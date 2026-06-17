// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";

import { parseChannel } from "@lichtblick/mcap-support";
import { Time, compare } from "@lichtblick/rostime";
import {
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
  TopicWithDecodingInfo,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { MessageEvent, TopicStats } from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

import { AdditionalSourceDescriptor } from "./types";

/** Internal decoded message form (bytes resolved, ready to emit). */
type DecodedMessage = MessageEvent<Uint8Array>;

function decodeBase64(value: string): Uint8Array {
  const out = new Uint8Array(base64.length(value));
  base64.decode(value, out, 0);
  return out;
}

/**
 * Produce a fresh copy of a decoded message for emission.
 *
 * Messages are decoded once and cached, but the worker boundary *transfers* (detaches) each emitted
 * message's underlying `ArrayBuffer`. Emitting the cached instance directly would detach the cache,
 * so the second iteration (e.g. seek-backfill then playback) would try to transfer an already
 * detached buffer and fail with "Unserializable return value". Copying the bytes keeps the cached
 * originals intact and reusable across passes.
 */
function cloneMessageEvent(msgEvent: DecodedMessage): DecodedMessage {
  return { ...msgEvent, message: new Uint8Array(msgEvent.message) };
}


/**
 * A generic serialized source built from a self-describing {@link AdditionalSourceDescriptor}.
 *
 * The descriptor — and therefore all message content — originates from the **additional source
 * side** (issue #1045's `SecondarySourceProvider` model). This class performs no domain logic: it
 * only base64-decodes the provided schemas/messages, declares the topics/datatypes, and replays the
 * messages in receive-time order so the combiner can merge them onto the timeline.
 */
export class AdditionalIterableSource implements ISerializedIterableSource {
  public readonly sourceType = "serialized";

  readonly #descriptor: AdditionalSourceDescriptor;

  /** Decoded messages sorted ascending by receive time. Populated by {@link initialize}. */
  #messages: DecodedMessage[] = [];

  public constructor(descriptor: AdditionalSourceDescriptor) {
    this.#descriptor = descriptor;
  }

  public async initialize(): Promise<Initialization> {
    const topics: TopicWithDecodingInfo[] = [];
    const datatypes: RosDatatypes = new Map();
    const schemaNameByTopic = new Map<string, string>();

    for (const topic of this.#descriptor.topics) {
      const schemaData = topic.schemaData != undefined ? decodeBase64(topic.schemaData) : undefined;
      schemaNameByTopic.set(topic.name, topic.schemaName);

      topics.push({
        name: topic.name,
        schemaName: topic.schemaName,
        messageEncoding: topic.messageEncoding,
        schemaEncoding: topic.schemaEncoding,
        schemaData,
      });

      // Derive datatypes for panels using the same parser the deserialization pipeline uses. A
      // failure here is non-fatal — the topic still streams, panels just introspect the messages.
      try {
        const schema =
          topic.schemaEncoding != undefined && schemaData != undefined
            ? { name: topic.schemaName, encoding: topic.schemaEncoding, data: schemaData }
            : undefined;
        const { datatypes: parsed } = parseChannel({
          messageEncoding: topic.messageEncoding,
          schema,
        });
        for (const [name, definition] of parsed) {
          datatypes.set(name, definition);
        }
      } catch {
        // Ignore — schemaless/json topics or unparseable schemas simply contribute no datatypes.
      }
    }

    const decodedMessages: DecodedMessage[] = [];
    for (const msg of this.#descriptor.messages) {
      const message = decodeBase64(msg.data);
      decodedMessages.push({
        topic: msg.topic,
        schemaName: schemaNameByTopic.get(msg.topic) ?? "",
        receiveTime: msg.receiveTime,
        publishTime: msg.publishTime ?? msg.receiveTime,
        message,
        sizeInBytes: message.byteLength,
      });
    }
    decodedMessages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    this.#messages = decodedMessages;

    const topicStats = this.#computeTopicStats();

    const start = this.#start() ?? { sec: Number.MAX_SAFE_INTEGER, nsec: Number.MAX_SAFE_INTEGER };
    const end = this.#end() ?? { sec: Number.MIN_SAFE_INTEGER, nsec: Number.MIN_SAFE_INTEGER };

    return {
      start,
      end,
      topics,
      topicStats,
      datatypes,
      profile: undefined,
      publishersByTopic: new Map(),
      alerts: [],
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    for (const msgEvent of this.#messages) {
      if (!args.topics.has(msgEvent.topic)) {
        continue;
      }
      if (args.start && compare(msgEvent.receiveTime, args.start) < 0) {
        continue;
      }
      if (args.end && compare(msgEvent.receiveTime, args.end) > 0) {
        break;
      }
      yield { type: "message-event", msgEvent: cloneMessageEvent(msgEvent) };
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    // Latest message per subscribed topic at or before the requested time.
    const latestByTopic = new Map<string, DecodedMessage>();
    for (const msgEvent of this.#messages) {
      if (!args.topics.has(msgEvent.topic)) {
        continue;
      }
      if (compare(msgEvent.receiveTime, args.time) > 0) {
        break;
      }
      latestByTopic.set(msgEvent.topic, msgEvent);
    }
    return Array.from(latestByTopic.values(), cloneMessageEvent);
  }

  public getStart(): Time | undefined {
    return this.#start();
  }

  public getEnd(): Time | undefined {
    return this.#end();
  }

  #start(): Time | undefined {
    return this.#messages[0]?.receiveTime;
  }

  #end(): Time | undefined {
    return this.#messages[this.#messages.length - 1]?.receiveTime;
  }

  #computeTopicStats(): Map<string, TopicStats> {
    const stats = new Map<string, TopicStats>();
    for (const msgEvent of this.#messages) {
      const existing = stats.get(msgEvent.topic);
      if (!existing) {
        stats.set(msgEvent.topic, {
          numMessages: 1,
          firstMessageTime: msgEvent.receiveTime,
          lastMessageTime: msgEvent.receiveTime,
        });
        continue;
      }
      existing.numMessages += 1;
      existing.lastMessageTime = msgEvent.receiveTime;
    }
    return stats;
  }
}

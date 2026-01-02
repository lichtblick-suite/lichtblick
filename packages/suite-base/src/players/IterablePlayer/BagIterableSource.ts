// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bag, Filelike } from "@lichtblick/rosbag";
import { BlobReader } from "@lichtblick/rosbag/web";
import { parse as parseMessageDefinition } from "@lichtblick/rosmsg";
import { compare } from "@lichtblick/rostime";
import { MessageEvent, PlayerAlert, TopicStats } from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import BrowserHttpReader from "@lichtblick/suite-base/util/BrowserHttpReader";
import CachedFilelike from "@lichtblick/suite-base/util/CachedFilelike";
import { getBagChunksOverlapCount } from "@lichtblick/suite-base/util/bags";
import Bzip2 from "@lichtblick/wasm-bz2";
import decompressLZ4 from "@lichtblick/wasm-lz4";

import {
  GetBackfillMessagesArgs,
  Initialization,
  ISerializedIterableSource,
  IteratorResult,
  MessageIteratorArgs,
  TopicWithDecodingInfo,
} from "./IIterableSource";

type BagSource = { type: "file"; file: File } | { type: "remote"; url: string };

export class BagIterableSource implements ISerializedIterableSource {
  readonly #source: BagSource;

  #bag: Bag | undefined;
  #datatypesByConnectionId = new Map<number, string>();
  #textEncoder = new TextEncoder();

  public readonly sourceType = "serialized";

  public constructor(source: BagSource) {
    this.#source = source;
  }

  public async initialize(): Promise<Initialization> {
    await decompressLZ4.isLoaded;
    const bzip2 = await Bzip2.init();

    let fileLike: Filelike | undefined;
    if (this.#source.type === "remote") {
      const bagUrl = this.#source.url;
      const fileReader = new BrowserHttpReader(bagUrl);
      const remoteReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 1024 * 1024 * 200, // 200MiB
        keepReconnectingCallback: (_reconnecting) => {
          // no-op?
        },
      });

      // Call open on the remote reader to see if we can access the remote file
      await remoteReader.open();

      fileLike = remoteReader;
    } else {
      fileLike = new BlobReader(this.#source.file);
    }

    this.#bag = new Bag(fileLike, {
      parse: false,
      decompress: {
        bz2: (buffer: Uint8Array, size: number) => {
          return bzip2.decompress(buffer, size, { small: false });
        },
        lz4: (buffer: Uint8Array, size: number) => {
          return new Uint8Array(decompressLZ4(buffer, size));
        },
      },
    });

    await this.#bag.open();

    const alerts: PlayerAlert[] = [];
    const chunksOverlapCount = getBagChunksOverlapCount(this.#bag.chunkInfos);
    // If >25% of the chunks overlap, show a warning. It's common for a small number of chunks to overlap
    // since it looks like `rosbag record` has a bit of a race condition, and that's not too terrible, so
    // only warn when there's a more serious slowdown.
    if (chunksOverlapCount > this.#bag.chunkInfos.length * 0.25) {
      const message = `This bag has many overlapping chunks (${chunksOverlapCount} out of ${
        this.#bag.chunkInfos.length
      }). This results in more memory use during playback.`;
      const tip = "Re-sort the messages in your bag by receive time.";
      alerts.push({
        severity: "warn",
        message,
        tip,
      });
    }

    const numMessagesByConnectionIndex: number[] = new Array(this.#bag.connections.size).fill(0);
    this.#bag.chunkInfos.forEach((info) => {
      info.connections.forEach(({ conn, count }) => {
        numMessagesByConnectionIndex[conn] ??= 0;
        numMessagesByConnectionIndex[conn] += count;
      });
    });

    const datatypes: RosDatatypes = new Map();
    const topics = new Map<string, TopicWithDecodingInfo>();
    const topicStats = new Map<string, TopicStats>();
    const publishersByTopic: Initialization["publishersByTopic"] = new Map();
    for (const [id, connection] of this.#bag.connections) {
      const schemaName = connection.type;
      if (!schemaName) {
        continue;
      }

      let publishers = publishersByTopic.get(connection.topic);
      if (!publishers) {
        publishers = new Set<string>();
        publishersByTopic.set(connection.topic, publishers);
      }
      publishers.add(connection.callerid ?? String(connection.conn));

      const existingTopic = topics.get(connection.topic);
      if (existingTopic && existingTopic.schemaName !== schemaName) {
        alerts.push({
          severity: "warn",
          message: `Conflicting datatypes on topic (${connection.topic}): ${schemaName}, ${existingTopic.schemaName}`,
          tip: `Studio requires all connections on a topic to have the same datatype. Make sure all your nodes are publishing the same message on ${connection.topic}.`,
        });
      }

      if (!existingTopic) {
        topics.set(connection.topic, {
          name: connection.topic,
          schemaName,
          messageEncoding: "ros1",
          schemaData: this.#textEncoder.encode(connection.messageDefinition),
          schemaEncoding: "ros1msg",
        });
      }

      // Update the message count for this topic
      const numMessages =
        (topicStats.get(connection.topic)?.numMessages ?? 0) +
        (numMessagesByConnectionIndex[connection.conn] ?? 0);
      topicStats.set(connection.topic, { numMessages });

      const parsedDefinition = parseMessageDefinition(connection.messageDefinition);

      for (const definition of parsedDefinition) {
        // In parsed definitions, the first definition (root) does not have a name as is meant to
        // be the datatype of the topic.
        if (!definition.name) {
          datatypes.set(schemaName, definition);
        } else {
          datatypes.set(definition.name, definition);
        }
      }

      this.#datatypesByConnectionId.set(id, schemaName);
    }

    return {
      topics: Array.from(topics.values()),
      topicStats,
      start: this.#bag.startTime ?? { sec: 0, nsec: 0 },
      end: this.#bag.endTime ?? { sec: 0, nsec: 0 },
      alerts,
      profile: "ros1",
      datatypes,
      publishersByTopic,
    };
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    yield* this.#messageIterator({ ...opt, reverse: false });
  }

  async *#messageIterator(
    opt: MessageIteratorArgs & { reverse: boolean },
  ): AsyncGenerator<Readonly<IteratorResult<Uint8Array>>> {
    if (!this.#bag) {
      throw new Error("Invariant: uninitialized");
    }

    const end = opt.end;

    const iterator = this.#bag.messageIterator({
      topics: Array.from(opt.topics.keys()),
      reverse: opt.reverse,
      start: opt.start,
    });

    for await (const bagMsgEvent of iterator) {
      const connectionId = bagMsgEvent.connectionId;

      if (end && compare(bagMsgEvent.timestamp, end) > 0) {
        return;
      }

      const schemaName = this.#datatypesByConnectionId.get(connectionId);
      if (!schemaName) {
        yield {
          type: "alert",
          connectionId,
          alert: {
            severity: "error",
            message: `Cannot missing datatype for connection id ${connectionId}`,
            tip: `Check that your bag file is well-formed. It should have a connection record for every connection id referenced from a message record.`,
          },
        };
        return;
      }

      // bagMsgEvent.data is a view on top of the entire chunk. To avoid keeping references for
      // chunks (which will fill up memory space when we cache messages) when make a copy of the
      // data.
      const dataCopy = bagMsgEvent.data.slice();

      yield {
        type: "message-event",
        msgEvent: {
          topic: bagMsgEvent.topic,
          receiveTime: bagMsgEvent.timestamp,
          sizeInBytes: dataCopy.byteLength,
          message: dataCopy,
          schemaName,
        },
      };
    }
  }

  public async getBackfillMessages({
    topics,
    time,
  }: GetBackfillMessagesArgs): Promise<MessageEvent<Uint8Array>[]> {
    const messages: MessageEvent<Uint8Array>[] = [];
    for (const entry of topics.entries()) {
      // NOTE: An iterator is made for each topic to get the latest message on that topic.
      // An single iterator for all the topics could result in iterating through many
      // irrelevant messages to get to an older message on a topic.
      for await (const result of this.#messageIterator({
        topics: new Map([entry]),
        start: time,
        reverse: true,
      })) {
        if (result.type === "message-event") {
          messages.push(result.msgEvent);
        }
        break;
      }
    }
    messages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    return messages;
  }
}

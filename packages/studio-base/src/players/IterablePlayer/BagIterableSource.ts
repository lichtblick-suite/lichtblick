// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bag, Filelike } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { MessageReader } from "@foxglove/rosmsg-serialization";
import { compare } from "@foxglove/rostime";
import {
  PlayerProblem,
  MessageEvent,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import BrowserHttpReader from "@foxglove/studio-base/util/BrowserHttpReader";
import CachedFilelike from "@foxglove/studio-base/util/CachedFilelike";
import { getBagChunksOverlapCount } from "@foxglove/studio-base/util/bags";
import Bzip2 from "@foxglove/wasm-bz2";
import decompressLZ4 from "@foxglove/wasm-lz4";

import {
  IIterableSource,
  IteratorResult,
  Initalization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
} from "./IIterableSource";

type BagSource = { type: "file"; file: File } | { type: "remote"; url: string };

export class BagIterableSource implements IIterableSource {
  readonly #source: BagSource;

  #bag: Bag | undefined;
  #readersByConnectionId = new Map<number, MessageReader>();
  #datatypesByConnectionId = new Map<number, string>();

  public constructor(source: BagSource) {
    this.#source = source;
  }

  public async initialize(): Promise<Initalization> {
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
          return decompressLZ4(buffer, size);
        },
      },
    });

    await this.#bag.open();

    const problems: PlayerProblem[] = [];
    const chunksOverlapCount = getBagChunksOverlapCount(this.#bag.chunkInfos);
    // If >25% of the chunks overlap, show a warning. It's common for a small number of chunks to overlap
    // since it looks like `rosbag record` has a bit of a race condition, and that's not too terrible, so
    // only warn when there's a more serious slowdown.
    if (chunksOverlapCount > this.#bag.chunkInfos.length * 0.25) {
      const message = `This bag has many overlapping chunks (${chunksOverlapCount} out of ${
        this.#bag.chunkInfos.length
      }). This results in more memory use during playback.`;
      const tip = "Re-sort the messages in your bag by receive time.";
      problems.push({
        severity: "warn",
        message,
        tip,
      });
    }

    const numMessagesByConnectionIndex: number[] = new Array(this.#bag.connections.size).fill(0);
    this.#bag.chunkInfos.forEach((info) => {
      info.connections.forEach(({ conn, count }) => {
        numMessagesByConnectionIndex[conn] += count;
      });
    });

    const datatypes: RosDatatypes = new Map();
    const topics = new Map<string, Topic>();
    const topicStats = new Map<string, TopicStats>();
    const publishersByTopic: Initalization["publishersByTopic"] = new Map();
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
        problems.push({
          severity: "warn",
          message: `Conflicting datatypes on topic (${connection.topic}): ${schemaName}, ${existingTopic.schemaName}`,
          tip: `Studio requires all connections on a topic to have the same datatype. Make sure all your nodes are publishing the same message on ${connection.topic}.`,
        });
      }

      if (!existingTopic) {
        topics.set(connection.topic, { name: connection.topic, schemaName });
      }

      // Update the message count for this topic
      const numMessages =
        (topicStats.get(connection.topic)?.numMessages ?? 0) +
        (numMessagesByConnectionIndex[connection.conn] ?? 0);
      topicStats.set(connection.topic, { numMessages });

      const parsedDefinition = parseMessageDefinition(connection.messageDefinition);
      const reader = new MessageReader(parsedDefinition);
      this.#readersByConnectionId.set(id, reader);
      this.#datatypesByConnectionId.set(id, schemaName);

      for (const definition of parsedDefinition) {
        // In parsed definitions, the first definition (root) does not have a name as is meant to
        // be the datatype of the topic.
        if (!definition.name) {
          datatypes.set(schemaName, definition);
        } else {
          datatypes.set(definition.name, definition);
        }
      }
    }

    return {
      topics: Array.from(topics.values()),
      topicStats,
      start: this.#bag.startTime ?? { sec: 0, nsec: 0 },
      end: this.#bag.endTime ?? { sec: 0, nsec: 0 },
      problems,
      profile: "ros1",
      datatypes,
      publishersByTopic,
    };
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    yield* this.#messageIterator({ ...opt, reverse: false });
  }

  async *#messageIterator(
    opt: MessageIteratorArgs & { reverse: boolean },
  ): AsyncGenerator<Readonly<IteratorResult>> {
    if (!this.#bag) {
      throw new Error("Invariant: uninitialized");
    }

    const end = opt.end;

    const iterator = this.#bag.messageIterator({
      topics: opt.topics,
      reverse: opt.reverse,
      start: opt.start,
    });

    const readersByConnectionId = this.#readersByConnectionId;
    for await (const bagMsgEvent of iterator) {
      const connectionId = bagMsgEvent.connectionId;
      const reader = readersByConnectionId.get(connectionId);

      if (end && compare(bagMsgEvent.timestamp, end) > 0) {
        return;
      }

      const schemaName = this.#datatypesByConnectionId.get(connectionId);
      if (!schemaName) {
        yield {
          type: "problem",
          connectionId,
          problem: {
            severity: "error",
            message: `Cannot missing datatype for connection id ${connectionId}`,
            tip: `Check that your bag file is well-formed. It should have a connection record for every connection id referenced from a message record.`,
          },
        };
        return;
      }

      if (reader) {
        // bagMsgEvent.data is a view on top of the entire chunk. To avoid keeping references for
        // chunks (which will fill up memory space when we cache messages) when make a copy of the
        // data.
        const dataCopy = bagMsgEvent.data.slice();
        const parsedMessage = reader.readMessage(dataCopy);

        yield {
          type: "message-event",
          connectionId,
          msgEvent: {
            topic: bagMsgEvent.topic,
            receiveTime: bagMsgEvent.timestamp,
            sizeInBytes: bagMsgEvent.data.byteLength,
            message: parsedMessage,
            schemaName,
          },
        };
      } else {
        yield {
          type: "problem",
          connectionId,
          problem: {
            severity: "error",
            message: `Cannot deserialize message for missing connection id ${connectionId}`,
            tip: `Check that your bag file is well-formed. It should have a connection record for every connection id referenced from a message record.`,
          },
        };
      }
    }
  }

  public async getBackfillMessages({
    topics,
    time,
  }: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    const messages: MessageEvent<unknown>[] = [];
    for (const topic of topics) {
      // NOTE: An iterator is made for each topic to get the latest message on that topic.
      // An single iterator for all the topics could result in iterating through many
      // irrelevant messages to get to an older message on a topic.
      for await (const result of this.#messageIterator({
        topics: [topic],
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

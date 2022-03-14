// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import decompressLZ4 from "wasm-lz4";

import { Bag, Filelike } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { Topic } from "@foxglove/studio";
import { PlayerProblem } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import BrowserHttpReader from "@foxglove/studio-base/util/BrowserHttpReader";
import CachedFilelike from "@foxglove/studio-base/util/CachedFilelike";
import { getBagChunksOverlapCount } from "@foxglove/studio-base/util/bags";
import Bzip2 from "@foxglove/wasm-bz2";

import {
  IIterableSource,
  IteratorResult,
  Initalization,
  MessageIteratorArgs,
} from "./IIterableSource";

type BagSource = { type: "file"; file: File } | { type: "remote"; url: string };

export class BagIterableSource implements IIterableSource {
  private _source: BagSource;
  private _bag: Bag | undefined;
  private _readersByConnectionId = new Map<number, LazyMessageReader>();

  constructor(source: BagSource) {
    this._source = source;
  }

  async initialize(): Promise<Initalization> {
    await decompressLZ4.isLoaded;
    const bzip2 = await Bzip2.init();

    let fileLike: Filelike | undefined;
    if (this._source.type === "remote") {
      const bagUrl = this._source.url;
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
      fileLike = new BlobReader(this._source.file);
    }

    this._bag = new Bag(fileLike, {
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

    await this._bag.open();

    const problems: PlayerProblem[] = [];
    const chunksOverlapCount = getBagChunksOverlapCount(this._bag.chunkInfos);
    // If >25% of the chunks overlap, show a warning. It's common for a small number of chunks to overlap
    // since it looks like `rosbag record` has a bit of a race condition, and that's not too terrible, so
    // only warn when there's a more serious slowdown.
    if (chunksOverlapCount > this._bag.chunkInfos.length * 0.25) {
      const message = `This bag has many overlapping chunks (${chunksOverlapCount} out of ${this._bag.chunkInfos.length}). This results in more memory use during playback.`;
      const tip = "Re-sort the messages in your bag by receive time.";
      problems.push({
        severity: "warn",
        message,
        tip,
      });
    }

    const datatypes: RosDatatypes = new Map();
    const topics = new Map<string, Topic>();
    const publishersByTopic: Initalization["publishersByTopic"] = new Map();
    for (const [id, connection] of this._bag.connections) {
      const datatype = connection.type;
      if (!datatype) {
        continue;
      }

      let publishers = publishersByTopic.get(connection.topic);
      if (!publishers) {
        publishers = new Set<string>();
        publishersByTopic.set(connection.topic, publishers);
      }
      publishers.add(connection.callerid ?? String(connection.conn));

      const existingTopic = topics.get(connection.topic);
      if (existingTopic && existingTopic.datatype !== datatype) {
        problems.push({
          severity: "warn",
          message: `Conflicting datatypes on topic (${connection.topic}): ${datatype}, ${existingTopic.datatype}`,
          tip: `Studio requires all connections on a topic to have the same datatype. Make sure all your nodes are publishing the same message on ${connection.topic}.`,
        });
      }

      topics.set(connection.topic, {
        name: connection.topic,
        datatype,
      });
      const parsedDefinition = parseMessageDefinition(connection.messageDefinition);
      const reader = new LazyMessageReader(parsedDefinition);
      this._readersByConnectionId.set(id, reader);

      for (const definition of parsedDefinition) {
        // In parsed definitions, the first definition (root) does not have a name as is meant to
        // be the datatype of the topic.
        if (!definition.name) {
          datatypes.set(datatype, definition);
        } else {
          datatypes.set(definition.name, definition);
        }
      }
    }

    return {
      topics: Array.from(topics.values()),
      start: this._bag.startTime ?? { sec: 0, nsec: 0 },
      end: this._bag.endTime ?? { sec: 0, nsec: 0 },
      problems,
      datatypes,
      publishersByTopic,
    };
  }

  messageIterator(opt: MessageIteratorArgs): AsyncIterable<Readonly<IteratorResult>> {
    if (!this._bag) {
      throw new Error("Invariant: uninitialized");
    }

    const iterator = this._bag.messageIterator({
      topics: opt.topics,
      reverse: opt.reverse,
      start: opt.start,
    });

    const readersByConnectionId = this._readersByConnectionId;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<Readonly<IteratorResult>> {
        for await (const bagMsgEvent of iterator) {
          const connectionId = bagMsgEvent.connectionId;
          const reader = readersByConnectionId.get(connectionId);
          if (reader) {
            const parsedMessage = reader.readMessage(bagMsgEvent.data);

            yield {
              connectionId,
              problem: undefined,
              msgEvent: {
                topic: bagMsgEvent.topic,
                receiveTime: bagMsgEvent.timestamp,
                sizeInBytes: bagMsgEvent.data.byteLength,
                message: parsedMessage,
              },
            };
          } else {
            yield {
              connectionId,
              msgEvent: undefined,
              problem: {
                severity: "error",
                message: `Cannot deserialize message for missing connection id ${connectionId}`,
                tip: `Check that your bag file is well-formed. It should have a connection record for every connection id referenced from a message record.`,
              },
            };
          }
        }
      },
    };
  }
}

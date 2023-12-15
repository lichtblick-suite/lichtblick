// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapIndexedReader, McapTypes } from "@mcap/core";

import { pickFields } from "@foxglove/den/records";
import Logger from "@foxglove/log";
import { ParsedChannel, parseChannel } from "@foxglove/mcap-support";
import { Time, fromNanoSec, toNanoSec, compare } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { estimateObjectSize } from "@foxglove/studio-base/players/messageMemoryEstimation";
import {
  PlayerProblem,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

const log = Logger.getLogger(__filename);

export class McapIndexedIterableSource implements IIterableSource {
  #reader: McapIndexedReader;
  #channelInfoById = new Map<
    number,
    {
      channel: McapTypes.Channel;
      parsedChannel: ParsedChannel;
      schemaName: string | undefined;
    }
  >();
  #start?: Time;
  #end?: Time;
  #messageSizeEstimateByHash: Record<string /* subscription hash */, number> = {};

  public constructor(reader: McapIndexedReader) {
    this.#reader = reader;
  }

  public async initialize(): Promise<Initalization> {
    let startTime: bigint | undefined;
    let endTime: bigint | undefined;
    for (const chunk of this.#reader.chunkIndexes) {
      if (startTime == undefined || chunk.messageStartTime < startTime) {
        startTime = chunk.messageStartTime;
      }
      if (endTime == undefined || chunk.messageEndTime > endTime) {
        endTime = chunk.messageEndTime;
      }
    }

    const topicStats = new Map<string, TopicStats>();
    const topicsByName = new Map<string, Topic>();
    const datatypes: RosDatatypes = new Map();
    const problems: PlayerProblem[] = [];
    const publishersByTopic = new Map<string, Set<string>>();

    for (const channel of this.#reader.channelsById.values()) {
      const schema = this.#reader.schemasById.get(channel.schemaId);
      if (channel.schemaId !== 0 && schema == undefined) {
        problems.push({
          severity: "error",
          message: `Missing schema info for schema id ${channel.schemaId} (channel ${channel.id}, topic ${channel.topic})`,
        });
        continue;
      }

      let parsedChannel;
      try {
        parsedChannel = parseChannel({ messageEncoding: channel.messageEncoding, schema });
      } catch (error) {
        problems.push({
          severity: "error",
          message: `Error in topic ${channel.topic} (channel ${channel.id}): ${error.message}`,
          error,
        });
        continue;
      }
      this.#channelInfoById.set(channel.id, {
        channel,
        parsedChannel,
        schemaName: schema?.name,
      });

      let topic = topicsByName.get(channel.topic);
      if (!topic) {
        topic = { name: channel.topic, schemaName: schema?.name };
        topicsByName.set(channel.topic, topic);

        const numMessages = this.#reader.statistics?.channelMessageCounts.get(channel.id);
        if (numMessages != undefined) {
          topicStats.set(channel.topic, { numMessages: Number(numMessages) });
        }
      }

      // Track the publisher for this topic. "callerid" is defined in the MCAP ROS 1 Well-known
      // profile at <https://mcap.dev/specification/appendix.html>. We skip the profile check to
      // allow non-ROS profiles to utilize this functionality as well
      const publisherId = channel.metadata.get("callerid") ?? String(channel.id);
      let publishers = publishersByTopic.get(channel.topic);
      if (!publishers) {
        publishers = new Set();
        publishersByTopic.set(channel.topic, publishers);
      }
      publishers.add(publisherId);

      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }

    this.#start = fromNanoSec(startTime ?? 0n);
    this.#end = fromNanoSec(endTime ?? startTime ?? 0n);

    return {
      start: this.#start,
      end: this.#end,
      topics: [...topicsByName.values()],
      datatypes,
      profile: this.#reader.header.profile,
      problems,
      publishersByTopic,
      topicStats,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    const topics = args.topics;
    const start = args.start ?? this.#start;
    const end = args.end ?? this.#end;

    if (topics.size === 0 || !start || !end) {
      return;
    }

    // Determine the subscription hash which is used to lookup message size estimates.
    // This is done here to avoid doing this repeatedly when iterating over messages.
    const topicsWithSubscriptionHash = new Map(
      Array.from(topics, ([topic, subscribePayload]) => [
        topic,
        {
          ...subscribePayload,
          subscriptionHash: computeSubscriptionHash(topic, subscribePayload),
        },
      ]),
    );

    const topicNames = Array.from(topics.keys());

    for await (const message of this.#reader.readMessages({
      startTime: toNanoSec(start),
      endTime: toNanoSec(end),
      topics: topicNames,
      validateCrcs: false,
    })) {
      const channelInfo = this.#channelInfoById.get(message.channelId);
      if (!channelInfo) {
        yield {
          type: "problem",
          connectionId: message.channelId,
          problem: {
            message: `Received message on channel ${message.channelId} without prior channel info`,
            severity: "error",
          },
        };
        continue;
      }
      try {
        const msg = channelInfo.parsedChannel.deserialize(message.data) as Record<string, unknown>;
        const spec = topicsWithSubscriptionHash.get(channelInfo.channel.topic);
        const payload = spec?.fields != undefined ? pickFields(msg, spec.fields) : msg;
        const estimatedMemorySize = this.#estimateMessageSize(
          spec?.subscriptionHash ?? channelInfo.channel.topic,
          payload,
        );
        const sizeInBytes =
          spec?.fields == undefined
            ? Math.max(message.data.byteLength, estimatedMemorySize)
            : estimatedMemorySize;

        yield {
          type: "message-event",
          msgEvent: {
            topic: channelInfo.channel.topic,
            receiveTime: fromNanoSec(message.logTime),
            publishTime: fromNanoSec(message.publishTime),
            message: payload,
            sizeInBytes,
            schemaName: channelInfo.schemaName ?? "",
          },
        };
      } catch (error) {
        yield {
          type: "problem",
          connectionId: message.channelId,
          problem: {
            message: `Error decoding message on ${channelInfo.channel.topic}`,
            error,
            severity: "error",
          },
        };
      }
    }
  }

  public async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    const { topics, time } = args;

    const messages: MessageEvent[] = [];
    for (const topic of topics.keys()) {
      // NOTE: An iterator is made for each topic to get the latest message on that topic.
      // An single iterator for all the topics could result in iterating through many
      // irrelevant messages to get to an older message on a topic.
      for await (const message of this.#reader.readMessages({
        endTime: toNanoSec(time),
        topics: [topic],
        reverse: true,
        validateCrcs: false,
      })) {
        const channelInfo = this.#channelInfoById.get(message.channelId);
        if (!channelInfo) {
          log.error(`Missing channel info for channel: ${message.channelId} on topic: ${topic}`);
          continue;
        }

        try {
          const deserializedMessage = channelInfo.parsedChannel.deserialize(message.data);
          const sizeInBytes = Math.max(
            message.data.byteLength,
            this.#estimateMessageSize(channelInfo.channel.topic, deserializedMessage),
          );
          messages.push({
            topic: channelInfo.channel.topic,
            receiveTime: fromNanoSec(message.logTime),
            publishTime: fromNanoSec(message.publishTime),
            message: deserializedMessage,
            sizeInBytes,
            schemaName: channelInfo.schemaName ?? "",
          });
        } catch (err) {
          log.error(err);
        }

        break;
      }
    }
    messages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    return messages;
  }

  /**
   * Returns the cached size estimate for the given {@link subscriptionHash}. Estimates the size
   * of the given {@link msg} object and updates the cache if no such cache entry exists.
   * @param subscriptionHash Subscription hash
   * @param msg Deserialized message object
   * @returns Size estimate in bytes
   */
  #estimateMessageSize(subscriptionHash: string, msg: unknown): number {
    const cachedSize = this.#messageSizeEstimateByHash[subscriptionHash];
    if (cachedSize != undefined) {
      return cachedSize;
    }

    const sizeEstimate = estimateObjectSize(msg);
    this.#messageSizeEstimateByHash[subscriptionHash] = sizeEstimate;
    return sizeEstimate;
  }
}

// Computes the subscription hash for a given topic & subscription payload pair.
// In the simplest case, when there are no message slicing fields, the subscription hash is just
// the topic name. If there are slicing fields, the hash is computed as the topic name appended
// by "+" seperated message slicing fields.
function computeSubscriptionHash(topic: string, subscribePayload: SubscribePayload): string {
  return subscribePayload.fields ? topic + "+" + subscribePayload.fields.join("+") : topic;
}

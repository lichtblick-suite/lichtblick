// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { pickFields } from "@lichtblick/den/records";
import Logger from "@lichtblick/log";
import { parseChannel } from "@lichtblick/mcap-support";
import { compare } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import {
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
  IDeserializedIterableSource,
  Initialization,
  IIterableSource,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { estimateObjectSize } from "@lichtblick/suite-base/players/messageMemoryEstimation";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";

const log = Logger.getLogger(__filename);

// Computes the subscription hash for a given topic & subscription payload pair.
// In the simplest case, when there are no message slicing fields, the subscription hash is just
// the topic name. If there are slicing fields, the hash is computed as the topic name appended
// by "+" seperated message slicing fields.
function computeSubscriptionHash(topic: string, subscribePayload: SubscribePayload): string {
  return subscribePayload.fields ? topic + "+" + subscribePayload.fields.join("+") : topic;
}

/**
 * Attempts to deserialize a message event. Returns the deserialized MessageEvent on success,
 * or an alert IteratorResult on failure.
 */
function tryDeserializeMessage(
  msgEvent: MessageEvent<Uint8Array>,
  subscribePayloadWithHashByTopic: Map<string, SubscribePayload & { subscriptionHash: string }>,
  connectionIdByTopic: Record<string, number>,
  deserializeMessage: (
    msgEvent: MessageEvent<Uint8Array>,
    subscription: SubscribePayload & { subscriptionHash: string },
  ) => MessageEvent,
): { ok: true; msgEvent: MessageEvent } | { ok: false; alert: Readonly<IteratorResult> } {
  const subscription = subscribePayloadWithHashByTopic.get(msgEvent.topic);
  if (!subscription) {
    return {
      ok: false,
      alert: {
        type: "alert",
        connectionId: connectionIdByTopic[msgEvent.topic] ?? 0,
        alert: {
          severity: "error",
          message: `Received message on topic ${msgEvent.topic} which was not subscribed to.`,
          tip: "Check that your input file is not corrupted.",
        },
      },
    };
  }
  try {
    return { ok: true, msgEvent: deserializeMessage(msgEvent, subscription) };
  } catch (err) {
    return {
      ok: false,
      alert: {
        type: "alert",
        connectionId: connectionIdByTopic[msgEvent.topic] ?? 0,
        alert: {
          severity: "error",
          message: `Failed to deserialize message on topic ${msgEvent.topic}. ${err}`,
          tip: "Check that your input file is not corrupted.",
        },
      },
    };
  }
}

/**
 * Buffers a sampled message if it is newer than the existing entry for its topic.
 */
function bufferSampledMessage(
  pendingSampledByTopic: Map<string, MessageEvent<Uint8Array>>,
  msgEvent: MessageEvent<Uint8Array>,
): void {
  const existing = pendingSampledByTopic.get(msgEvent.topic);
  if (!existing || compare(existing.receiveTime, msgEvent.receiveTime) < 0) {
    pendingSampledByTopic.set(msgEvent.topic, msgEvent);
  }
}

/**
 * Resolves the next raw iterator result, consuming a carry-over item if available.
 * Returns `undefined` when the underlying iterator is exhausted.
 */
async function nextRawResult(
  carryOverRef: { current: Readonly<IteratorResult<Uint8Array>> | undefined },
  rawIterator: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>,
): Promise<Readonly<IteratorResult<Uint8Array>> | undefined> {
  if (carryOverRef.current) {
    const result = carryOverRef.current;
    carryOverRef.current = undefined;
    return result;
  }
  const next = await rawIterator.next();
  return next.done === true ? undefined : next.value;
}

/**
 * Deserializes a raw message event and returns it as an IteratorResult.
 * On failure, returns an alert result instead.
 */
function deserializeToIterResult(
  msgEvent: MessageEvent<Uint8Array>,
  subscribePayloadWithHashByTopic: Map<string, SubscribePayload & { subscriptionHash: string }>,
  connectionIdByTopic: Record<string, number>,
  deserializeMsg: (
    msgEvent: MessageEvent<Uint8Array>,
    subscription: SubscribePayload & { subscriptionHash: string },
  ) => MessageEvent,
): Readonly<IteratorResult> {
  const result = tryDeserializeMessage(
    msgEvent,
    subscribePayloadWithHashByTopic,
    connectionIdByTopic,
    deserializeMsg,
  );
  return result.ok ? { type: "message-event", msgEvent: result.msgEvent } : result.alert;
}

/**
 * Simple deserialization pass-through for topics without sampling.
 */
async function* deserializePassThrough(
  rawIterator: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>,
  subscribePayloadWithHashByTopic: Map<string, SubscribePayload & { subscriptionHash: string }>,
  connectionIdByTopic: Record<string, number>,
  deserializeMsg: (
    msgEvent: MessageEvent<Uint8Array>,
    subscription: SubscribePayload & { subscriptionHash: string },
  ) => MessageEvent,
): AsyncGenerator<Readonly<IteratorResult>> {
  for await (const iterResult of rawIterator) {
    if (iterResult.type !== "message-event") {
      yield iterResult;
      continue;
    }
    yield deserializeToIterResult(
      iterResult.msgEvent,
      subscribePayloadWithHashByTopic,
      connectionIdByTopic,
      deserializeMsg,
    );
  }
}

/**
 * Deserialization with sampling support. Keeps only the latest message per
 * sampled topic within each sampling window, while passing non-sampled topics
 * through immediately.
 */
async function* deserializeWithSampling(
  rawIterator: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>,
  samplingTopics: Set<string>,
  subscribePayloadWithHashByTopic: Map<string, SubscribePayload & { subscriptionHash: string }>,
  connectionIdByTopic: Record<string, number>,
  deserializeMsg: (
    msgEvent: MessageEvent<Uint8Array>,
    subscription: SubscribePayload & { subscriptionHash: string },
  ) => MessageEvent,
  getSamplingWindowEnd: () => MessageIteratorArgs["end"],
): AsyncGenerator<Readonly<IteratorResult>> {
  const pendingSampledByTopic = new Map<string, MessageEvent<Uint8Array>>();
  const bufferedDecoded: MessageEvent[] = [];
  const carryOverRef: { current: Readonly<IteratorResult<Uint8Array>> | undefined } = {
    current: undefined,
  };

  // Flush buffered decoded messages and the latest sampled raw messages.
  // Deserializes pending sampled topics (emitting alerts on failure), clears buffers,
  // sorts all decoded messages by receive time, and yields them as message-events.
  const flushPending = async function* () {
    if (bufferedDecoded.length === 0 && pendingSampledByTopic.size === 0) {
      return;
    }

    const decoded: MessageEvent[] = [];
    if (bufferedDecoded.length > 0) {
      decoded.push(...bufferedDecoded);
      bufferedDecoded.length = 0;
    }

    for (const [_topic, rawMsgEvent] of pendingSampledByTopic) {
      const result = tryDeserializeMessage(
        rawMsgEvent,
        subscribePayloadWithHashByTopic,
        connectionIdByTopic,
        deserializeMsg,
      );
      if (result.ok) {
        decoded.push(result.msgEvent);
      } else {
        yield result.alert;
      }
    }
    pendingSampledByTopic.clear();

    // Flush combines unsampled buffered messages with sampled latest-per-topic messages.
    // Sort to preserve log-time order before yielding downstream.
    decoded.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    for (const msgEvent of decoded) {
      yield { type: "message-event" as const, msgEvent };
    }
  };

  let samplingWindowEnd = getSamplingWindowEnd();
  for (;;) {
    const iterResult = await nextRawResult(carryOverRef, rawIterator);
    if (iterResult == undefined) {
      break;
    }
    samplingWindowEnd ??= getSamplingWindowEnd();

    // Yield alerts directly.
    if (iterResult.type === "alert") {
      yield iterResult;
      continue;
    }

    // Yield stamp results directly.
    if (iterResult.type === "stamp") {
      if (samplingWindowEnd != undefined && compare(iterResult.stamp, samplingWindowEnd) >= 0) {
        yield* flushPending();
      }
      yield iterResult;
      samplingWindowEnd = getSamplingWindowEnd();
      continue;
    }

    // No sampling window end defined, just deserialize and yield.
    if (!samplingWindowEnd) {
      yield deserializeToIterResult(
        iterResult.msgEvent,
        subscribePayloadWithHashByTopic,
        connectionIdByTopic,
        deserializeMsg,
      );
      continue;
    }

    // If we have reached beyond the sampling window end, flush pending and yield a stamp.
    const samplingWindowCompare = compare(iterResult.msgEvent.receiveTime, samplingWindowEnd);
    if (samplingWindowCompare > 0) {
      yield* flushPending();
      // Defer this message so it is processed in the next sampling window.
      carryOverRef.current = iterResult;
      yield { type: "stamp", stamp: samplingWindowEnd };
      samplingWindowEnd = getSamplingWindowEnd();
      continue;
    }

    // Buffer sampled topic message (keep latest per topic).
    if (samplingTopics.has(iterResult.msgEvent.topic)) {
      bufferSampledMessage(pendingSampledByTopic, iterResult.msgEvent);
      continue;
    }

    // Deserialize non-sampled message immediately.
    const result = tryDeserializeMessage(
      iterResult.msgEvent,
      subscribePayloadWithHashByTopic,
      connectionIdByTopic,
      deserializeMsg,
    );
    if (result.ok) {
      bufferedDecoded.push(result.msgEvent);
    } else {
      yield result.alert;
    }
  }

  yield* flushPending();
}

/**
 * Iterable source that deserializes messages from a raw iterable source (messages are Uint8Arrays).
 */
export class DeserializingIterableSource implements IDeserializedIterableSource {
  #source: IIterableSource<Uint8Array>;
  #deserializersByTopic: Record<string, (data: ArrayBufferView) => unknown> = {};
  #messageSizeEstimateBySubHash: Record<string, number> = {};
  #connectionIdByTopic: Record<string, number> = {};
  // Shared across all iterators produced by messageIterator(). Only one iterator
  // should be active at a time; calling setSamplingWindowEnd mid-iteration will
  // affect the live iterator immediately.
  #samplingWindowEnd: MessageIteratorArgs["end"];

  public readonly sourceType = "deserialized";

  public constructor(source: IIterableSource<Uint8Array>) {
    this.#source = source;
  }

  /**
   * Sets the end of the current sampling window used by active message iterators.
   *
   * NOTE: This mutates shared state read by all iterators created from
   * {@link messageIterator}. It is safe to call mid-iteration — the new value
   * takes effect on the next iteration step — but only one iterator should be
   * active at a time. Calling this while multiple iterators are concurrently
   * consuming will cause unpredictable window boundaries.
   */
  public setSamplingWindowEnd(end: MessageIteratorArgs["end"]): void {
    this.#samplingWindowEnd = end;
  }

  public async initialize(): Promise<Initialization> {
    return this.initializeDeserializers(await this.#source.initialize());
  }

  public initializeDeserializers(initResult: Initialization): Initialization {
    const alerts: Initialization["alerts"] = [];

    let nextConnectionId = 0;
    for (const {
      name: topic,
      messageEncoding,
      schemaName,
      schemaData,
      schemaEncoding,
    } of initResult.topics) {
      this.#connectionIdByTopic[topic] = nextConnectionId++;

      if (this.#deserializersByTopic[topic] == undefined) {
        try {
          if (messageEncoding == undefined) {
            throw new Error(`Unspecified message encoding for topic ${topic}`);
          }

          const schema =
            schemaName != undefined && schemaData != undefined && schemaEncoding != undefined
              ? {
                  name: schemaName,
                  encoding: schemaEncoding,
                  data: schemaData,
                }
              : undefined;

          const { deserialize } = parseChannel({
            messageEncoding,
            schema,
          });
          this.#deserializersByTopic[topic] = deserialize;
        } catch (error) {
          // This should in practice never happen as the underlying source filters out invalid topics
          alerts.push({
            severity: "error",
            message: `Error in topic ${topic}: ${error.message}`,
            error,
          });
        }
      }
    }

    return { ...initResult, alerts: initResult.alerts.concat(alerts) };
  }

  public messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    // Compute the unique subscription hash for every topic + subscription payload pair which will
    // be used to lookup message size estimates. This is done here to avoid having to compute the
    // the subscription hash for every new message event.
    const subscribePayloadWithHashByTopic = new Map(
      Array.from(args.topics, ([topic, subscribePayload]) => [
        topic,
        {
          ...subscribePayload,
          subscriptionHash: computeSubscriptionHash(topic, subscribePayload),
        },
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const rawIterator = self.#source.messageIterator(args);
    const deserializeMsg = self.#deserializeMessage.bind(self);
    const connectionIdByTopic = self.#connectionIdByTopic;

    // Collect all topics that will be sampled
    const samplingTopics = new Set<string>();
    for (const [topic, subscription] of subscribePayloadWithHashByTopic) {
      if (subscription.samplingRequest?.mode === "latest-per-render-tick") {
        samplingTopics.add(topic);
      }
    }
    log.debug(
      `Sampling ${
        samplingTopics.size > 0 ? "active" : "inactive"
      } for iterable source (${samplingTopics.size}/${
        subscribePayloadWithHashByTopic.size
      } sampled topics)`,
    );

    return (async function* deserializedIterableGenerator() {
      try {
        if (samplingTopics.size === 0) {
          yield* deserializePassThrough(
            rawIterator,
            subscribePayloadWithHashByTopic,
            connectionIdByTopic,
            deserializeMsg,
          );
        } else {
          yield* deserializeWithSampling(
            rawIterator,
            samplingTopics,
            subscribePayloadWithHashByTopic,
            connectionIdByTopic,
            deserializeMsg,
            () => self.#samplingWindowEnd,
          );
        }
      } finally {
        await rawIterator.return?.();
      }
    })();
  }

  public async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    // Compute the unique subscription hash for every topic + subscription payload pair which will
    // be used to lookup message size estimates. This is done here to avoid having to compute the
    // the subscription hash for every new message event.
    const subscribePayloadWithHashByTopic = new Map(
      Array.from(args.topics, ([topic, subscribePayload]) => [
        topic,
        {
          ...subscribePayload,
          subscriptionHash: computeSubscriptionHash(topic, subscribePayload),
        },
      ]),
    );

    const rawMessages = await this.#source.getBackfillMessages(args);
    const deserializedMsgs: MessageEvent[] = [];
    for (const rawMsg of rawMessages) {
      try {
        const subscription = subscribePayloadWithHashByTopic.get(rawMsg.topic);
        if (!subscription) {
          throw new Error(`Received message on topic ${rawMsg.topic} which was not subscribed to.`);
        }
        deserializedMsgs.push(this.#deserializeMessage(rawMsg, subscription));
      } catch (err) {
        // We simply log errors here as there is no way to pass errors/problems to the caller.
        // Besides this, the error has most likely been already surfaced to the user during normal iteration.
        log.error(err);
      }
    }

    return deserializedMsgs;
  }

  #deserializeMessage(
    rawMessageEvent: MessageEvent<Uint8Array>,
    subscription: SubscribePayload & { subscriptionHash: string },
  ): MessageEvent {
    const { topic, message } = rawMessageEvent;

    const deserialize = this.#deserializersByTopic[topic];
    if (!deserialize) {
      throw new Error(`Failed to find deserializer for topic ${topic}`);
    }

    const deserializedMessage = deserialize(message) as Record<string, unknown>;
    const msg = subscription.fields
      ? pickFields(deserializedMessage, subscription.fields)
      : deserializedMessage;

    // Lookup the size estimate for this subscription hash or compute it if not found in the cache.
    let msgSizeEstimate = this.#messageSizeEstimateBySubHash[subscription.subscriptionHash];
    if (msgSizeEstimate == undefined) {
      msgSizeEstimate = estimateObjectSize(msg);
      this.#messageSizeEstimateBySubHash[subscription.subscriptionHash] = msgSizeEstimate;
    }

    // For sliced messages we use the estimated message size whereas for non-sliced messages
    // take whatever size is bigger.
    const sizeInBytes = subscription.fields
      ? msgSizeEstimate
      : Math.max(message.byteLength, msgSizeEstimate);

    return {
      ...rawMessageEvent,
      message: msg,
      sizeInBytes,
    };
  }
}

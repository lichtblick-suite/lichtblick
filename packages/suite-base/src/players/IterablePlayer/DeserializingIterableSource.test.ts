// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";
import {
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { estimateObjectSize } from "@lichtblick/suite-base/players/messageMemoryEstimation";

import { DeserializingIterableSource } from "./DeserializingIterableSource";

const textEncoder = new TextEncoder();
const encodeJson = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

async function* defaultMessageIterator(
  _args: MessageIteratorArgs,
): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
  for (let i = 0; i < 8; ++i) {
    const message = textEncoder.encode(JSON.stringify({ foo: "bar", iteration: i }));
    yield {
      type: "message-event",
      msgEvent: {
        topic: "json_topic",
        receiveTime: { sec: 0, nsec: i * 1e8 },
        message,
        sizeInBytes: message.byteLength,
        schemaName: "some_type",
      },
    };
  }
}

class TestSource implements ISerializedIterableSource {
  public readonly sourceType = "serialized";

  public async initialize(): Promise<Initialization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 10, nsec: 0 },
      topics: [
        {
          name: "json_topic",
          schemaName: "some_type",
          messageEncoding: "json",
        },
      ],
      topicStats: new Map(),
      profile: undefined,
      alerts: [],
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {}

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    return [];
  }
}

describe("DeserializingIterableSources", () => {
  it("should construct and initialize", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);

    const initResult = await deserSource.initialize();
    expect(initResult.alerts).toStrictEqual([]);
  });

  it("deserializes messages from raw bytes", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();

    source.messageIterator = defaultMessageIterator;
    const messageIterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic" }]]),
    });

    for (let i = 0; i < 8; ++i) {
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toEqual({
        done: false,
        value: {
          type: "message-event",
          msgEvent: {
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: { foo: "bar", iteration: i },
            sizeInBytes: 36,
            topic: "json_topic",
            schemaName: "some_type",
          },
        },
      });
    }

    // The message iterator should be done since we have no more data to read from the source
    const iterResult = messageIterator.next();
    await expect(iterResult).resolves.toEqual({
      done: true,
    });
  });

  it("performs message slicing", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();

    source.messageIterator = defaultMessageIterator;
    const messageIterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic", fields: ["iteration"] }]]),
    });
    const slicedMessageSizeEstimate = estimateObjectSize({ iteration: 1 });

    for (let i = 0; i < 8; ++i) {
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toEqual({
        done: false,
        value: {
          type: "message-event",
          msgEvent: {
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: { iteration: i },
            sizeInBytes: slicedMessageSizeEstimate,
            topic: "json_topic",
            schemaName: "some_type",
          },
        },
      });
    }

    // The message iterator should be done since we have no more data to read from the source
    const iterResult = messageIterator.next();
    await expect(iterResult).resolves.toEqual({
      done: true,
    });
  });

  it("correctly estimates message sizes for sliced and non-sliced messages", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();

    source.messageIterator = defaultMessageIterator;

    const nonslicedMessageIterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic" }]]),
    });
    const slicedMessageIterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic", fields: ["foo"] }]]),
    });
    const slicedMessageSizeEstimate = estimateObjectSize({ foo: "bar" });

    for (let i = 0; i < 8; ++i) {
      const iterResult = nonslicedMessageIterator.next();
      await expect(iterResult).resolves.toMatchObject({
        done: false,
        value: {
          type: "message-event",
          msgEvent: {
            message: { foo: "bar", iteration: i },
            sizeInBytes: 36,
          },
        },
      });
    }

    for (let i = 0; i < 8; ++i) {
      const iterResult = slicedMessageIterator.next();
      await expect(iterResult).resolves.toMatchObject({
        done: false,
        value: {
          type: "message-event",
          msgEvent: {
            message: { foo: "bar" },
            sizeInBytes: slicedMessageSizeEstimate,
          },
        },
      });
    }

    // Both message iterators should be done since we have no more data to read from the source
    await expect(nonslicedMessageIterator.next()).resolves.toEqual({
      done: true,
    });
    await expect(slicedMessageIterator.next()).resolves.toEqual({
      done: true,
    });
  });

  it("handles deserialization errors in message iteration", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);

    const initResult = await deserSource.initialize();
    expect(initResult.alerts).toStrictEqual([]);
    await deserSource.initialize();

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
      for (let i = 0; i < 8; ++i) {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "json_topic",
            receiveTime: { sec: 0, nsec: i * 1e8 },
            // Every second message is invalid.
            message:
              i % 2 === 0
                ? textEncoder.encode("non-valid json")
                : textEncoder.encode(JSON.stringify({ foo: "bar", iteration: i })),
            sizeInBytes: 0,
            schemaName: "some_type",
          },
        };
      }
    };

    const messageIterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic" }]]),
    });

    for (let i = 0; i < 8; ++i) {
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toMatchObject({
        done: false,
        value: {
          type: i % 2 === 0 ? "alert" : "message-event",
        },
      });
    }
  });

  it("handles deserialization errors for backfill messages", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);

    const initResult = await deserSource.initialize();
    expect(initResult.alerts).toStrictEqual([]);
    await deserSource.initialize();

    source.getBackfillMessages = async (_args: GetBackfillMessagesArgs) => {
      return new Array(8).fill(1).map((_val, i) => {
        return {
          topic: "json_topic",
          receiveTime: { sec: 0, nsec: i * 1e8 },
          // Every second message is invalid.
          message:
            i % 2 === 0
              ? textEncoder.encode("non-valid json")
              : textEncoder.encode(JSON.stringify({ foo: "bar", iteration: i })),
          sizeInBytes: 0,
          schemaName: "some_type",
        };
      });
    };

    const messages = await deserSource.getBackfillMessages({
      time: { sec: 0, nsec: 0 },
      topics: new Map([["json_topic", { topic: "json_topic" }]]),
    });
    expect(messages.length).toBe(4);
    expect(console.error).toHaveBeenCalledTimes(4);
    (console.error as jest.Mock).mockClear();
  });

  it("sampling path keeps latest sampled message, preserves unsampled messages, and uses carry-over", async () => {
    const source = new TestSource();
    source.initialize = async () => {
      return {
        start: { sec: 0, nsec: 0 },
        end: { sec: 10, nsec: 0 },
        topics: [
          { name: "sampled_topic", schemaName: "some_type", messageEncoding: "json" },
          { name: "unsampled_topic", schemaName: "some_type", messageEncoding: "json" },
        ],
        topicStats: new Map(),
        profile: undefined,
        alerts: [],
        datatypes: new Map(),
        publishersByTopic: new Map(),
      };
    };

    source.messageIterator = async function* messageIterator() {
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "unsampled_topic",
          receiveTime: { sec: 0, nsec: 100_000_000 },
          message: encodeJson({ v: "u1" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "sampled_topic",
          receiveTime: { sec: 0, nsec: 200_000_000 },
          message: encodeJson({ v: "s1" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "sampled_topic",
          receiveTime: { sec: 0, nsec: 300_000_000 },
          message: encodeJson({ v: "s2" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "unsampled_topic",
          receiveTime: { sec: 0, nsec: 400_000_000 },
          message: encodeJson({ v: "u2" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "unsampled_topic",
          receiveTime: { sec: 1, nsec: 100_000_000 },
          message: encodeJson({ v: "u3" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "sampled_topic",
          receiveTime: { sec: 1, nsec: 200_000_000 },
          message: encodeJson({ v: "s3" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
    };

    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();
    deserSource.setSamplingWindowEnd({ sec: 1, nsec: 0 });

    const iterator = deserSource.messageIterator({
      topics: new Map([
        [
          "sampled_topic",
          { topic: "sampled_topic", samplingRequest: { mode: "latest-per-render-tick" as const } },
        ],
        ["unsampled_topic", { topic: "unsampled_topic" }],
      ]),
    });

    const first = await iterator.next();
    const second = await iterator.next();
    const third = await iterator.next();
    const fourth = await iterator.next();

    expect(first.value).toMatchObject({
      type: "message-event",
      msgEvent: { topic: "unsampled_topic", message: { v: "u1" } },
    });
    expect(second.value).toMatchObject({
      type: "message-event",
      msgEvent: { topic: "sampled_topic", message: { v: "s2" } },
    });
    expect(third.value).toMatchObject({
      type: "message-event",
      msgEvent: { topic: "unsampled_topic", message: { v: "u2" } },
    });
    expect(fourth.value).toEqual({ type: "stamp", stamp: { sec: 1, nsec: 0 } });

    // Move to the next window; the first message after the previous window was stored as carry-over.
    deserSource.setSamplingWindowEnd({ sec: 2, nsec: 0 });

    const fifth = await iterator.next();
    const sixth = await iterator.next();
    const done = await iterator.next();

    expect(fifth.value).toMatchObject({
      type: "message-event",
      msgEvent: { topic: "unsampled_topic", message: { v: "u3" } },
    });
    expect(sixth.value).toMatchObject({
      type: "message-event",
      msgEvent: { topic: "sampled_topic", message: { v: "s3" } },
    });
    expect(done).toEqual({ done: true, value: undefined });
  });

  it("keeps pass-through behavior when no sampled topics are present", async () => {
    const source = new TestSource();
    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();

    source.messageIterator = defaultMessageIterator;
    deserSource.setSamplingWindowEnd({ sec: 0, nsec: 500_000_000 });

    const iterator = deserSource.messageIterator({
      topics: new Map([["json_topic", { topic: "json_topic" }]]),
    });

    const resultTypes: string[] = [];
    for (;;) {
      const next = await iterator.next();
      if (next.done === true) {
        break;
      }
      resultTypes.push(next.value.type);
    }

    expect(resultTypes).toHaveLength(8);
    expect(resultTypes.every((type) => type === "message-event")).toBe(true);
  });

  it("does not apply window sampling when window end is unset", async () => {
    const source = new TestSource();
    source.initialize = async () => {
      return {
        start: { sec: 0, nsec: 0 },
        end: { sec: 10, nsec: 0 },
        topics: [{ name: "sampled_topic", schemaName: "some_type", messageEncoding: "json" }],
        topicStats: new Map(),
        profile: undefined,
        alerts: [],
        datatypes: new Map(),
        publishersByTopic: new Map(),
      };
    };
    source.messageIterator = async function* messageIterator() {
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "sampled_topic",
          receiveTime: { sec: 0, nsec: 100_000_000 },
          message: encodeJson({ v: "s1" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
      yield {
        type: "message-event" as const,
        msgEvent: {
          topic: "sampled_topic",
          receiveTime: { sec: 0, nsec: 200_000_000 },
          message: encodeJson({ v: "s2" }),
          sizeInBytes: 0,
          schemaName: "some_type",
        },
      };
    };

    const deserSource = new DeserializingIterableSource(source);
    await deserSource.initialize();

    const iterator = deserSource.messageIterator({
      topics: new Map([
        [
          "sampled_topic",
          { topic: "sampled_topic", samplingRequest: { mode: "latest-per-render-tick" as const } },
        ],
      ]),
    });

    const first = await iterator.next();
    const second = await iterator.next();
    const done = await iterator.next();

    expect(first.value).toMatchObject({
      type: "message-event",
      msgEvent: { message: { v: "s1" } },
    });
    expect(second.value).toMatchObject({
      type: "message-event",
      msgEvent: { message: { v: "s2" } },
    });
    expect(done).toEqual({ done: true, value: undefined });
  });
});

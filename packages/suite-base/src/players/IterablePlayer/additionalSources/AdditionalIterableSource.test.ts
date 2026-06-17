// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";

import {
  GetBackfillMessagesArgs,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

import { AdditionalIterableSource } from "./AdditionalIterableSource";
import { AdditionalSourceDescriptor } from "./types";

const TOPIC = "/tags";
const SCHEMA = "tags_schema";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64(value: unknown): string {
  const bytes = textEncoder.encode(JSON.stringify(value));
  return base64.encode(bytes, 0, bytes.length);
}

const decode = (bytes: Uint8Array): unknown => JSON.parse(textDecoder.decode(bytes));

/** A schemaless json source with two out-of-order messages. */
function makeDescriptor(
  overrides: Partial<AdditionalSourceDescriptor> = {},
): AdditionalSourceDescriptor {
  return {
    id: "tags",
    topics: [{ name: TOPIC, schemaName: SCHEMA, messageEncoding: "json" }],
    messages: [
      { topic: TOPIC, receiveTime: { sec: 2, nsec: 0 }, data: encodeBase64({ value: "b" }) },
      { topic: TOPIC, receiveTime: { sec: 1, nsec: 0 }, data: encodeBase64({ value: "a" }) },
    ],
    ...overrides,
  };
}

const subscribed = { topics: new Map([[TOPIC, { topic: TOPIC }]]) };

async function collect(
  source: AdditionalIterableSource,
  args: Partial<MessageIteratorArgs> = {},
): Promise<{ sec: number; value: unknown }[]> {
  const out: { sec: number; value: unknown }[] = [];
  for await (const result of source.messageIterator({
    ...subscribed,
    ...args,
  } as MessageIteratorArgs)) {
    if (result.type === "message-event") {
      out.push({
        sec: result.msgEvent.receiveTime.sec,
        value: (decode(result.msgEvent.message) as { value: unknown }).value,
      });
    }
  }
  return out;
}

describe("AdditionalIterableSource", () => {
  describe("initialize", () => {
    it("should declare topics, stats and a time range from the provided messages", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());

      // When
      const init = await source.initialize();

      // Then
      expect(init.topics).toEqual([
        { name: TOPIC, schemaName: SCHEMA, messageEncoding: "json", schemaEncoding: undefined, schemaData: undefined },
      ]);
      expect(init.start).toEqual({ sec: 1, nsec: 0 });
      expect(init.end).toEqual({ sec: 2, nsec: 0 });
      expect(init.topicStats.get(TOPIC)?.numMessages).toBe(2);
    });

    it("should derive datatypes from a provided json schema", async () => {
      // Given a jsonschema-described topic
      const schema = {
        type: "object",
        properties: { value: { type: "string" } },
      };
      const descriptor = makeDescriptor({
        topics: [
          {
            name: TOPIC,
            schemaName: SCHEMA,
            messageEncoding: "json",
            schemaEncoding: "jsonschema",
            schemaData: encodeBase64(schema),
          },
        ],
      });
      const source = new AdditionalIterableSource(descriptor);

      // When
      const init = await source.initialize();

      // Then
      expect(init.datatypes.has(SCHEMA)).toBe(true);
    });

    it("should report an inverted sentinel range when there are no messages", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor({ messages: [] }));

      // When
      const init = await source.initialize();

      // Then
      expect(source.getStart()).toBeUndefined();
      expect(source.getEnd()).toBeUndefined();
      expect(init.start.sec).toBe(Number.MAX_SAFE_INTEGER);
      expect(init.end.sec).toBe(Number.MIN_SAFE_INTEGER);
      expect(init.topicStats.size).toBe(0);
    });
  });

  describe("messageIterator", () => {
    it("should replay messages in receive-time order with decoded bytes", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When
      const messages = await collect(source);

      // Then
      expect(messages).toEqual([
        { sec: 1, value: "a" },
        { sec: 2, value: "b" },
      ]);
    });

    it("should yield nothing when the topic is not subscribed", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When
      const messages = await collect(source, { topics: new Map() });

      // Then
      expect(messages).toEqual([]);
    });

    it("should respect start and end bounds", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When
      const messages = await collect(source, {
        start: { sec: 2, nsec: 0 },
        end: { sec: 2, nsec: 0 },
      });

      // Then
      expect(messages).toEqual([{ sec: 2, value: "b" }]);
    });

    it("should emit fresh buffers each pass so transferring them does not corrupt later reads", async () => {
      // Given a source whose messages are decoded once and cached
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When the first pass' buffers are transferred across the worker boundary (simulated by
      // detaching the ArrayBuffer, as Comlink.transfer does)
      const detachedByteLengths: number[] = [];
      for await (const result of source.messageIterator(subscribed as MessageIteratorArgs)) {
        if (result.type !== "message-event") {
          continue;
        }
        const { buffer } = result.msgEvent.message;
        structuredClone(buffer, { transfer: [buffer] });
        detachedByteLengths.push(result.msgEvent.message.byteLength);
      }

      // Then the emitted buffers were genuinely detached, yet a second pass still yields the
      // original, intact bytes
      expect(detachedByteLengths).toEqual([0, 0]);
      const secondPass = await collect(source);
      expect(secondPass).toEqual([
        { sec: 1, value: "a" },
        { sec: 2, value: "b" },
      ]);
    });
  });

  describe("getBackfillMessages", () => {
    it("should return the latest message per topic at or before the requested time", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When
      const messages = await source.getBackfillMessages({
        ...subscribed,
        time: { sec: 1, nsec: 500_000_000 },
      } as GetBackfillMessagesArgs);

      // Then
      expect(messages).toHaveLength(1);
      expect(messages[0]?.receiveTime).toEqual({ sec: 1, nsec: 0 });
      expect(decode(messages[0]!.message)).toEqual({ value: "a" });
    });

    it("should return nothing before the first message", async () => {
      // Given
      const source = new AdditionalIterableSource(makeDescriptor());
      await source.initialize();

      // When
      const messages = await source.getBackfillMessages({
        ...subscribed,
        time: { sec: 0, nsec: 0 },
      } as GetBackfillMessagesArgs);

      // Then
      expect(messages).toEqual([]);
    });
  });
});


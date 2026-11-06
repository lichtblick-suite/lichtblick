// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader, McapWriter, TempBuffer } from "@mcap/core";
import { Blob } from "node:buffer";

import { MessageEvent } from "@lichtblick/suite";
import { DeserializingIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/DeserializingIterableSource";
import { namespaceChannels } from "@lichtblick/suite-base/players/IterablePlayer/shared/channelNamespace";
import { expandVideoSeekBackfill } from "@lichtblick/suite-base/players/IterablePlayer/videoSeekBackfill";

import { BlobReadable } from "./BlobReadable";
import { McapIndexedIterableSource } from "./McapIndexedIterableSource";
import { McapUnindexedIterableSource } from "./McapUnindexedIterableSource";

async function recording(): Promise<Blob> {
  const buffer = new TempBuffer();
  const writer = new McapWriter({ writable: buffer, startChannelId: 1 });
  await writer.start({ library: "test", profile: "ros1" });
  const encoder = new TextEncoder();
  for (const definition of ["int32 value", "string value"]) {
    const schemaId = await writer.registerSchema({
      name: "example/Message",
      encoding: "ros1msg",
      data: encoder.encode(definition),
    });
    await writer.registerChannel({
      topic: "/shared",
      schemaId,
      messageEncoding: "ros1",
      metadata: new Map(),
    });
  }
  for (const [channelId, time, data] of [
    [1, 1, new Uint8Array([42, 0, 0, 0])],
    [2, 1, new Uint8Array([1, 0, 0, 0, 65])],
    [1, 3, new Uint8Array([43, 0, 0, 0])],
  ] as const) {
    await writer.addMessage({
      channelId,
      logTime: BigInt(time) * 1_000_000_000n,
      publishTime: 0n,
      sequence: 0,
      data,
    });
  }
  await writer.end();
  return new Blob([buffer.get()]);
}

describe.each(["indexed", "unindexed"] as const)("%s channel access", (kind) => {
  async function source() {
    const file = await recording();
    const raw =
      kind === "indexed"
        ? new McapIndexedIterableSource(
            await McapIndexedReader.Initialize({
              readable: new BlobReadable(file as unknown as globalThis.Blob),
            }),
          )
        : new McapUnindexedIterableSource({
            size: file.size,
            stream: file.stream() as ReadableStream<Uint8Array>,
          });
    const decoded = new DeserializingIterableSource(raw);
    const initialization = await decoded.initialize();
    return { raw, decoded, initialization };
  }

  it("discovers both channels and uses each channel's decoder even with identical schema names", async () => {
    const { decoded, initialization } = await source();
    expect(initialization.topics.map((topic) => topic.channelId)).toEqual(["mcap:1", "mcap:2"]);
    expect(initialization.topicStats.get("/shared")?.numMessages).toBe(3);
    const messages: MessageEvent[] = [];
    for await (const result of decoded.messageIterator({
      topics: new Map([["/shared", { topic: "/shared" }]]),
    })) {
      if (result.type === "message-event") {
        messages.push(result.msgEvent);
      }
    }
    expect(messages.map((event) => [event.channelId, event.message])).toEqual([
      ["mcap:1", { value: 42 }],
      ["mcap:2", { value: "A" }],
      ["mcap:1", { value: 43 }],
    ]);
  });

  it("selects one channel for range reads and backfills every selected channel independently", async () => {
    const { decoded } = await source();
    const topics = new Map([["/shared", { topic: "/shared", channelIds: ["mcap:2"] }]]);
    const messages: MessageEvent[] = [];
    for await (const result of decoded.messageIterator({ topics })) {
      if (result.type === "message-event") {
        messages.push(result.msgEvent);
      }
    }
    expect(messages.map((event) => event.channelId)).toEqual(["mcap:2"]);
    expect(await decoded.getBackfillMessages({ topics, time: { sec: 3, nsec: 0 } })).toEqual(
      messages,
    );
    const both = await decoded.getBackfillMessages({
      topics: new Map([["/shared", { topic: "/shared" }]]),
      time: { sec: 3, nsec: 0 },
    });
    expect(both.map((event) => [event.channelId, event.message])).toEqual([
      ["mcap:2", { value: "A" }],
      ["mcap:1", { value: 43 }],
    ]);
    expect(
      await decoded.getBackfillMessages({
        topics: new Map([["/shared", { topic: "/shared", channelIds: ["missing"] }]]),
        time: { sec: 3, nsec: 0 },
      }),
    ).toEqual([]);
  });

  it("samples the latest message per channel rather than per topic", async () => {
    const { decoded } = await source();
    decoded.setSamplingWindowEnd({ sec: 3, nsec: 0 });
    const messages: MessageEvent[] = [];
    for await (const result of decoded.messageIterator({
      topics: new Map([
        ["/shared", { topic: "/shared", samplingRequest: { mode: "latest-per-render-tick" } }],
      ]),
    })) {
      if (result.type === "message-event") {
        messages.push(result.msgEvent);
      }
    }
    expect(messages.map((event) => event.channelId)).toEqual(["mcap:2", "mcap:1"]);
  });

  it("preserves both synchronized channels through seek-backfill expansion when seeking backwards and forwards", async () => {
    const { decoded } = await source();
    const topics = new Map([["/shared", { topic: "/shared" }]]);
    for (const sec of [1, 3, 2, 1]) {
      const backfill = await decoded.getBackfillMessages({ topics, time: { sec, nsec: 0 } });
      const expanded = await expandVideoSeekBackfill(
        backfill,
        decoded.getBackfillMessages.bind(decoded),
        () => undefined,
      );
      expect(expanded).toEqual(backfill);
      expect(new Set(expanded.map((event) => event.channelId))).toEqual(
        new Set(["mcap:1", "mcap:2"]),
      );
    }
  });

  it("qualifies source-local IDs and translates selections when recordings are combined", async () => {
    const { raw, initialization } = await source();
    const first = namespaceChannels(raw, initialization, 0);
    const second = namespaceChannels(raw, initialization, 1);
    expect(first.initialization.topics[0]?.channelId).not.toBe(
      second.initialization.topics[0]?.channelId,
    );
    const topics = new Map([["/shared", { topic: "/shared", channelIds: ["source:1:mcap:2"] }]]);
    expect(await first.source.getBackfillMessages({ topics, time: { sec: 3, nsec: 0 } })).toEqual(
      [],
    );
    const messages = await second.source.getBackfillMessages({ topics, time: { sec: 3, nsec: 0 } });
    expect(messages.map((event) => event.channelId)).toEqual(["source:1:mcap:2"]);
  });
});

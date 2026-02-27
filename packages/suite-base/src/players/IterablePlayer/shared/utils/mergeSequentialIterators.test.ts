// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  IteratorResult,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

import { mergeSequentialIterators } from "./mergeSequentialIterators";

function makeMessageEvent(topic: string, sec: number): IteratorResult<Uint8Array> {
  return {
    type: "message-event",
    msgEvent: {
      topic,
      receiveTime: { sec, nsec: 0 },
      publishTime: { sec, nsec: 0 },
      message: new Uint8Array(),
      sizeInBytes: 0,
      schemaName: "",
    },
  };
}

function makeMockSource(
  start: Time,
  end: Time,
  messages: IteratorResult<Uint8Array>[],
): IIterableSource<Uint8Array> {
  return {
    sourceType: "serialized",
    initialize: jest.fn(),
    getBackfillMessages: jest.fn(),
    getStart: () => start,
    getEnd: () => end,
    messageIterator: jest.fn().mockImplementation(async function* () {
      yield* messages;
    }),
  } as unknown as IIterableSource<Uint8Array>;
}

describe("mergeSequentialIterators", () => {
  const defaultArgs: MessageIteratorArgs = {
    topics: new Map([["topic", { topic: "topic" }]]),
  };

  it("yields messages from a single source in order", async () => {
    const source = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 1),
      makeMessageEvent("topic", 5),
      makeMessageEvent("topic", 9),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(3);
    expect(results[0]!.type).toBe("message-event");
  });

  it("yields messages from sequential sources in time order", async () => {
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 2),
      makeMessageEvent("topic", 8),
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 12),
      makeMessageEvent("topic", 18),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(4);
    // Verify time ordering — all results are message-events in this test
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const curr = results[i]!;
      expect(prev.type).toBe("message-event");
      expect(curr.type).toBe("message-event");
      expect(
        (prev as IteratorResult<Uint8Array> & { type: "message-event" }).msgEvent.receiveTime.sec,
      ).toBeLessThanOrEqual(
        (curr as IteratorResult<Uint8Array> & { type: "message-event" }).msgEvent.receiveTime.sec,
      );
    }
  });

  it("does NOT start second source iterator until its start time is reached", async () => {
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 2),
      makeMessageEvent("topic", 8),
    ]);
    const source2 = makeMockSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 }, [
      makeMessageEvent("topic", 22),
      makeMessageEvent("topic", 28),
    ]);

    // Collect results, checking that source2.messageIterator is NOT called
    // until after source1 messages have been consumed
    const results: IteratorResult[] = [];
    let source2IteratorCalledBeforeSource1Done = false;
    let source1Done = false;

    const originalIterator = source2.messageIterator.bind(source2);
    source2.messageIterator = jest.fn().mockImplementation((...args: unknown[]) => {
      if (!source1Done) {
        source2IteratorCalledBeforeSource1Done = true;
      }
      return originalIterator(...(args as Parameters<typeof originalIterator>));
    });

    for await (const msg of mergeSequentialIterators([source1, source2], defaultArgs)) {
      results.push(msg);
      if (msg.type === "message-event" && msg.msgEvent.receiveTime.sec === 8) {
        source1Done = true;
      }
    }

    expect(results).toHaveLength(4);
    expect(source2IteratorCalledBeforeSource1Done).toBe(false);
  });

  it("handles sources with start time provided in args", async () => {
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 5),
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 15),
    ]);

    const argsWithStart: MessageIteratorArgs = {
      ...defaultArgs,
      start: { sec: 5, nsec: 0 },
    };

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2], argsWithStart)) {
      results.push(msg);
    }

    expect(results).toHaveLength(2);
  });

  it("handles empty sources gracefully", async () => {
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, []);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 15),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe("message-event");
    expect(
      (results[0] as IteratorResult<Uint8Array> & { type: "message-event" }).msgEvent.receiveTime
        .sec,
    ).toBe(15);
  });

  it("handles sources without time info (starts them immediately)", async () => {
    const sourceNoTime = {
      sourceType: "serialized",
      initialize: jest.fn(),
      getBackfillMessages: jest.fn(),
      // No getStart or getEnd
      messageIterator: jest.fn().mockImplementation(async function* () {
        yield makeMessageEvent("topic", 5);
      }),
    } as unknown as IIterableSource<Uint8Array>;

    const sourceWithTime = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 15),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([sourceNoTime, sourceWithTime], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(2);
  });
});

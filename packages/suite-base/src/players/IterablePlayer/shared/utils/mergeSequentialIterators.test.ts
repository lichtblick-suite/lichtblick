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

  it("activates 3+ sources lazily — third only starts after second is reached", async () => {
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 3),
      makeMessageEvent("topic", 7),
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 12),
      makeMessageEvent("topic", 18),
    ]);
    const source3 = makeMockSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 }, [
      makeMessageEvent("topic", 22),
      makeMessageEvent("topic", 28),
    ]);

    const activationOrder: string[] = [];

    // Spy on messageIterator for source2 and source3 to track activation order
    const orig2 = source2.messageIterator.bind(source2);
    source2.messageIterator = jest.fn().mockImplementation((...args: unknown[]) => {
      activationOrder.push("source2");
      return orig2(...(args as Parameters<typeof orig2>));
    });

    const orig3 = source3.messageIterator.bind(source3);
    source3.messageIterator = jest.fn().mockImplementation((...args: unknown[]) => {
      activationOrder.push("source3");
      return orig3(...(args as Parameters<typeof orig3>));
    });

    const results: IteratorResult[] = [];
    const timesWhenActivated: Record<string, number[]> = { source2: [], source3: [] };

    for await (const msg of mergeSequentialIterators([source1, source2, source3], defaultArgs)) {
      results.push(msg);
      // Record which sources were activated at each message time
      if (msg.type === "message-event") {
        const sec = msg.msgEvent.receiveTime.sec;
        if (activationOrder.includes("source2") && timesWhenActivated.source2?.length === 0) {
          timesWhenActivated.source2.push(sec);
        }
        if (activationOrder.includes("source3") && timesWhenActivated.source3?.length === 0) {
          timesWhenActivated.source3.push(sec);
        }
      }
    }

    expect(results).toHaveLength(6);
    // source2 must be activated before source3
    expect(activationOrder.indexOf("source2")).toBeLessThan(activationOrder.indexOf("source3"));
    // source3's messageIterator should not have been called before source2's messages appear
    expect((source3.messageIterator as jest.Mock).mock.invocationCallOrder[0]).toBeGreaterThan(
      (source2.messageIterator as jest.Mock).mock.invocationCallOrder[0]!,
    );
  });

  it("cleans up active iterators when consumer breaks early", async () => {
    const returnFns = [jest.fn(), jest.fn(), jest.fn()];

    function makeMockSourceWithReturn(
      start: Time,
      end: Time,
      messages: IteratorResult<Uint8Array>[],
      returnFn: jest.Mock,
    ): IIterableSource<Uint8Array> {
      return {
        sourceType: "serialized",
        initialize: jest.fn(),
        getBackfillMessages: jest.fn(),
        getStart: () => start,
        getEnd: () => end,
        messageIterator: jest.fn().mockImplementation(() => {
          let index = 0;
          return {
            next: async () => {
              if (index < messages.length) {
                return { value: messages[index++], done: false };
              }
              return { value: undefined, done: true };
            },
            return: returnFn.mockResolvedValue({ value: undefined, done: true }),
            [Symbol.asyncIterator]() {
              return this;
            },
          };
        }),
      } as unknown as IIterableSource<Uint8Array>;
    }

    // All three sources overlap at time 0, so all will be activated initially
    const source1 = makeMockSourceWithReturn(
      { sec: 0, nsec: 0 },
      { sec: 10, nsec: 0 },
      [makeMessageEvent("topic", 1), makeMessageEvent("topic", 5), makeMessageEvent("topic", 9)],
      returnFns[0]!,
    );
    const source2 = makeMockSourceWithReturn(
      { sec: 0, nsec: 0 },
      { sec: 10, nsec: 0 },
      [makeMessageEvent("topic", 2), makeMessageEvent("topic", 6)],
      returnFns[1]!,
    );
    const source3 = makeMockSourceWithReturn(
      { sec: 0, nsec: 0 },
      { sec: 10, nsec: 0 },
      [makeMessageEvent("topic", 3), makeMessageEvent("topic", 7)],
      returnFns[2]!,
    );

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2, source3], defaultArgs)) {
      results.push(msg);
      // Break after consuming only 2 messages
      if (results.length >= 2) {
        break;
      }
    }

    expect(results).toHaveLength(2);
    // All active iterators that still had remaining data should have .return() called
    const totalReturnCalls = returnFns.reduce((sum, fn) => sum + fn.mock.calls.length, 0);
    expect(totalReturnCalls).toBeGreaterThan(0);
  });

  it("only activates the source containing queryStart on seek (skips earlier sources)", async () => {
    // 4 sequential MCAPs: [0-10], [10-20], [20-30], [30-40]
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 2),
      makeMessageEvent("topic", 8),
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 12),
      makeMessageEvent("topic", 18),
    ]);
    const source3 = makeMockSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 }, [
      makeMessageEvent("topic", 22),
      makeMessageEvent("topic", 28),
    ]);
    const source4 = makeMockSource({ sec: 30, nsec: 0 }, { sec: 40, nsec: 0 }, [
      makeMessageEvent("topic", 32),
      makeMessageEvent("topic", 38),
    ]);

    // Seek to sec 35 — only source4 should be activated initially
    const argsSeekToEnd: MessageIteratorArgs = {
      ...defaultArgs,
      start: { sec: 35, nsec: 0 },
    };

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators(
      [source1, source2, source3, source4],
      argsSeekToEnd,
    )) {
      results.push(msg);
    }

    // source4 has 2 messages
    expect(results).toHaveLength(2);
    // source1, source2, source3 should NEVER have had messageIterator called
    expect(jest.spyOn(source1, "messageIterator")).not.toHaveBeenCalled();
    expect(jest.spyOn(source2, "messageIterator")).not.toHaveBeenCalled();
    expect(jest.spyOn(source3, "messageIterator")).not.toHaveBeenCalled();
    // Only source4 should have been activated
    expect(jest.spyOn(source4, "messageIterator")).toHaveBeenCalledTimes(1);
  });

  it("skips sources that end before queryStart but activates the containing one", async () => {
    // 3 sequential MCAPs: [0-10], [10-20], [20-30]
    // Seek to sec 15 — should skip source1 (ends at 10), activate source2 (contains 15)
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 5),
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 15),
    ]);
    const source3 = makeMockSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 }, [
      makeMessageEvent("topic", 25),
    ]);

    const argsSeekToMiddle: MessageIteratorArgs = {
      ...defaultArgs,
      start: { sec: 15, nsec: 0 },
    };

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators(
      [source1, source2, source3],
      argsSeekToMiddle,
    )) {
      results.push(msg);
    }

    // source2 + source3 messages (source3 activated lazily when source2 exhausts)
    expect(results).toHaveLength(2);
    // source1 should be skipped entirely — its endTime (10) < queryStart (15)
    expect(jest.spyOn(source1, "messageIterator")).not.toHaveBeenCalled();
    // source2 activated on init, source3 activated lazily
    expect(jest.spyOn(source2, "messageIterator")).toHaveBeenCalledTimes(1);
    expect(jest.spyOn(source3, "messageIterator")).toHaveBeenCalledTimes(1);
  });

  it("orders stamp results by their stamp time", async () => {
    const stampResult1: IteratorResult<Uint8Array> = {
      type: "stamp",
      stamp: { sec: 3, nsec: 0 },
    };
    const stampResult2: IteratorResult<Uint8Array> = {
      type: "stamp",
      stamp: { sec: 12, nsec: 0 },
    };

    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }, [
      makeMessageEvent("topic", 1),
      stampResult1,
    ]);
    const source2 = makeMockSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 }, [
      stampResult2,
      makeMessageEvent("topic", 15),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(4);
    expect(results[0]!.type).toBe("message-event");
    expect(results[1]!.type).toBe("stamp");
    expect((results[1] as IteratorResult & { type: "stamp" }).stamp.sec).toBe(3);
    expect(results[2]!.type).toBe("stamp");
    expect((results[2] as IteratorResult & { type: "stamp" }).stamp.sec).toBe(12);
    expect(results[3]!.type).toBe("message-event");
  });

  it("places alert results after timed results due to MAX_SAFE_INTEGER ordering", async () => {
    const alertResult: IteratorResult<Uint8Array> = {
      type: "alert",
      connectionId: 1,
      alert: { severity: "warn", message: "test alert" },
    };

    // Both sources overlap so they are both activated initially
    const source1 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 2),
      alertResult,
    ]);
    const source2 = makeMockSource({ sec: 0, nsec: 0 }, { sec: 20, nsec: 0 }, [
      makeMessageEvent("topic", 5),
      makeMessageEvent("topic", 15),
    ]);

    const results: IteratorResult[] = [];
    for await (const msg of mergeSequentialIterators([source1, source2], defaultArgs)) {
      results.push(msg);
    }

    expect(results).toHaveLength(4);
    // message-events (sec 2, 5) come before the alert (MAX_SAFE_INTEGER time)
    expect(results[0]!.type).toBe("message-event");
    expect(results[1]!.type).toBe("message-event");
    // message-event at sec 15 comes before the alert
    expect(results[2]!.type).toBe("message-event");
    // alert is yielded last since it has no time and gets MAX_SAFE_INTEGER
    expect(results[3]!.type).toBe("alert");
  });
});

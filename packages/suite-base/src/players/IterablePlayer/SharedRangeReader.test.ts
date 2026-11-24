// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { promiseTimeout } from "@lichtblick/den/async";
import { compare } from "@lichtblick/rostime";
import { Immutable } from "@lichtblick/suite";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";

import { IteratorResult, MessageIteratorArgs } from "./IIterableSource";
import { SharedRangeReader } from "./SharedRangeReader";

const FAST = { quietMs: 1, maxWaitMs: 5 };

function payload(result: Readonly<IteratorResult> | undefined): Record<string, unknown> {
  if (result?.type !== "message-event") {
    throw new Error("expected a message event");
  }
  return result.msgEvent.message as Record<string, unknown>;
}

function messageResult(topic: string, sec: number, sizeInBytes = 1): IteratorResult {
  return {
    type: "message-event",
    msgEvent: MessageEventBuilder.messageEvent({
      topic,
      receiveTime: { sec, nsec: 0 },
      sizeInBytes,
    }),
  };
}

/** Behaves like a real source: yields results in time order, only for the requested topics. */
function createSource(results: IteratorResult[], onYield?: () => void) {
  const messageIterator = jest.fn(async function* (args: Immutable<MessageIteratorArgs>) {
    for (const result of results) {
      if (result.type === "message-event") {
        if (!args.topics.has(result.msgEvent.topic)) {
          continue;
        }
        if (args.start != undefined && compare(result.msgEvent.receiveTime, args.start) < 0) {
          continue;
        }
      }
      onYield?.();
      yield result;
    }
  });
  return { messageIterator };
}

async function collect(iterator: AsyncIterableIterator<Readonly<IteratorResult>>) {
  const out: Readonly<IteratorResult>[] = [];
  for await (const result of iterator) {
    out.push(result);
  }
  return out;
}

describe("SharedRangeReader", () => {
  const results = [
    messageResult("/a", 1),
    messageResult("/b", 2),
    messageResult("/c", 3),
    messageResult("/a", 4),
    messageResult("/b", 5),
  ];

  it("should read topics requested together in one pass", async () => {
    // Given
    const source = createSource(results);
    const reader = new SharedRangeReader(source, FAST);

    // When
    await Promise.all([collect(reader.iterator("/a")), collect(reader.iterator("/b"))]);

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(1);
    expect(source.messageIterator).toHaveBeenCalledWith({
      topics: new Map([
        ["/a", { topic: "/a" }],
        ["/b", { topic: "/b" }],
      ]),
      consumptionType: "full",
    });
  });

  it("should give each reader the same results as a separate read of its topic", async () => {
    // Given
    const reader = new SharedRangeReader(createSource(results), FAST);

    // When
    const [a, b, c] = await Promise.all([
      collect(reader.iterator("/a")),
      collect(reader.iterator("/b")),
      collect(reader.iterator("/c")),
    ]);

    // Then
    for (const [topic, got] of [
      ["/a", a],
      ["/b", b],
      ["/c", c],
    ] as const) {
      expect(got).toEqual(
        results.filter((r) => r.type === "message-event" && r.msgEvent.topic === topic),
      );
    }
  });

  it("should give every reader of the same topic its own read and its own message objects", async () => {
    // Given: like a real source, every read creates new message objects
    const source = {
      messageIterator: jest.fn(async function* (args: Immutable<MessageIteratorArgs>) {
        for (const result of results) {
          if (result.type === "message-event" && args.topics.has(result.msgEvent.topic)) {
            yield {
              ...result,
              msgEvent: { ...result.msgEvent, message: { ...payload(result) } },
            };
          }
        }
      }),
    };
    const reader = new SharedRangeReader(source, FAST);

    // When
    const [first, second] = await Promise.all([
      collect(reader.iterator("/a")),
      collect(reader.iterator("/a")),
    ]);

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(second[0]).not.toBe(first[0]);
    payload(first[0]).changedByConsumer = true;
    expect(payload(second[0])).not.toHaveProperty("changedByConsumer");
  });

  it("should read all duplicate topics together in one extra pass", async () => {
    // Given
    const source = createSource(results);
    const reader = new SharedRangeReader(source, FAST);

    // When
    await Promise.all(
      ["/a", "/b", "/a", "/b"].map(async (topic) => await collect(reader.iterator(topic))),
    );

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    for (const [args] of source.messageIterator.mock.calls) {
      expect([...args.topics.keys()]).toEqual(["/a", "/b"]);
    }
  });

  it("should forward alerts and stamps to every reader", async () => {
    // Given
    const alert: IteratorResult = {
      type: "alert",
      connectionId: 1,
      alert: { severity: "warn", message: "careful" },
    };
    const stamp: IteratorResult = { type: "stamp", stamp: { sec: 9, nsec: 0 } };
    const reader = new SharedRangeReader(createSource([alert, ...results, stamp]), FAST);

    // When
    const [a, b] = await Promise.all([
      collect(reader.iterator("/a")),
      collect(reader.iterator("/b")),
    ]);

    // Then
    expect(a[0]).toBe(alert);
    expect(a.at(-1)).toBe(stamp);
    expect(b[0]).toBe(alert);
    expect(b.at(-1)).toBe(stamp);
  });

  it("should keep reading for the others when one reader stops", async () => {
    // Given
    const reader = new SharedRangeReader(createSource(results), FAST);
    const a = reader.iterator("/a");
    const b = reader.iterator("/b");

    // When
    await a.next();
    await a.return!();
    const rest = await collect(b);

    // Then
    expect(rest).toHaveLength(2);
    expect(await a.next()).toEqual({ done: true, value: undefined });
  });

  it("should stop the source read when every reader stops", async () => {
    // Given
    const returnSpy = jest.fn();
    const source = {
      messageIterator: jest.fn(() => {
        const iterator = (async function* () {
          for (let sec = 0; ; sec++) {
            yield messageResult("/a", sec);
          }
        })();
        const originalReturn = iterator.return.bind(iterator);
        iterator.return = async (value) => {
          returnSpy();
          return await originalReturn(value);
        };
        return iterator;
      }),
    };
    const reader = new SharedRangeReader(source, FAST);
    const a = reader.iterator("/a");
    await a.next();

    // When
    await a.return!();

    // Then
    expect(returnSpy).toHaveBeenCalled();
  });

  it("should not read the source when every reader stopped before reading started", async () => {
    // Given
    const source = createSource(results);
    const reader = new SharedRangeReader(source, FAST);
    const a = reader.iterator("/a");

    // When
    await a.return!();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Then
    expect(source.messageIterator).not.toHaveBeenCalled();
  });

  it("should start a new pass for topics requested after reading started", async () => {
    // Given
    const source = createSource(results);
    const reader = new SharedRangeReader(source, FAST);
    const a = reader.iterator("/a");
    await a.next();

    // When
    const b = await collect(reader.iterator("/b"));
    await collect(a);

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(source.messageIterator).toHaveBeenLastCalledWith({
      topics: new Map([["/b", { topic: "/b" }]]),
      consumptionType: "full",
    });
    expect(b).toHaveLength(2);
  });

  it("should hand a reader that stops pulling over to its own read without reading far ahead", async () => {
    // Given
    let yielded = 0;
    const many = Array.from({ length: 100 }, (_, sec) => messageResult("/a", sec));
    const reader = new SharedRangeReader(
      createSource(many, () => {
        yielded++;
      }),
      { ...FAST, maxQueuedResults: 3 },
    );
    const a = reader.iterator("/a");

    // When
    await a.next();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Then
    expect(yielded).toBeLessThanOrEqual(5);
    expect(await collect(a)).toEqual(many.slice(1));
  });

  it("should not hang when a time-ordered merge waits on a rare topic", async () => {
    // Given: /rare at t=0 and t=100, with 99 /frequent messages in between. This is how
    // UserScriptPlayer merges its inputs: it only pulls from the input with the earliest head.
    const stream = [messageResult("/rare", 0)];
    for (let t = 1; t < 100; t++) {
      stream.push(messageResult("/frequent", t));
    }
    stream.push(messageResult("/rare", 100));
    const reader = new SharedRangeReader(createSource(stream), {
      ...FAST,
      maxQueuedResults: 10,
    });
    const rare = reader.iterator("/rare");
    const frequent = reader.iterator("/frequent");
    await rare.next();
    await frequent.next();

    // When
    const outcome = await promiseTimeout(rare.next(), 1000);

    // Then
    expect(outcome).toEqual({ done: false, value: stream.at(-1) });
    expect(await collect(frequent)).toEqual(stream.slice(2, -1));
  });

  it("should not let a reader that is never read block the others", async () => {
    // Given
    const stream = Array.from({ length: 100 }, (_, t) =>
      messageResult(t % 2 === 0 ? "/a" : "/b", t),
    );
    const reader = new SharedRangeReader(createSource(stream), { ...FAST, maxQueuedResults: 10 });
    reader.iterator("/a");
    const b = reader.iterator("/b");

    // When
    const outcome = await promiseTimeout(collect(b), 1000);

    // Then
    expect(outcome).toEqual(
      stream.filter((r) => r.type === "message-event" && r.msgEvent.topic === "/b"),
    );
  });

  it("should hand over every reader whose queue fills up, and still deliver everything", async () => {
    // Given: three readers that don't pull until all queues are long full
    const topics = ["/a", "/b", "/c"];
    const stream = Array.from({ length: 90 }, (_, t) => messageResult(topics[t % 3]!, t));
    const source = createSource(stream);
    const reader = new SharedRangeReader(source, { ...FAST, maxQueuedResults: 5 });
    const iterators = topics.map((topic) => reader.iterator(topic));
    await new Promise((resolve) => setTimeout(resolve, 20));

    // When
    const outcome = await promiseTimeout(Promise.all(iterators.map(collect)), 1000);

    // Then: one shared pass plus one own read per reader, and every message exactly once
    expect(source.messageIterator).toHaveBeenCalledTimes(1 + topics.length);
    expect(outcome).toEqual(
      topics.map((topic) =>
        stream.filter((r) => r.type === "message-event" && r.msgEvent.topic === topic),
      ),
    );
  });

  it("should drop the queue at hand-over and resume after the last handed-out message", async () => {
    // Given
    const stream = [
      messageResult("/a", 1),
      messageResult("/a", 2),
      messageResult("/a", 2),
      messageResult("/a", 2),
      messageResult("/a", 3),
      messageResult("/a", 4),
    ];
    const source = createSource(stream);
    const reader = new SharedRangeReader(source, { ...FAST, maxQueuedResults: 2 });
    const a = reader.iterator("/a");
    const first = await a.next();
    const second = await a.next();
    // Let the queue fill up so the reader is handed over.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // When
    const rest = await collect(a);

    // Then: the own read starts at the last handed-out time, not after the dropped queue
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(source.messageIterator).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { sec: 2, nsec: 0 } }),
    );
    expect([first.value, second.value, ...rest]).toEqual(stream);
  });

  it("should resume at the handed-out time even if the consumer changes the message", async () => {
    // Given: like a real source, every read creates new message objects
    const stream = [1, 2, 3, 4, 5, 6].map((sec) => messageResult("/a", sec));
    const fresh = (result: IteratorResult): IteratorResult =>
      result.type === "message-event"
        ? {
            ...result,
            msgEvent: { ...result.msgEvent, receiveTime: { ...result.msgEvent.receiveTime } },
          }
        : result;
    const source = createSource(stream);
    const freshSource = {
      messageIterator: jest.fn(async function* (args: Immutable<MessageIteratorArgs>) {
        for await (const result of source.messageIterator(args)) {
          yield fresh(result);
        }
      }),
    };
    const reader = new SharedRangeReader(freshSource, { ...FAST, maxQueuedResults: 2 });
    const a = reader.iterator("/a");
    await a.next();
    const second = await a.next();
    (second.value as { msgEvent: { receiveTime: { sec: number } } }).msgEvent.receiveTime.sec = 20;
    await new Promise((resolve) => setTimeout(resolve, 20));

    // When
    const rest = await collect(a);

    // Then
    expect(freshSource.messageIterator).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { sec: 2, nsec: 0 } }),
    );
    expect(rest).toEqual(stream.slice(2));
  });

  it("should restart a reader that never read from the beginning, holding no messages", async () => {
    // Given
    const stream = Array.from({ length: 20 }, (_, sec) => messageResult("/a", sec));
    const source = createSource(stream);
    const reader = new SharedRangeReader(source, { ...FAST, maxQueuedResults: 5 });
    const a = reader.iterator("/a");
    await new Promise((resolve) => setTimeout(resolve, 20));

    // When
    const received = await collect(a);

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(source.messageIterator).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: undefined }),
    );
    expect(received).toEqual(stream);
  });

  it("should hand over a reader once its queued messages reach maxQueuedBytes", async () => {
    // Given
    let yielded = 0;
    const big = Array.from({ length: 50 }, (_, sec) => messageResult("/images", sec, 1000));
    const reader = new SharedRangeReader(
      createSource(big, () => {
        yielded++;
      }),
      { ...FAST, maxQueuedBytes: 3000 },
    );
    const images = reader.iterator("/images");

    // When
    await images.next();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Then
    expect(yielded).toBeLessThanOrEqual(5);
    expect(await collect(images)).toEqual(big.slice(1));
  });

  it("should deliver every message exactly once when the hand-over happens between equal timestamps", async () => {
    // Given: several distinct messages share the receive time at the hand-over point
    const sameTime = [
      messageResult("/a", 1),
      messageResult("/a", 2),
      messageResult("/a", 2),
      messageResult("/a", 2),
      messageResult("/a", 2),
      messageResult("/a", 3),
    ];
    const source = createSource(sameTime);
    const reader = new SharedRangeReader(source, { ...FAST, maxQueuedResults: 2 });
    const a = reader.iterator("/a");
    const handedOut = [await a.next(), await a.next(), await a.next()].map((r) => r.value);
    // Two messages at t=2 are handed out; let the queue fill so the reader is handed over.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // When
    const rest = await collect(a);

    // Then: the own read starts at t=2 and skips exactly the two handed-out ones
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(source.messageIterator).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { sec: 2, nsec: 0 } }),
    );
    expect([...handedOut, ...rest]).toEqual(sameTime);
  });

  it("should stop a handed-over reader's own read when it is returned", async () => {
    // Given
    const returnSpy = jest.fn();
    const source = {
      messageIterator: jest.fn(() => {
        const iterator = (async function* () {
          for (let sec = 0; ; sec++) {
            yield messageResult("/a", sec);
          }
        })();
        const originalReturn = iterator.return.bind(iterator);
        iterator.return = async (value) => {
          returnSpy();
          return await originalReturn(value);
        };
        return iterator;
      }),
    };
    const reader = new SharedRangeReader(source, { ...FAST, maxQueuedResults: 3 });
    const a = reader.iterator("/a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (let i = 0; i < 6; i++) {
      await a.next();
    }

    // When
    await a.return!();

    // Then
    expect(source.messageIterator).toHaveBeenCalledTimes(2);
    expect(returnSpy).toHaveBeenCalledTimes(2);
  });

  it("should deliver everything in order when a queue that never drains is compacted", async () => {
    // Given: the whole stream is queued before the reader pulls, so the queue never empties
    const stream = Array.from({ length: 3000 }, (_, sec) => messageResult("/a", sec));
    const reader = new SharedRangeReader(createSource(stream), FAST);
    const a = reader.iterator("/a");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // When
    const received = await collect(a);

    // Then
    expect(received).toEqual(stream);
  });

  it("should stop running reads and end every reader when closed", async () => {
    // Given
    const returnSpy = jest.fn();
    const source = {
      messageIterator: jest.fn(() => {
        const iterator = (async function* () {
          for (let sec = 0; ; sec++) {
            yield messageResult("/a", sec);
          }
        })();
        const originalReturn = iterator.return.bind(iterator);
        iterator.return = async (value) => {
          returnSpy();
          return await originalReturn(value);
        };
        return iterator;
      }),
    };
    const reader = new SharedRangeReader(source, FAST);
    const a = reader.iterator("/a");
    await a.next();

    // When
    reader.close();

    // Then
    expect(returnSpy).toHaveBeenCalledTimes(1);
    expect(await a.next()).toEqual({ done: true, value: undefined });
  });

  it("should not read the source for waiting or new requests after close", async () => {
    // Given
    const source = createSource(results);
    const reader = new SharedRangeReader(source, FAST);
    const waiting = reader.iterator("/a");

    // When
    reader.close();
    const late = reader.iterator("/b");
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Then
    expect(await waiting.next()).toEqual({ done: true, value: undefined });
    expect(await late.next()).toEqual({ done: true, value: undefined });
    expect(source.messageIterator).not.toHaveBeenCalled();
  });

  it.each([
    [
      "throws",
      () => {
        throw new Error("cleanup failed");
      },
    ],
    ["rejects", async () => await Promise.reject(new Error("cleanup failed"))],
  ])("should still close a reader when the source return() %s", async (_, failingReturn) => {
    // Given
    const source = {
      messageIterator: jest.fn(() => {
        const iterator = (async function* () {
          for (let sec = 0; ; sec++) {
            yield messageResult("/a", sec);
          }
        })();
        iterator.return = failingReturn;
        return iterator;
      }),
    };
    const reader = new SharedRangeReader(source, FAST);
    const a = reader.iterator("/a");
    await a.next();

    // When
    const closed = await a.return!();

    // Then
    expect(closed).toEqual({ done: true, value: undefined });
    expect(await a.next()).toEqual({ done: true, value: undefined });
  });

  it("should answer every pull made before results arrive, in order", async () => {
    // Given
    const reader = new SharedRangeReader(createSource(results), FAST);
    const a = reader.iterator("/a");

    // When
    const pulls = await Promise.all([a.next(), a.next(), a.next()]);

    // Then
    expect(pulls).toEqual([
      { done: false, value: results[0] },
      { done: false, value: results[3] },
      { done: true, value: undefined },
    ]);
  });

  it("should end every waiting pull when the reader is returned", async () => {
    // Given
    const reader = new SharedRangeReader(createSource(results), FAST);
    const a = reader.iterator("/a");
    const pulls = Promise.all([a.next(), a.next()]);

    // When
    await a.return!();

    // Then
    expect(await pulls).toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
  });

  it("should pass a source error to every reader", async () => {
    // Given
    const source = {
      messageIterator: jest.fn(async function* () {
        yield messageResult("/a", 1);
        throw new Error("broken file");
      }),
    };
    const reader = new SharedRangeReader(source, FAST);

    // When
    const a = collect(reader.iterator("/a"));
    const b = collect(reader.iterator("/b"));

    // Then
    await expect(a).rejects.toThrow("broken file");
    await expect(b).rejects.toThrow("broken file");
  });
});

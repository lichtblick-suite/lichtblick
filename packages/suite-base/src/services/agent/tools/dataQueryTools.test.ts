// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent, Time } from "@lichtblick/suite";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  DATA_QUERY_MAX_SCAN_MESSAGES,
  DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES,
  runPlaybackControlTool,
  runReadMessagesTool,
  runSearchMessagesTool,
  safeSerializeMessage,
} from "@lichtblick/suite-base/services/agent/tools/dataQueryTools";
import {
  type AgentDataQueryContext,
  type ToolRuntimeDeps,
} from "@lichtblick/suite-base/services/agent/tools/toolRuntime";

const TRUNCATED_MARKER_VALUE = '"<truncated>"';
const MAX_KEYS = 128;

type MockIterator = AsyncIterableIterator<Readonly<IteratorResult>> & {
  next: jest.Mock;
  return: jest.Mock;
};

function makeIteratorOf(items: readonly unknown[]): MockIterator {
  let index = 0;
  const iterator = {
    next: jest.fn(async () =>
      index < items.length
        ? { done: false, value: items[index++] }
        : { done: true, value: undefined },
    ),
    return: jest.fn(async () => {
      index = items.length;
      return { done: true, value: undefined };
    }),
    [Symbol.asyncIterator]() {
      return this;
    },
  } as unknown as MockIterator;
  return iterator;
}

function makeIterator(events: MessageEvent[]): MockIterator {
  return makeIteratorOf(events.map((msgEvent) => ({ type: "message-event", msgEvent })));
}

function message(
  topic: string,
  schemaName: string,
  receiveTime: Time,
  payload: unknown,
): MessageEvent {
  return { topic, schemaName, receiveTime, message: payload, sizeInBytes: 0 };
}

function makeDeps(context: AgentDataQueryContext): ToolRuntimeDeps {
  return { dataQuery: { getContext: () => context } } as ToolRuntimeDeps;
}

function makeContext(overrides: Partial<AgentDataQueryContext> = {}): AgentDataQueryContext {
  const startTime: Time = { sec: 10, nsec: 0 };
  const endTime: Time = { sec: 20, nsec: 0 };
  return {
    getBatchIterator: jest.fn(() => undefined),
    playerState: { activeData: { startTime, endTime } } as AgentDataQueryContext["playerState"],
    ...overrides,
  };
}

const t10: Time = { sec: 10, nsec: 0 };
const t11: Time = { sec: 11, nsec: 500_000_000 };

describe("read_messages", () => {
  it("reads messages in receive order with safe serialization", async () => {
    const events = [
      message("/imu", "sensor_msgs/Imu", t10, { linear_acceleration: { x: 1.5 }, big: 9007199254740993n }),
      message("/imu", "sensor_msgs/Imu", t11, { linear_acceleration: { x: 2.5 } }),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runReadMessagesTool(
      { topic: "/imu", limit: 10 },
      makeDeps(context),
    )) as {
      count: number;
      messages: Array<{ receiveTimeNs: string; message: { big: string } }>;
      truncated: boolean;
      scanned: number;
    };

    expect(result.count).toBe(2);
    expect(result.scanned).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.messages[0]!.receiveTimeNs).toBe("10000000000");
    expect(result.messages[1]!.receiveTimeNs).toBe("11500000000");
    // BigInt became a string (no precision loss).
    expect(result.messages[0]!.message.big).toBe("9007199254740993");
    expect(iterator.return).toHaveBeenCalled();
  });

  it("honors the limit and time range bounds", async () => {
    const events = [
      message("/a", "s", t10, { v: 1 }),
      message("/a", "s", t11, { v: 2 }),
    ];
    const iterator = makeIterator(events);
    const getBatchIterator = jest.fn(() => iterator);
    const context = makeContext({ getBatchIterator });

    const result = (await runReadMessagesTool(
      { topic: "/a", limit: 1, start: "10500000000", end: "11500000000" },
      makeDeps(context),
    )) as { count: number; messages: unknown[] };

    expect(result.count).toBe(1);
    expect(getBatchIterator).toHaveBeenCalledWith("/a", {
      start: { sec: 10, nsec: 500_000_000 },
      end: { sec: 11, nsec: 500_000_000 },
    });
  });

  it("errors clearly for live sources without a batch iterator", async () => {
    const context = makeContext({ getBatchIterator: jest.fn(() => undefined) });
    await expect(runReadMessagesTool({ topic: "/live" }, makeDeps(context))).rejects.toThrow(
      "does not support message iteration",
    );
  });

  it("errors when no data source / pipeline is exposed", async () => {
    await expect(runReadMessagesTool({ topic: "/a" }, {} as ToolRuntimeDeps)).rejects.toThrow(
      "No data source is loaded",
    );
  });

  it("rejects limits above 100", async () => {
    const context = makeContext();
    await expect(
      runReadMessagesTool({ topic: "/a", limit: 101 }, makeDeps(context)),
    ).rejects.toThrow("limit must be a positive safe integer");
  });

  it("summarizes oversized single messages instead of dropping them", async () => {
    // A payload whose controlled serialization lands between the single-message budget and the
    // hard byte cap: 128 items x 300 chars ≈ 38KiB of output after string capping.
    const hugePayload = { data: Array.from({ length: 128 }, () => "x".repeat(300)) };
    const events = [
      message("/big", "s", t10, hugePayload),
      message("/big", "s", t11, { v: "small" }),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runReadMessagesTool(
      { topic: "/big" },
      makeDeps(context),
    )) as { count: number; truncated: boolean; messages: Array<{ message: unknown }> };

    // Both messages collected; the oversized payload became a field summary, not a dropped entry.
    expect(result.count).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.messages[0]!.message).toEqual(
      expect.objectContaining({ note: "message too large to serialize" }),
    );
    expect(
      (result.messages[0]!.message as { bytes: number }).bytes,
    ).toBeGreaterThan(DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES);
    // The safe serializer still produced the binary marker for a binary payload.
    expect(
      safeSerializeMessage({ data: new Uint8Array(DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES) }),
    ).toContain(`<binary ${DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES} bytes>`);
  });

  it("stops at the total byte budget with a real truncation flag", async () => {
    // ~50 entries of 4KiB text exceed the 192KiB budget after summaries.
    const events = Array.from({ length: 60 }, (_unused, index) =>
      message("/big", "s", { sec: index, nsec: 0 }, { v: "x".repeat(4096) }),
    );
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runReadMessagesTool(
      { topic: "/big" },
      makeDeps(context),
    )) as { count: number; truncated: boolean; scanned: number };

    expect(result.truncated).toBe(true);
    expect(result.scanned).toBe(result.count + 1); // stopped one entry after the budget broke
    expect(result.count).toBeLessThan(events.length);
    expect(result.count).toBeGreaterThan(40);
  });

  it("swallows a rejected iterator.return() in the detached cleanup", async () => {
    const events = [message("/a", "s", t10, { v: 1 }), message("/a", "s", t11, { v: 2 })];
    const iterator = makeIterator(events);
    iterator.return.mockRejectedValueOnce(new Error("return exploded"));
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runReadMessagesTool({ topic: "/a" }, makeDeps(context))) as {
      count: number;
    };
    expect(result.count).toBe(2);
    // No unhandled rejection surfaced; the scan result is unaffected.
    expect(iterator.return).toHaveBeenCalled();
  });

  it("calls iterator.return() when aborted after a pending next() resolves", async () => {
    let resolveNext!: (value: { done: boolean; value?: unknown }) => void;
    const pendingNext = new Promise<{ done: boolean; value?: unknown }>((resolve) => {
      resolveNext = resolve;
    });
    const iterator = {
      next: jest.fn(async () => await pendingNext),
      return: jest.fn(async () => ({ done: true, value: undefined })),
      [Symbol.asyncIterator]() {
        return this;
      },
    } as unknown as MockIterator;
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });
    const controller = new AbortController();

    const run = runReadMessagesTool({ topic: "/a" }, makeDeps(context), {
      signal: controller.signal,
    });

    // Let runDependency start the factory and reach the first (pending) next().
    await Promise.resolve();
    await Promise.resolve();
    expect(iterator.next).toHaveBeenCalledTimes(1);

    // Abort while next() is still pending (a blocked next() cannot be interrupted). The caller's
    // promise rejects immediately via runDependency.
    controller.abort();
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(iterator.return).not.toHaveBeenCalled(); // next() still pending; cleanup is detached

    // Once the pending next() settles, the detached cleanup chain releases the iterator.
    resolveNext({ done: false, value: { type: "message-event", msgEvent: message("/a", "s", t10, { v: 1 }) } });
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    expect(iterator.return).toHaveBeenCalled();
  });
});

describe("search_messages", () => {
  const logEvent = (level: number, text: string, time: Time, schema = "rosgraph_msgs/Log") =>
    message("/rosout", schema, time, {
      level,
      msg: text,
      name: "nav",
      header: { stamp: { sec: 1, nsec: 0 }, seq: 0, frame_id: "" },
    });

  it("requires at least one of text or level", async () => {
    const context = makeContext();
    await expect(runSearchMessagesTool({ topic: "/rosout" }, makeDeps(context))).rejects.toThrow(
      'requires at least one of "text" or "level"',
    );
  });

  it("matches text on log messages and returns receiveTimeNs for seeking", async () => {
    const events = [
      logEvent(2, "odom ok", t10),
      logEvent(4, "wheel slip detected", t11),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", text: "wheel slip" },
      makeDeps(context),
    )) as { count: number; hits: Array<{ receiveTimeNs: string }> };

    expect(result.count).toBe(1);
    // The seekable receive time, not the message-internal stamp.
    expect(result.hits[0]!.receiveTimeNs).toBe("11500000000");
  });

  it("matches level-only searches with the error level", async () => {
    const events = [
      logEvent(2, "odom ok", t10),
      logEvent(8, "odom timeout", t11),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", level: "error" },
      makeDeps(context),
    )) as { count: number; hits: Array<{ receiveTimeNs: string }> };

    expect(result.count).toBe(1);
    expect(result.hits[0]!.receiveTimeNs).toBe("11500000000");
  });

  it.each([
    ["ros.rcl_interfaces.Log", { level: 40, msg: "brake fault", name: "chassis", stamp: { sec: 1, nsec: 0 } }],
    [
      "ros.rosgraph_msgs.Log",
      { level: 8, msg: "brake fault", name: "chassis", header: { stamp: { sec: 1, nsec: 0 }, seq: 0, frame_id: "" } },
    ],
  ] as const)("matches level=error on the ROS alias %s", async (schema, payload) => {
      const events = [
        message("/rosout", schema, t10, payload),
      ];
      const iterator = makeIterator(events);
      const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

      const result = (await runSearchMessagesTool(
        { topic: "/rosout", level: "error" },
        makeDeps(context),
      )) as { count: number };

      expect(result.count).toBe(1);
    },
  );

  it("ANDs text and level", async () => {
    const events = [
      logEvent(8, "wheel slip on left", t10),
      logEvent(8, "wheel slip on right", t11),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", text: "right", level: "error" },
      makeDeps(context),
    )) as { count: number };

    expect(result.count).toBe(1);
  });

  it("matches text on non-log schemas via the serialized payload", async () => {
    const events = [
      message("/gps", "sensor_msgs/NavSatFix", t10, { status: { service: 1 }, latitude: 48.1 }),
      message("/gps", "sensor_msgs/NavSatFix", t11, { status: { service: 2 }, latitude: 48.2 }),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/gps", text: "48.2" },
      makeDeps(context),
    )) as { count: number };

    expect(result.count).toBe(1);
  });

  it("reports no hits without matching", async () => {
    const events = [logEvent(2, "odom ok", t10)];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", level: "error" },
      makeDeps(context),
    )) as { count: number; scanned: number; truncated: boolean };

    expect(result.count).toBe(0);
    expect(result.scanned).toBe(1);
    // A complete scan with no hits is not a truncation.
    expect(result.truncated).toBe(false);
  });

  it("caps the scan at 50,000 messages and reports overScanLimit", async () => {
    // A topic full of non-matching messages: the 20-hit limit never fills, so the scan cap is the
    // bound that stops the scan.
    const events = Array.from({ length: DATA_QUERY_MAX_SCAN_MESSAGES + 1 }, (_unused, index) =>
      logEvent(2, `odom ok ${index}`, { sec: 0, nsec: index }),
    );
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", level: "error" },
      makeDeps(context),
    )) as { scanned: number; overScanLimit: boolean; truncated: boolean; count: number };

    // Exactly MAX items are consumed before the cap stops the scan (no off-by-one).
    expect(result.scanned).toBe(DATA_QUERY_MAX_SCAN_MESSAGES);
    expect(result.overScanLimit).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.count).toBe(0);
  });

  it("counts non-message items (real alerts) toward the scan cap", async () => {
    const alerts = Array.from({ length: DATA_QUERY_MAX_SCAN_MESSAGES }, (_unused, index) => ({
      type: "alert" as const,
      alertMessage: `alert ${index}`,
      severity: "error" as const,
      message: "alert",
      topic: "/rosout",
      time: { sec: 0, nsec: index },
    }));
    // Real alert-shaped iterator items (not message-events wrapping alert-shaped payloads).
    const iterator = makeIteratorOf(alerts);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", level: "error" },
      makeDeps(context),
    )) as { scanned: number; overScanLimit: boolean };

    // Alerts never match but still consume the scan budget — iteration cannot run unbounded.
    expect(result.scanned).toBe(DATA_QUERY_MAX_SCAN_MESSAGES);
    expect(result.overScanLimit).toBe(true);
  });

  it("lets the item at the scan-cap boundary participate in matching", async () => {
    const events = [
      ...Array.from({ length: DATA_QUERY_MAX_SCAN_MESSAGES - 1 }, (_unused, index) =>
        logEvent(2, `odom ok ${index}`, { sec: 0, nsec: index }),
      ),
      logEvent(8, "boundary fault", { sec: 0, nsec: DATA_QUERY_MAX_SCAN_MESSAGES }),
    ];
    const iterator = makeIterator(events);
    const context = makeContext({ getBatchIterator: jest.fn(() => iterator) });

    const result = (await runSearchMessagesTool(
      { topic: "/rosout", level: "error" },
      makeDeps(context),
    )) as { count: number; scanned: number; overScanLimit: boolean };

    // The 50000th item is still matched and collected; only later items are refused.
    expect(result.count).toBe(1);
    expect(result.scanned).toBe(DATA_QUERY_MAX_SCAN_MESSAGES);
    expect(result.overScanLimit).toBe(true);
  });
});

describe("playback_control", () => {
  it("seeks to the clamped target and returns the accepted time", async () => {
    const seekPlayback = jest.fn();
    const startTime: Time = { sec: 10, nsec: 0 };
    const endTime: Time = { sec: 20, nsec: 0 };
    const context = makeContext({
      seekPlayback,
      playerState: { activeData: { startTime, endTime } } as AgentDataQueryContext["playerState"],
    });

    // Request before the start of the loaded range: clamps to startTime.
    const below = (await runPlaybackControlTool(
      { action: "seek", time: "5000000000" },
      makeDeps(context),
    )) as { acceptedTimeNs: string };
    expect(below.acceptedTimeNs).toBe("10000000000");
    expect(seekPlayback).toHaveBeenLastCalledWith({ sec: 10, nsec: 0 });

    // Request beyond the end: clamps to endTime.
    const above = (await runPlaybackControlTool(
      { action: "seek", time: "25000000000" },
      makeDeps(context),
    )) as { acceptedTimeNs: string };
    expect(above.acceptedTimeNs).toBe("20000000000");

    // In-range request passes through unchanged.
    const inside = (await runPlaybackControlTool(
      { action: "seek", time: "15000000000" },
      makeDeps(context),
    )) as { acceptedTimeNs: string };
    expect(inside.acceptedTimeNs).toBe("15000000000");
  });

  it("plays and pauses with per-action gating", async () => {
    const startPlayback = jest.fn();
    const pausePlayback = jest.fn();
    const context = makeContext({ startPlayback, pausePlayback });

    expect(await runPlaybackControlTool({ action: "play" }, makeDeps(context))).toEqual({
      action: "play",
    });
    expect(await runPlaybackControlTool({ action: "pause" }, makeDeps(context))).toEqual({
      action: "pause",
    });
    expect(startPlayback).toHaveBeenCalledTimes(1);
    expect(pausePlayback).toHaveBeenCalledTimes(1);
  });

  it("errors when the player does not expose the requested control", async () => {
    const context = makeContext({}); // no playback functions bound
    await expect(
      runPlaybackControlTool({ action: "play" }, makeDeps(context)),
    ).rejects.toThrow("play is unavailable");
    await expect(
      runPlaybackControlTool({ action: "pause" }, makeDeps(context)),
    ).rejects.toThrow("pause is unavailable");
    await expect(
      runPlaybackControlTool({ action: "seek", time: "15000000000" }, makeDeps(context)),
    ).rejects.toThrow("seek is unavailable");
  });

  it("errors when active playback data is not ready for seek", async () => {
    const context = makeContext({
      seekPlayback: jest.fn(),
      playerState: { activeData: undefined } as AgentDataQueryContext["playerState"],
    });
    await expect(
      runPlaybackControlTool({ action: "seek", time: "15000000000" }, makeDeps(context)),
    ).rejects.toThrow("playback data is not ready");
  });

  it("requires time for seek", async () => {
    const context = makeContext({ seekPlayback: jest.fn() });
    await expect(
      runPlaybackControlTool({ action: "seek" }, makeDeps(context)),
    ).rejects.toThrow('time is required for action "seek"');
  });
});

describe("safeSerializeMessage", () => {
  it("serializes BigInt, binary summaries, and circular references safely", () => {
    const circular: Record<string, unknown> = { name: "x" };
    circular.self = circular;
    const serialized = safeSerializeMessage({
      big: 123n,
      bytes: new Uint8Array([1, 2, 3]),
      buffer: new ArrayBuffer(8),
      circular,
    });

    expect(serialized).toContain('"big":"123"');
    expect(serialized).toContain('"bytes":"<binary 3 bytes>"');
    expect(serialized).toContain('"buffer":"<binary 8 bytes>"');
    expect(serialized).toContain('"self":"<circular>"');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("caps strings, arrays, object keys, and nesting depth", () => {
    // 14 levels of nesting exceeds the serializer depth cap.
    let deep: unknown = { m: 1 };
    for (let index = 0; index < 13; index++) {
      deep = { next: deep };
    }
    const serialized = safeSerializeMessage({
      long: "x".repeat(10000),
      many: Array.from({ length: 500 }, (_unused, index) => index),
      deep,
    });

    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed.long).toContain("<truncated>");
    // Truncation yields a legal JSON marker entry, not a dangling token.
    expect(parsed.many).toContainEqual({ "<truncated>": expect.any(Number) });
    expect(parsed.deep).toEqual(expect.any(Object));
    expect(serialized).toContain('"<depth-limited>"');
    // The bounded output stays far below the single-message budget.
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(20_000);
  });

  it("keeps truncated objects and maps structurally valid JSON", () => {
    const manyKeys: Record<string, unknown> = {};
    for (let index = 0; index < 300; index++) {
      manyKeys[`k${index}`] = index;
    }
    const bigMap = new Map(Array.from({ length: 300 }, (_unused, index) => [String(index), index]));
    const bigSet = new Set(Array.from({ length: 300 }, (_unused, index) => index));

    const objectText = safeSerializeMessage(manyKeys);
    const mapText = safeSerializeMessage(bigMap);
    const setText = safeSerializeMessage(bigSet);

    const parsedObject = JSON.parse(objectText) as Record<string, unknown>;
    expect(parsedObject["<truncated>"]).toBeGreaterThan(0);
    expect(JSON.parse(mapText)).toEqual(expect.objectContaining({ "<truncated>": expect.any(Number) }));
    expect(JSON.parse(setText)).toEqual(
      expect.arrayContaining([{ "<truncated>": expect.any(Number) }]),
    );
  });

  it("truncates a container of huge keys at the byte budget with valid JSON", () => {
    // 128 keys of ~4KiB each would be ~1.5MB if measured after assembly; the incremental UTF-8
    // accounting must stop the container at the hard budget and still produce parseable JSON.
    const manyKeys: Record<string, unknown> = {};
    for (let index = 0; index < MAX_KEYS; index++) {
      manyKeys[`k${"x".repeat(4000)}${index}`] = index;
    }
    const serialized = safeSerializeMessage(manyKeys);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    // The hard byte budget is a strict bound: nothing is appended past 64KiB.
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(64 * 1024);
    expect(parsed["<truncated>"]).toBeGreaterThan(0);
    expect(serialized).toContain(TRUNCATED_MARKER_VALUE);
  });

  it("serializes huge Maps and Sets lazily within the byte budget", async () => {
    const bigMap = new Map<string, number>();
    const bigSet = new Set<number>();
    for (let index = 0; index < 100_000; index++) {
      bigMap.set(`key-${index}`, index);
      bigSet.add(index);
    }
    // The keys alone are ~1MB; lazy iteration plus the byte budget must keep output bounded.
    const mapText = safeSerializeMessage(bigMap);
    const setText = safeSerializeMessage(bigSet);

    expect(new TextEncoder().encode(mapText).length).toBeLessThanOrEqual(64 * 1024);
    expect(new TextEncoder().encode(setText).length).toBeLessThanOrEqual(64 * 1024);
    const parsedMap = JSON.parse(mapText) as Record<string, unknown>;
    expect(parsedMap["<truncated>"]).toBeGreaterThan(0);
    expect(JSON.parse(setText)).toEqual(
      expect.arrayContaining([{ "<truncated>": expect.any(Number) }]),
    );
  });

  it("keeps Set and array containers valid when the budget cannot fit their first element", () => {
    // 128 x 511 chars ≈ 65.4KiB: the filler nearly exhausts the content budget, so when the
    // Set/array first element (~4.1KiB after string capping) is reached, the element itself does
    // not fit and only the truncation marker can stand in for it. The container must close as
    // valid JSON — never as a dangling open bracket.
    const filler = Array.from({ length: 128 }, () => "x".repeat(511));
    const setResult = safeSerializeMessage({
      filler,
      set: new Set(["y".repeat(5000)]),
    });
    const arrayResult = safeSerializeMessage({
      filler,
      list: ["y".repeat(5000)],
    });

    const parsedSet = JSON.parse(setResult) as { set: unknown };
    const parsedArray = JSON.parse(arrayResult) as { list: unknown };
    expect(parsedSet.set).toEqual(expect.any(Array));
    expect(parsedArray.list).toEqual(expect.any(Array));
    expect(JSON.stringify(parsedSet.set)).toContain(TRUNCATED_MARKER_VALUE);
    expect(JSON.stringify(parsedArray.list)).toContain(TRUNCATED_MARKER_VALUE);
    // The whole output is bounded by the hard cap.
    expect(new TextEncoder().encode(setResult).length).toBeLessThanOrEqual(64 * 1024);
    expect(new TextEncoder().encode(arrayResult).length).toBeLessThanOrEqual(64 * 1024);
  });

  it("keeps the object count entry valid when the budget runs out mid-entry", () => {
    // 128 keys of 4KiB exhaust the budget while keys are still being written; the trailing
    // count entry and closing brace must stay structurally valid JSON.
    const manyKeys: Record<string, unknown> = {};
    for (let index = 0; index < MAX_KEYS; index++) {
      manyKeys[`k${"x".repeat(4000)}${index}`] = index;
    }
    const serialized = safeSerializeMessage(manyKeys);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(64 * 1024);
    expect(parsed["<truncated>"]).toBeGreaterThan(0);
  });

  it("enforces global node and output budgets on pathological payloads", () => {
    // Wide and deep enough to exceed the global node cap long before the per-container caps.
    let wide: unknown = { leaf: true };
    for (let index = 0; index < 30; index++) {
      const layer: unknown[] = [];
      for (let item = 0; item < 30; item++) {
        layer.push(wide);
      }
      wide = layer;
    }
    const serialized = safeSerializeMessage({ wide });

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(64 * 1024);
    // Depth and shared-reference caps keep the output bounded with legal JSON markers.
    expect(serialized).toContain('"<depth-limited>"');
    expect(serialized).toContain('"<circular>"');
  });

  it("does not throw on throwing getters, undefined, functions, or symbols", () => {
    const withGetter = { value: 1 };
    Object.defineProperty(withGetter, "boom", {
      enumerable: true,
      get: () => {
        throw new Error("getter exploded");
      },
    });
    const serialized = safeSerializeMessage({
      withGetter,
      missing: undefined,
      fn: () => {},
      sym: Symbol("s"),
      nested: { inner: undefined },
    });

    expect(serialized).toContain('"boom":"<getter-error>"');
    expect(serialized).toContain('"missing":null');
    expect(serialized).toContain('"fn":"<function>"');
    expect(serialized).toContain('"sym":"<symbol>"');
    expect(serialized).toContain('"inner":null');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });
});

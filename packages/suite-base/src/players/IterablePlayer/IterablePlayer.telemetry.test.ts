/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { signal } from "@lichtblick/den/async";
import { compare, Time } from "@lichtblick/rostime";
import { PlayerPresence, PlayerState } from "@lichtblick/suite-base/players/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import {
  BufferedTelemetrySink,
  setTelemetrySink,
  type TelemetryEvent,
} from "@lichtblick/suite-base/util/telemetry";

import {
  GetBackfillMessagesArgs,
  IDeserializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";
import { IterablePlayer } from "./IterablePlayer";
import { installDisabledTelemetry, publishAndCollect } from "./testing/telemetryTestUtils";

const TOPIC = "/telemetry/topic";
const SOURCE_ID = "telemetry-test";
const MESSAGE_TIME: Time = { sec: 0, nsec: 50_000_000 };

class TelemetryTestSource implements IDeserializedIterableSource {
  public readonly sourceType = "deserialized";
  public initError: Error | undefined;

  public async initialize(): Promise<Initialization> {
    if (this.initError) {
      throw this.initError;
    }
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 1, nsec: 0 },
      topics: [{ name: TOPIC, schemaName: "foo" }],
      topicStats: new Map(),
      profile: undefined,
      alerts: [],
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    // One message inside the initial start-play window (first 99 ms).
    const inRange =
      (args.start == undefined || compare(args.start, MESSAGE_TIME) <= 0) &&
      (args.end == undefined || compare(args.end, MESSAGE_TIME) >= 0);
    if (inRange) {
      yield {
        type: "message-event",
        msgEvent: MessageEventBuilder.messageEvent({
          topic: TOPIC,
          receiveTime: MESSAGE_TIME,
        }),
      };
    }
  }

  public async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<never[]> {
    return [];
  }
}

// Holds the block loader's ("full") read until the test opens the gate.
class GatedPreloadSource extends TelemetryTestSource {
  public readonly fullReadStarted = signal();
  public readonly gate = signal();

  public override async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (args.consumptionType === "full") {
      this.fullReadStarted.resolve();
      await this.gate;
    }
    yield* super.messageIterator(args);
  }
}

function setupSink(): { sink: BufferedTelemetrySink; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];
  const sink = new BufferedTelemetrySink({
    realm: "renderer",
    setInterval: jest.fn(),
    clearInterval: jest.fn(),
    onEvent: (event) => events.push(event),
  });
  setTelemetrySink(sink);
  return { sink, events };
}

function summarize(events: TelemetryEvent[]): string[] {
  return events.map((event) =>
    [event.name, event.phase, event.labels?.reason].filter(Boolean).join(":"),
  );
}

// Resolves once the player is idle after the initial start-play frame.
async function waitForInitialFrame(
  player: IterablePlayer,
  onState?: (state: PlayerState) => void,
): Promise<void> {
  const ready = signal();
  player.setListener(async (state) => {
    onState?.(state);
    if (
      state.progress.fullyLoadedFractionRanges != undefined &&
      state.activeData?.isPlaying === false
    ) {
      ready.resolve();
    }
  });
  await ready;
}

describe("IterablePlayer telemetry", () => {
  afterEach(() => {
    setTelemetrySink(undefined);
  });

  it("emits open → firstMessage → playback/seek → close events in order", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    player.setSubscriptions([{ topic: TOPIC }]);
    await waitForInitialFrame(player);

    // When
    player.startPlayback();
    player.seekPlayback({ sec: 0, nsec: 500_000_000 });
    player.pausePlayback();
    player.close();
    await player.isClosed;

    // Then
    expect(summarize(events)).toEqual([
      "datasource.open:start",
      "datasource.open:end",
      "datasource.firstMessage:instant",
      "playback:start",
      "seek.requested:instant",
      "playback:end:pause",
      "datasource.close:start",
      "datasource.close:end",
    ]);
    for (const event of events) {
      expect(event).toMatchObject({ scope: "pipeline", realm: "renderer" });
      expect(event.labels?.sourceId).toBe(SOURCE_ID);
    }
  });

  it("ends playback with reason 'end' when playback reaches the end of the data", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    const reachedEnd = signal();
    await waitForInitialFrame(player, (state) => {
      if (
        state.activeData &&
        !state.activeData.isPlaying &&
        _.isEqual(state.activeData.currentTime, state.activeData.endTime)
      ) {
        reachedEnd.resolve();
      }
    });

    // When
    player.startPlayback();
    await reachedEnd;
    player.close();
    await player.isClosed;

    // Then
    const playback = summarize(events).filter((entry) => entry.startsWith("playback"));
    expect(playback).toEqual(["playback:start", "playback:end:end"]);
  });

  it("emits datasource.open end with reason 'error' when initialization fails", async () => {
    // Given
    const { events } = setupSink();
    const source = new TelemetryTestSource();
    source.initError = new Error("cannot open");
    const player = new IterablePlayer({ source, enablePreload: false, sourceId: SOURCE_ID });
    const errored = signal();

    // When
    player.setListener(async (state) => {
      if (state.presence === PlayerPresence.ERROR) {
        errored.resolve();
      }
    });
    await errored;
    player.close();
    await player.isClosed;

    // Then
    expect(summarize(events)).toEqual([
      "datasource.open:start",
      "datasource.open:end:error",
      "datasource.close:start",
      "datasource.close:end",
    ]);
    // The player alert manager logs the (expected) initialization error.
    (console.error as jest.Mock).mockClear();
  });

  it("emits preload start and end once the block loader covers the full range", async () => {
    // Given
    const { events } = setupSink();
    const preloadEnded = signal();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: true,
      sourceId: SOURCE_ID,
    });
    player.setSubscriptions([{ topic: TOPIC, preloadType: "full" }]);

    // When
    player.setListener(async () => {
      if (events.some((event) => event.name === "preload" && event.phase === "end")) {
        preloadEnded.resolve();
      }
    });
    await preloadEnded;
    player.close();
    await player.isClosed;

    // Then
    const preload = summarize(events).filter((entry) => entry.startsWith("preload"));
    expect(preload).toEqual(["preload:start", "preload:end"]);
  });

  it("should emit no preload events when no subscription requests full preload", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: true,
      sourceId: SOURCE_ID,
    });
    player.setSubscriptions([{ topic: TOPIC }]);
    await waitForInitialFrame(player);

    // When
    player.close();
    await player.isClosed;

    // Then
    expect(events.filter((event) => event.name === "preload")).toEqual([]);
  });

  it("should end preload with reason 'cancelled' when the player closes before the full range is loaded", async () => {
    // Given: a source whose full (block loader) read is held until the player is closing
    const { events } = setupSink();
    const source = new GatedPreloadSource();
    const player = new IterablePlayer({ source, enablePreload: true, sourceId: SOURCE_ID });
    player.setSubscriptions([{ topic: TOPIC, preloadType: "full" }]);
    player.setListener(async () => {});
    await source.fullReadStarted;

    // When
    player.close();
    source.gate.resolve();
    await player.isClosed;

    // Then
    const lifecycle = summarize(events).filter(
      (entry) => entry.startsWith("preload") || entry.startsWith("datasource.close"),
    );
    expect(lifecycle).toEqual([
      "preload:start",
      "datasource.close:start",
      "preload:end:cancelled",
      "datasource.close:end",
    ]);
  });

  it("should label events only with the factory sourceId and bounded reasons, never the display name", async () => {
    // Given
    const { events } = setupSink();
    const displayName = "My Recording (copy).mcap";
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
      name: displayName,
    });
    player.setSubscriptions([{ topic: TOPIC }]);
    await waitForInitialFrame(player);

    // When
    player.startPlayback();
    player.pausePlayback();
    player.close();
    await player.isClosed;

    // Then
    expect(events.length).toBeGreaterThan(0);
    const allowedReasons = new Set(["pause", "end", "error", "close", "cancelled"]);
    for (const event of events) {
      const { sourceId, reason, ...rest } = event.labels ?? {};
      expect(rest).toEqual({});
      expect(sourceId).toBe(SOURCE_ID);
      expect(reason == undefined || allowedReasons.has(reason)).toBe(true);
      expect(Object.values(event.labels ?? {})).not.toContain(displayName);
    }
  });

  it("should pair playback start/end once per play session when start/pause are called repeatedly", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    await waitForInitialFrame(player);

    // When
    player.startPlayback();
    player.startPlayback();
    player.pausePlayback();
    player.pausePlayback();
    player.startPlayback();
    player.close();
    await player.isClosed;

    // Then
    const playback = summarize(events).filter((entry) => entry.startsWith("playback"));
    expect(playback).toEqual([
      "playback:start",
      "playback:end:pause",
      "playback:start",
      "playback:end:close",
    ]);
  });

  it("should emit datasource.close start and end once when close() is called twice", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    await waitForInitialFrame(player);

    // When
    player.close();
    player.close();
    await player.isClosed;

    // Then
    const close = summarize(events).filter((entry) => entry.startsWith("datasource.close"));
    expect(close).toEqual(["datasource.close:start", "datasource.close:end"]);
  });

  it("should emit datasource.firstMessage only once per player", async () => {
    // Given
    const { events } = setupSink();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    player.setSubscriptions([{ topic: TOPIC }]);
    let deliveries = 0;
    const redelivered = signal();
    await waitForInitialFrame(player, (state) => {
      if ((state.activeData?.messages.length ?? 0) > 0) {
        deliveries++;
        if (deliveries === 2) {
          redelivered.resolve();
        }
      }
    });

    // When: seeking back to the start and playing re-delivers the message
    player.seekPlayback({ sec: 0, nsec: 0 });
    player.startPlayback();
    await redelivered;
    player.close();
    await player.isClosed;

    // Then
    expect(deliveries).toBeGreaterThanOrEqual(2);
    const firstMessages = events.filter((event) => event.name === "datasource.firstMessage");
    expect(firstMessages).toHaveLength(1);
  });

  it("emits no events when telemetry is disabled", async () => {
    // Given
    const telemetry = installDisabledTelemetry();
    const player = new IterablePlayer({
      source: new TelemetryTestSource(),
      enablePreload: false,
      sourceId: SOURCE_ID,
    });
    await waitForInitialFrame(player);

    // When
    player.startPlayback();
    player.seekPlayback({ sec: 0, nsec: 500_000_000 });
    player.pausePlayback();
    player.close();
    await player.isClosed;

    // Then
    expect(telemetry.event).not.toHaveBeenCalled();
  });

  describe("memory gauges", () => {
    it("should gauge every progress.memoryInfo entry as pipeline.memory.<lowerCamelCaseKey> with the sourceId", async () => {
      // Given: preloading enabled so both buffered and preloaded memory are reported
      const { sink, events } = setupSink();
      const player = new IterablePlayer({
        source: new TelemetryTestSource(),
        enablePreload: true,
        sourceId: SOURCE_ID,
      });
      player.setSubscriptions([{ topic: TOPIC, preloadType: "full" }]);
      let lastState: PlayerState | undefined;
      const preloaded = signal();
      const ready = signal();
      player.setListener(async (state) => {
        lastState = state;
        const memoryInfo = state.progress.memoryInfo ?? {};
        if (events.some((event) => event.name === "preload" && event.phase === "end")) {
          preloaded.resolve();
        }
        if (
          memoryInfo["Buffered messages"] != undefined &&
          memoryInfo["Preloaded messages"] != undefined
        ) {
          ready.resolve();
        }
      });
      await preloaded;

      // When: playback ticks merge the buffered cache size into memoryInfo
      player.startPlayback();
      await ready;
      // Gauges are set synchronously right before the listener receives the same progress.
      const samples = publishAndCollect(sink);
      const memoryInfo = lastState?.progress.memoryInfo ?? {};
      player.close();
      await player.isClosed;

      // Then: each key is exported under its normalized name, never under the raw key
      expect(Object.keys(memoryInfo).sort()).toEqual(["Buffered messages", "Preloaded messages"]);
      const expectedMetric = {
        unit: "bytes",
        scope: "pipeline",
        metricType: "gauge",
        labels: { sourceId: SOURCE_ID },
      };
      expect(samples.get("pipeline.memory.bufferedMessages")).toMatchObject({
        ...expectedMetric,
        value: memoryInfo["Buffered messages"],
      });
      expect(samples.get("pipeline.memory.preloadedMessages")).toMatchObject({
        ...expectedMetric,
        value: memoryInfo["Preloaded messages"],
      });
      expect(samples.get("pipeline.memory.preloadedMessages")?.value).toBeGreaterThan(0);
      expect(
        [...samples.keys()].filter((metric) => metric.startsWith("pipeline.memory.")).sort(),
      ).toEqual(["pipeline.memory.bufferedMessages", "pipeline.memory.preloadedMessages"]);
    });

    it("should not record any pipeline metric or event when telemetry is disabled", async () => {
      // Given: preloading enabled so BlockLoader, the buffered cache and memory gauges all run
      const telemetry = installDisabledTelemetry();
      const player = new IterablePlayer({
        source: new TelemetryTestSource(),
        enablePreload: true,
        sourceId: SOURCE_ID,
      });
      player.setSubscriptions([{ topic: TOPIC, preloadType: "full" }]);
      const preloaded = signal();
      player.setListener(async (state) => {
        if (state.progress.memoryInfo?.["Preloaded messages"] != undefined) {
          preloaded.resolve();
        }
      });
      await preloaded;

      // When
      player.startPlayback();
      player.pausePlayback();
      player.close();
      await player.isClosed;

      // Then
      expect(telemetry.gauge).not.toHaveBeenCalled();
      expect(telemetry.counter).not.toHaveBeenCalled();
      expect(telemetry.event).not.toHaveBeenCalled();
    });
  });
});

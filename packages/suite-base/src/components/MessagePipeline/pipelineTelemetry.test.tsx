/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren, useCallback, useState } from "react";

import { MessageEvent } from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { FALLBACK_PANEL_ID } from "@lichtblick/suite-base/components/constants";
import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { PlayerStateActiveData } from "@lichtblick/suite-base/players/types";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";
import { getTelemetry, setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { TelemetryMock } from "@lichtblick/suite-base/util/telemetry/builders/types";

import { MessagePipelineContext, MessagePipelineProvider, useMessagePipeline } from ".";
import FakePlayer from "./FakePlayer";
import {
  recordPipelineTickTelemetry,
  unregisterSubscriberPanelLabels,
  usePanelSubscriberTelemetry,
} from "./pipelineTelemetry";
import { createMessagePipelineStore, MessagePipelineInternalState } from "./store";

type PanelInfo = { id: string; type: string };

const PANEL: PanelInfo = { id: "Plot!3x4mpl3", type: "Plot" };

/** Installs a mock telemetry sink and returns it. */
function installMockTelemetry({ enabled }: { enabled: boolean }): TelemetryMock {
  const telemetry = TelemetryBuilder.mockTelemetry({ enabled });
  setTelemetrySink(telemetry);
  return telemetry;
}

function makeActiveData(messages: PlayerStateActiveData["messages"]): PlayerStateActiveData {
  return {
    messages,
    totalBytesReceived: 0,
    currentTime: RosTimeBuilder.time(),
    startTime: RosTimeBuilder.time(),
    endTime: RosTimeBuilder.time(),
    isPlaying: true,
    speed: 1,
    lastSeekTime: 1,
    topics: [],
    topicStats: new Map(),
    datatypes: new Map(),
  };
}

function makePipelineWrapper(player: FakePlayer, panel?: PanelInfo) {
  return function Wrapper({ children }: PropsWithChildren) {
    const [config] = useState(() => makeMockAppConfiguration());
    const pipeline = <MessagePipelineProvider player={player}>{children}</MessagePipelineProvider>;
    return (
      <AppConfigurationContext.Provider value={config}>
        <MockCurrentLayoutProvider>
          {panel ? (
            <MockPanelContextProvider id={panel.id} type={panel.type} title="Panel title">
              {pipeline}
            </MockPanelContextProvider>
          ) : (
            pipeline
          )}
        </MockCurrentLayoutProvider>
      </AppConfigurationContext.Provider>
    );
  };
}

function renderPipeline(player: FakePlayer) {
  return renderHook(
    () => useMessagePipeline(useCallback((ctx: MessagePipelineContext) => ctx, [])),
    { wrapper: makePipelineWrapper(player) },
  );
}

/** Renders the pipeline inside a panel whose `panelSubscriberId` subscriber registers telemetry. */
function renderPipelineInPanel(player: FakePlayer, panel: PanelInfo, panelSubscriberId: string) {
  return renderHook(
    () => {
      usePanelSubscriberTelemetry(panelSubscriberId);
      return useMessagePipeline(useCallback((ctx: MessagePipelineContext) => ctx, []));
    },
    { wrapper: makePipelineWrapper(player, panel) },
  );
}

function renderSubscriberTelemetryHook(subscriberId: string, panel?: PanelInfo) {
  return renderHook(
    () => {
      usePanelSubscriberTelemetry(subscriberId);
    },
    {
      wrapper: panel
        ? ({ children }: PropsWithChildren) => (
            <MockPanelContextProvider id={panel.id} type={panel.type} title="Panel title">
              {children}
            </MockPanelContextProvider>
          )
        : undefined,
    },
  );
}

/** Pipeline state as it is right after bucketing a tick that delivered the given messages. */
function makeTickState(
  messageEventsBySubscriberId: Map<string, MessageEvent[]>,
): MessagePipelineInternalState {
  const state = createMessagePipelineStore({
    promisesToWaitForRef: { current: [] },
    initialPlayer: undefined,
  }).getState();
  return { ...state, public: { ...state.public, messageEventsBySubscriberId } };
}

function panelCounterCalls(telemetry: TelemetryMock) {
  return telemetry.counter.mock.calls.filter(([metric]) => metric.startsWith("panel."));
}

async function emit(player: FakePlayer, activeData: PlayerStateActiveData): Promise<void> {
  let promise: Promise<void> | undefined;
  act(() => void (promise = player.emit({ activeData })));
  await act(async () => await promise);
}

describe("MessagePipeline telemetry", () => {
  afterEach(() => {
    setTelemetrySink(undefined);
  });

  it("records received, delivered (fan-out), subscriber and subscription metrics when enabled", async () => {
    // Given two subscribers sharing /shared (one also subscribed to /a) and an enabled sink
    const telemetry = installMockTelemetry({ enabled: true });
    const player = new FakePlayer();
    const { result } = renderPipeline(player);
    act(() => {
      result.current.setSubscriptions("panel-1", [{ topic: "/shared" }, { topic: "/a" }]);
      result.current.setSubscriptions("panel-2", [{ topic: "/shared" }]);
    });
    const shared = MessageEventBuilder.messageEvent({ topic: "/shared", sizeInBytes: 100 });
    const onlyA = MessageEventBuilder.messageEvent({ topic: "/a", sizeInBytes: 10 });
    const unsubscribed = MessageEventBuilder.messageEvent({ topic: "/none", sizeInBytes: 1 });

    // When the player emits one tick with these messages
    await emit(player, makeActiveData([shared, onlyA, unsubscribed]));

    // Then received counts every emitted message once
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.received",
      3,
      "count",
      "pipeline",
    );
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.receivedBytes",
      111,
      "bytes",
      "pipeline",
    );
    // And delivered counts the fan-out: /shared twice (2 × 100) plus /a once
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.delivered",
      3,
      "count",
      "pipeline",
    );
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.deliveredBytes",
      210,
      "bytes",
      "pipeline",
    );
    // And the gauges report 2 distinct subscribers holding 3 subscription payloads
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "pipeline.subscribers.count",
      2,
      "count",
      "pipeline",
    );
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "pipeline.subscriptions.count",
      3,
      "count",
      "pipeline",
    );
    // And the dispatch duration is recorded once as an observation (not a gauge), without labels
    expect(telemetry.observe).toHaveBeenCalledTimes(1);
    expect(telemetry.observe).toHaveBeenCalledWith(
      "pipeline.listenerDispatchDurationMs",
      expect.any(Number),
      "ms",
      "pipeline",
    );
    expect(telemetry.observe.mock.calls[0]?.[1]).toBeGreaterThanOrEqual(0);
    expect(telemetry.gauge).not.toHaveBeenCalledWith(
      "pipeline.listenerDispatchDurationMs",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    // And isEnabled is checked once per tick
    expect(telemetry.isEnabled).toHaveBeenCalledTimes(1);
  });

  it("skips message counters for a tick without messages but still reports gauges", async () => {
    // Given an enabled sink and one subscriber
    const telemetry = installMockTelemetry({ enabled: true });
    const player = new FakePlayer();
    const { result } = renderPipeline(player);
    act(() => {
      result.current.setSubscriptions("panel-1", [{ topic: "/shared" }]);
    });

    // When the player emits a tick with no messages
    await emit(player, makeActiveData([]));

    // Then no message counters are recorded
    expect(telemetry.counter).not.toHaveBeenCalled();
    // And the gauges are still reported
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "pipeline.subscribers.count",
      1,
      "count",
      "pipeline",
    );
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "pipeline.subscriptions.count",
      1,
      "count",
      "pipeline",
    );
  });

  it("should count a re-emitted messages array once and a new array again", async () => {
    // Given an enabled sink, one subscriber and a messages array the player will re-emit
    const telemetry = installMockTelemetry({ enabled: true });
    const player = new FakePlayer();
    const { result } = renderPipeline(player);
    act(() => {
      result.current.setSubscriptions("panel-1", [{ topic: "/a" }]);
    });
    const messages = [MessageEventBuilder.messageEvent({ topic: "/a", sizeInBytes: 10 })];
    const messageCounterCalls = () =>
      telemetry.counter.mock.calls.filter(([metric]) => metric.startsWith("pipeline.messages."));

    // When the player emits the same array reference on two consecutive ticks
    await emit(player, makeActiveData(messages));
    await emit(player, makeActiveData(messages));

    // Then received and delivered are counted once, matching what the store bucketed
    expect(messageCounterCalls()).toEqual([
      ["pipeline.messages.received", 1, "count", "pipeline"],
      ["pipeline.messages.receivedBytes", 10, "bytes", "pipeline"],
      ["pipeline.messages.delivered", 1, "count", "pipeline"],
      ["pipeline.messages.deliveredBytes", 10, "bytes", "pipeline"],
    ]);
    // And the gauges are still reported on both ticks
    expect(
      telemetry.gauge.mock.calls.filter(([metric]) => metric === "pipeline.subscribers.count"),
    ).toHaveLength(2);

    // When the player then emits a new array with the same content
    telemetry.counter.mockClear();
    await emit(player, makeActiveData([...messages]));

    // Then it is counted again
    expect(messageCounterCalls()).toEqual([
      ["pipeline.messages.received", 1, "count", "pipeline"],
      ["pipeline.messages.receivedBytes", 10, "bytes", "pipeline"],
      ["pipeline.messages.delivered", 1, "count", "pipeline"],
      ["pipeline.messages.deliveredBytes", 10, "bytes", "pipeline"],
    ]);
  });

  it("should skip received and delivered counters when messages match the previous reference", () => {
    // Given an enabled sink and a tick state whose bucket is (stale) non-empty
    const telemetry = installMockTelemetry({ enabled: true });
    const messages = [MessageEventBuilder.messageEvent({ sizeInBytes: 5 })];
    const state = makeTickState(new Map([["panel-1", messages]]));

    // When the tick is recorded with the same array as the previous tick
    recordPipelineTickTelemetry(getTelemetry(), state, messages, messages);

    // Then no message counters are emitted
    expect(telemetry.counter).not.toHaveBeenCalled();
    // And the gauges are still reported
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "pipeline.subscribers.count",
      0,
      "count",
      "pipeline",
    );
  });

  it("records nothing when telemetry is disabled", async () => {
    // Given a disabled sink and two subscribers sharing a topic
    const telemetry = installMockTelemetry({ enabled: false });
    const player = new FakePlayer();
    const { result } = renderPipeline(player);
    act(() => {
      result.current.setSubscriptions("panel-1", [{ topic: "/shared" }]);
      result.current.setSubscriptions("panel-2", [{ topic: "/shared" }]);
    });

    // When the player emits a tick with messages
    await emit(
      player,
      makeActiveData([MessageEventBuilder.messageEvent({ topic: "/shared", sizeInBytes: 5 })]),
    );

    // Then the sink is only asked whether it is enabled, once for the tick
    expect(telemetry.isEnabled).toHaveBeenCalledTimes(1);
    expect(telemetry.counter).not.toHaveBeenCalled();
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(telemetry.observe).not.toHaveBeenCalled();
    // And bucketing behaves as before
    expect(result.current.messageEventsBySubscriberId.get("panel-1")).toHaveLength(1);
    expect(result.current.messageEventsBySubscriberId.get("panel-2")).toHaveLength(1);
  });
});

describe("usePanelSubscriberTelemetry", () => {
  const SUBSCRIBER_ID = "subscriber-in-panel";

  afterEach(() => {
    unregisterSubscriberPanelLabels(SUBSCRIBER_ID);
    setTelemetrySink(undefined);
  });

  it("emits per-panel delivered counters labelled with the panel layout id and type", () => {
    // Given an enabled sink and a subscriber registered from inside a panel
    const telemetry = installMockTelemetry({ enabled: true });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID, PANEL);
    const state = makeTickState(
      new Map([
        [
          SUBSCRIBER_ID,
          [
            MessageEventBuilder.messageEvent({ sizeInBytes: 40 }),
            MessageEventBuilder.messageEvent({ sizeInBytes: 2 }),
          ],
        ],
      ]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then the panel counters carry the layout id (never the title) and the panel type
    const labels = { panelId: PANEL.id, panelType: PANEL.type };
    expect(panelCounterCalls(telemetry)).toEqual([
      ["panel.messages.delivered", 2, "count", "panel", labels],
      ["panel.messages.deliveredBytes", 42, "bytes", "panel", labels],
    ]);
  });

  it("does not emit per-panel counters for unregistered subscribers", () => {
    // Given an enabled sink and a registered subscriber next to an unregistered one
    const telemetry = installMockTelemetry({ enabled: true });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID, PANEL);
    const state = makeTickState(
      new Map([
        [SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]],
        ["unregistered", [MessageEventBuilder.messageEvent({ sizeInBytes: 9 })]],
      ]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then only the registered subscriber is attributed to a panel
    const labels = { panelId: PANEL.id, panelType: PANEL.type };
    expect(panelCounterCalls(telemetry)).toEqual([
      ["panel.messages.delivered", 1, "count", "panel", labels],
      ["panel.messages.deliveredBytes", 7, "bytes", "panel", labels],
    ]);
    // And the pipeline totals still include both subscribers
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.delivered",
      2,
      "count",
      "pipeline",
    );
  });

  it("unregisters the subscriber on unmount", () => {
    // Given an enabled sink and a registered subscriber that unmounts
    const telemetry = installMockTelemetry({ enabled: true });
    const { unmount } = renderSubscriberTelemetryHook(SUBSCRIBER_ID, PANEL);
    unmount();
    const state = makeTickState(
      new Map([[SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]]]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then no per-panel counters are emitted
    expect(panelCounterCalls(telemetry)).toEqual([]);
  });

  it("does not register outside a PanelContext", () => {
    // Given an enabled sink and the hook rendered outside any panel
    const telemetry = installMockTelemetry({ enabled: true });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID);
    const state = makeTickState(
      new Map([[SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]]]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then no per-panel counters are emitted
    expect(panelCounterCalls(telemetry)).toEqual([]);
  });

  it("should not register a panel rendered outside a layout", () => {
    // Given an enabled sink and a panel whose context id is the fallback (no layout child id)
    const telemetry = installMockTelemetry({ enabled: true });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID, { id: FALLBACK_PANEL_ID, type: "Plot" });
    const state = makeTickState(
      new Map([[SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]]]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then no per-panel counters are emitted
    expect(panelCounterCalls(telemetry)).toEqual([]);
  });

  it("does not register when telemetry is disabled", () => {
    // Given a disabled sink while the panel subscriber mounts
    const disabled = installMockTelemetry({ enabled: false });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID, PANEL);
    const state = makeTickState(
      new Map([[SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]]]),
    );

    // When a tick is later recorded on an enabled sink
    const enabled = installMockTelemetry({ enabled: true });
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then nothing was registered and the disabled sink never received a metric
    expect(panelCounterCalls(enabled)).toEqual([]);
    expect(disabled.counter).not.toHaveBeenCalled();
    expect(disabled.gauge).not.toHaveBeenCalled();
    expect(disabled.observe).not.toHaveBeenCalled();
  });

  it("should not emit counters for a registered subscriber whose bucket is empty for the tick", () => {
    // Given an enabled sink and a registered panel subscriber that received nothing this tick
    const telemetry = installMockTelemetry({ enabled: true });
    renderSubscriberTelemetryHook(SUBSCRIBER_ID, PANEL);
    const state = makeTickState(new Map([[SUBSCRIBER_ID, []]]));

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then neither zero-valued panel counters nor pipeline delivered counters are emitted
    expect(telemetry.counter).not.toHaveBeenCalled();
  });

  it("should move the registration to the new subscriber id when the id changes", () => {
    // Given an enabled sink and a panel subscriber whose id changes after mount
    const telemetry = installMockTelemetry({ enabled: true });
    const newSubscriberId = "subscriber-in-panel-renamed";
    const { rerender } = renderHook(
      ({ subscriberId }: { subscriberId: string }) => {
        usePanelSubscriberTelemetry(subscriberId);
      },
      {
        initialProps: { subscriberId: SUBSCRIBER_ID },
        wrapper: ({ children }: PropsWithChildren) => (
          <MockPanelContextProvider id={PANEL.id} type={PANEL.type} title="Panel title">
            {children}
          </MockPanelContextProvider>
        ),
      },
    );
    rerender({ subscriberId: newSubscriberId });
    const state = makeTickState(
      new Map([
        [SUBSCRIBER_ID, [MessageEventBuilder.messageEvent({ sizeInBytes: 7 })]],
        [newSubscriberId, [MessageEventBuilder.messageEvent({ sizeInBytes: 9 })]],
      ]),
    );

    // When a tick is recorded
    recordPipelineTickTelemetry(getTelemetry(), state, undefined);

    // Then only the new id is attributed to the panel (the old one was unregistered)
    const labels = { panelId: PANEL.id, panelType: PANEL.type };
    expect(panelCounterCalls(telemetry)).toEqual([
      ["panel.messages.delivered", 1, "count", "panel", labels],
      ["panel.messages.deliveredBytes", 9, "bytes", "panel", labels],
    ]);
  });

  it("attributes listener ticks to the panel end to end", async () => {
    // Given an enabled sink and a panel subscriber sharing /shared with a non-panel subscriber
    const telemetry = installMockTelemetry({ enabled: true });
    const player = new FakePlayer();
    const { result } = renderPipelineInPanel(player, PANEL, SUBSCRIBER_ID);
    act(() => {
      result.current.setSubscriptions(SUBSCRIBER_ID, [{ topic: "/shared" }]);
      result.current.setSubscriptions("other", [{ topic: "/shared" }]);
    });

    // When the player emits a tick on /shared
    await emit(
      player,
      makeActiveData([MessageEventBuilder.messageEvent({ topic: "/shared", sizeInBytes: 100 })]),
    );

    // Then the panel gets its own share and the pipeline counts the full fan-out
    const labels = { panelId: PANEL.id, panelType: PANEL.type };
    expect(panelCounterCalls(telemetry)).toEqual([
      ["panel.messages.delivered", 1, "count", "panel", labels],
      ["panel.messages.deliveredBytes", 100, "bytes", "panel", labels],
    ]);
    expect(telemetry.counter).toHaveBeenCalledWith(
      "pipeline.messages.deliveredBytes",
      200,
      "bytes",
      "pipeline",
    );
  });
});

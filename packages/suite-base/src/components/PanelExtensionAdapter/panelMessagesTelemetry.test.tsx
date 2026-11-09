/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render, renderHook } from "@testing-library/react";
import { PropsWithChildren, useState } from "react";

import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@lichtblick/suite";
import { MessagePipelineProvider } from "@lichtblick/suite-base/components/MessagePipeline";
import FakePlayer from "@lichtblick/suite-base/components/MessagePipeline/FakePlayer";
import { recordPipelineTickTelemetry } from "@lichtblick/suite-base/components/MessagePipeline/pipelineTelemetry";
import { createMessagePipelineStore } from "@lichtblick/suite-base/components/MessagePipeline/store";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { useMessagesByTopic } from "@lichtblick/suite-base/PanelAPI";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";
import { setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { TelemetryMock } from "@lichtblick/suite-base/util/telemetry/builders/types";

import PanelExtensionAdapter from "./PanelExtensionAdapter";
import { PANEL_TELEMETRY_METRICS } from "./constants";

const TOPIC = "/x";
const TICKS = 6;
const MESSAGES_PER_TICK = 4;
const BYTES_PER_MESSAGE = 10;
const TOTAL_MESSAGES = TICKS * MESSAGES_PER_TICK;
const TOPICS = [{ name: TOPIC, schemaName: "foo" }];
const EMPTY_CONFIG = {};
const noopSaveConfig = (): void => {};
const nonBlockingPauseFrame = () => () => {};

// The same input for both panels: TICKS ticks, each with MESSAGES_PER_TICK fresh messages.
function buildTicks(): MessageEvent[][] {
  return Array.from({ length: TICKS }, (_, tick) =>
    Array.from({ length: MESSAGES_PER_TICK }, (_unused, i) =>
      MessageEventBuilder.messageEvent({
        topic: TOPIC,
        receiveTime: { sec: tick, nsec: i + 1 },
        sizeInBytes: BYTES_PER_MESSAGE,
        message: { value: tick * MESSAGES_PER_TICK + i },
        schemaName: "foo",
      }),
    ),
  );
}

function sumCounter(telemetry: TelemetryMock, metric: string, panelType: string): number {
  return telemetry.counter.mock.calls
    .filter(([name, , , , labels]) => name === metric && labels?.panelType === panelType)
    .reduce((sum, [, value]) => sum + value, 0);
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function makeTableWrapper(player: FakePlayer) {
  return function TableWrapper({ children }: PropsWithChildren) {
    const [config] = useState(() => makeMockAppConfiguration());
    return (
      <AppConfigurationContext.Provider value={config}>
        <MockCurrentLayoutProvider>
          <MessagePipelineProvider player={player}>
            <MockPanelContextProvider id="Table!t4bl3" type="Table" title="Table">
              {children}
            </MockPanelContextProvider>
          </MessagePipelineProvider>
        </MockCurrentLayoutProvider>
      </AppConfigurationContext.Provider>
    );
  };
}

async function emitTick(player: FakePlayer, messages: MessageEvent[], tick: number): Promise<void> {
  let emitted: Promise<void> | undefined;
  act(() => {
    emitted = player.emit({
      activeData: {
        messages,
        currentTime: { sec: tick, nsec: 0 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: TICKS, nsec: 0 },
        isPlaying: true,
        speed: 1,
        lastSeekTime: 1,
        topics: TOPICS,
        topicStats: new Map(),
        datatypes: new Map(),
        totalBytesReceived: 0,
      },
    });
  });
  await act(async () => {
    await emitted;
  });
}

/** Records the pipeline tick telemetry as if the pipeline bucketed `frame` for `subscriberId`. */
function recordPipelineTick(
  telemetry: TelemetryMock,
  subscriberId: string,
  frame: MessageEvent[],
): void {
  const state = createMessagePipelineStore({
    promisesToWaitForRef: { current: [] },
    initialPlayer: undefined,
  }).getState();
  recordPipelineTickTelemetry(
    telemetry,
    {
      ...state,
      public: { ...state.public, messageEventsBySubscriberId: new Map([[subscriberId, frame]]) },
    },
    frame,
  );
}

type ThreeDeeProps = {
  tick: number;
  frame: MessageEvent[];
  initPanel: (context: PanelExtensionContext) => void;
  setSubscriptions: (subscriberId: string, payloads: Immutable<SubscribePayload[]>) => void;
};

function ThreeDeeWrapper({
  tick,
  frame,
  initPanel,
  setSubscriptions,
}: ThreeDeeProps): React.JSX.Element {
  return (
    <ThemeProvider isDark>
      <MockPanelContextProvider id="3D!s10w" type="3D" title="3D">
        <PanelSetup
          fixture={{
            activeData: { currentTime: { sec: tick, nsec: 0 } },
            frame: { [TOPIC]: frame },
            topics: TOPICS,
            setSubscriptions,
          }}
          pauseFrame={nonBlockingPauseFrame}
        >
          <PanelExtensionAdapter
            config={EMPTY_CONFIG}
            saveConfig={noopSaveConfig}
            initPanel={initPanel}
          />
        </PanelSetup>
      </MockPanelContextProvider>
    </ThemeProvider>
  );
}

describe("panel.messages.delivered and panel.messages.rendered", () => {
  let mockRAF: jest.SpyInstance;

  beforeEach(() => {
    mockRAF = jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      queueMicrotask(() => {
        cb(performance.now());
      });
      return 0;
    });
  });

  afterEach(() => {
    setTelemetrySink(undefined);
    mockRAF.mockRestore();
  });

  it("should report the same delivered total for a built-in and an extension panel fed the same messages", async () => {
    // GIVEN - one enabled sink and the same sequence of ticks for both panels
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const ticks = buildTicks();

    // WHEN - the built-in "Table" panel receives every tick through the real MessagePipeline
    const player = new FakePlayer();
    renderHook(() => useMessagesByTopic({ topics: [TOPIC], historySize: 1 }), {
      wrapper: makeTableWrapper(player),
    });
    for (const [tick, messages] of ticks.entries()) {
      await emitTick(player, messages, tick);
    }

    // AND - the "3D" extension panel receives the same ticks, the pipeline buckets each one for its
    // subscriber, and its render takes two ticks (done() is called after the next tick arrived)
    let subscriberId: string | undefined;
    const setSubscriptions = (id: string, payloads: Immutable<SubscribePayload[]>) => {
      if (payloads.length > 0) {
        subscriberId = id;
      }
    };
    let pendingDone: (() => void) | undefined;
    // Frames handed to onRender, captured at call time (the render state object is reused).
    const renderedFrames = new Set<Immutable<RenderState>["currentFrame"]>();
    const onRender = jest.fn((state: Immutable<RenderState>, done: () => void) => {
      if (state.currentFrame != undefined) {
        renderedFrames.add(state.currentFrame);
      }
      pendingDone = done;
    });
    const finishPendingRender = () => {
      pendingDone?.();
      pendingDone = undefined;
    };
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.subscribe([{ topic: TOPIC }]);
      context.onRender = onRender;
    };
    const handle = render(
      <ThreeDeeWrapper
        tick={0}
        frame={ticks[0]!}
        initPanel={initPanel}
        setSubscriptions={setSubscriptions}
      />,
    );
    await flush();
    recordPipelineTick(telemetry, subscriberId!, ticks[0]!);
    for (let tick = 1; tick < TICKS; tick++) {
      handle.rerender(
        <ThreeDeeWrapper
          tick={tick}
          frame={ticks[tick]!}
          initPanel={initPanel}
          setSubscriptions={setSubscriptions}
        />,
      );
      await flush();
      recordPipelineTick(telemetry, subscriberId!, ticks[tick]!);
      if (tick % 2 === 1) {
        act(finishPendingRender);
        await flush();
      }
    }

    // THEN - delivered has one meaning: every bucketed message, for both panel kinds
    expect(subscriberId).toBeDefined();
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.messagesDelivered, "Table")).toBe(
      TOTAL_MESSAGES,
    );
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.messagesDelivered, "3D")).toBe(
      TOTAL_MESSAGES,
    );
    // THEN - rendered counts the messages of the frames handed to onRender, once per frame
    const renderedMessages = [...renderedFrames].reduce((sum, f) => sum + (f?.length ?? 0), 0);
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.messagesRendered, "3D")).toBe(
      renderedMessages,
    );
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.messagesRenderedBytes, "3D")).toBe(
      renderedMessages * BYTES_PER_MESSAGE,
    );
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped, "3D")).toBeGreaterThan(0);
    expect(renderedMessages).toBeLessThan(TOTAL_MESSAGES);
    // THEN - built-in panels do not emit the rendered metric
    expect(sumCounter(telemetry, PANEL_TELEMETRY_METRICS.messagesRendered, "Table")).toBe(0);
  });
});

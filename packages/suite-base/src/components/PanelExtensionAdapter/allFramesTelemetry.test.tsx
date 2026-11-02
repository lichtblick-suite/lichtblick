/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";
import { act } from "react";

import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";

import PanelExtensionAdapter from "./PanelExtensionAdapter";
import {
  buildPanelTelemetryLabels,
  createAllFramesDeliveryTracker,
  PANEL_TELEMETRY_METRICS,
  recordAllFramesDelivered,
  resetAllFramesDeliveryTracker,
} from "./panelTelemetry";

const LAYOUT_PANEL_ID = "3D!1a2b";
const PANEL_TYPE = "3D";
const LABELS = buildPanelTelemetryLabels(LAYOUT_PANEL_ID, PANEL_TYPE);
const DELIVERED = PANEL_TELEMETRY_METRICS.rangeMessagesDelivered;
const DELIVERED_BYTES = PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes;

function buildMessage(sizeInBytes: number, sec: number = 0): MessageEvent {
  return {
    topic: "/tf",
    receiveTime: { sec, nsec: 0 },
    sizeInBytes,
    message: {},
    schemaName: "foo",
  };
}

describe("recordAllFramesDelivered", () => {
  it("counts only the new tail when allFrames grows", () => {
    // GIVEN - a tracker that already counted the first two messages
    const telemetry = TelemetryBuilder.mockTelemetry();
    const tracker = createAllFramesDeliveryTracker();
    const first = buildMessage(10);
    const second = buildMessage(20);
    recordAllFramesDelivered(telemetry, tracker, [first, second], LABELS);
    telemetry.counter.mockClear();

    // WHEN - a rebuilt allFrames contains the same messages plus a new tail
    recordAllFramesDelivered(
      telemetry,
      tracker,
      [first, second, buildMessage(5), buildMessage(7)],
      LABELS,
    );

    // THEN - only the two tail messages (12 bytes) are counted
    expect(telemetry.counter.mock.calls).toEqual([
      [DELIVERED, 2, "count", "panel", LABELS],
      [DELIVERED_BYTES, 12, "bytes", "panel", LABELS],
    ]);
    expect(tracker.countedLength).toBe(4);
  });

  it("counts nothing when the allFrames reference is unchanged", () => {
    // GIVEN - an allFrames array that was already counted
    const telemetry = TelemetryBuilder.mockTelemetry();
    const tracker = createAllFramesDeliveryTracker();
    const allFrames = [buildMessage(10), buildMessage(20)];
    recordAllFramesDelivered(telemetry, tracker, allFrames, LABELS);
    telemetry.counter.mockClear();

    // WHEN - the same reference is seen again
    recordAllFramesDelivered(telemetry, tracker, allFrames, LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toHaveLength(0);
    expect(tracker.countedLength).toBe(2);
  });

  it("resets the baseline without counting a negative when allFrames shrinks, then counts regrowth", () => {
    // GIVEN - three messages already counted
    const telemetry = TelemetryBuilder.mockTelemetry();
    const tracker = createAllFramesDeliveryTracker();
    recordAllFramesDelivered(
      telemetry,
      tracker,
      [buildMessage(1), buildMessage(2), buildMessage(3)],
      LABELS,
    );
    telemetry.counter.mockClear();

    // WHEN - allFrames is rebuilt shorter (eviction / topic removal), then undefined
    recordAllFramesDelivered(telemetry, tracker, [buildMessage(1)], LABELS);
    const afterShrink = tracker.countedLength;
    recordAllFramesDelivered(telemetry, tracker, undefined, LABELS);
    const afterUndefined = tracker.countedLength;

    // THEN - nothing is counted and the baseline follows the new length
    expect(telemetry.counter.mock.calls).toHaveLength(0);
    expect(afterShrink).toBe(1);
    expect(afterUndefined).toBe(0);

    // WHEN - data is loaded again
    recordAllFramesDelivered(telemetry, tracker, [buildMessage(4), buildMessage(0)], LABELS);

    // THEN - the re-delivery is counted (bytes of the tail only)
    expect(telemetry.counter.mock.calls).toEqual([
      [DELIVERED, 2, "count", "panel", LABELS],
      [DELIVERED_BYTES, 4, "bytes", "panel", LABELS],
    ]);
  });

  it("counts the full array again after an explicit reset (re-initialisation)", () => {
    // GIVEN - a fully counted allFrames
    const telemetry = TelemetryBuilder.mockTelemetry();
    const tracker = createAllFramesDeliveryTracker();
    const allFrames = [buildMessage(3), buildMessage(4)];
    recordAllFramesDelivered(telemetry, tracker, allFrames, LABELS);
    telemetry.counter.mockClear();

    // WHEN - the tracker is reset and the same array is delivered again
    resetAllFramesDeliveryTracker(tracker);
    recordAllFramesDelivered(telemetry, tracker, allFrames, LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([
      [DELIVERED, 2, "count", "panel", LABELS],
      [DELIVERED_BYTES, 7, "bytes", "panel", LABELS],
    ]);
  });

  it("skips the bytes counter when the new messages have zero size", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();
    const tracker = createAllFramesDeliveryTracker();

    // WHEN
    recordAllFramesDelivered(telemetry, tracker, [buildMessage(0)], LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([[DELIVERED, 1, "count", "panel", LABELS]]);
  });
});

describe("PanelExtensionAdapter allFrames telemetry", () => {
  let mockRAF: jest.SpyInstance;

  beforeEach(() => {
    mockRAF = jest
      .spyOn(window, "requestAnimationFrame")
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);
  });

  afterEach(() => {
    setTelemetrySink(undefined);
    mockRAF.mockRestore();
  });

  function renderPanelWithBlocks(
    messages: MessageEvent[],
    onAllFrames: (allFrames: Immutable<RenderState>["allFrames"]) => void,
  ): void {
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("allFrames");
      context.subscribe([{ topic: "/tf", preload: true }]);
      context.onRender = (renderState, done) => {
        onAllFrames(renderState.allFrames);
        done();
      };
    };
    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider id={LAYOUT_PANEL_ID} type={PANEL_TYPE} title="Visible title">
          <PanelSetup
            fixture={{
              // No topic schema: the builder takes the unconverted path, which does not copy the
              // message (a copy would read sizeInBytes and blur the "disabled computes nothing" check).
              progress: {
                messageCache: {
                  startTime: { sec: 0, nsec: 0 },
                  blocks: [{ sizeInBytes: 0, messagesByTopic: { "/tf": messages } }],
                },
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
  }

  it("counts preloaded messages delivered via allFrames with the layout panel id", async () => {
    // GIVEN - an enabled sink and a preloaded block with two messages
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    let lastAllFrames: Immutable<RenderState>["allFrames"];

    // WHEN - the panel watching allFrames is rendered
    renderPanelWithBlocks([buildMessage(100, 1), buildMessage(50, 2)], (allFrames) => {
      lastAllFrames = allFrames;
    });
    await act(async () => {
      await Promise.resolve();
    });

    // THEN - the panel received the messages and they were counted exactly once
    expect(lastAllFrames).toHaveLength(2);
    const rangeCalls = telemetry.counter.mock.calls.filter(
      ([metric]) => metric === DELIVERED || metric === DELIVERED_BYTES,
    );
    expect(rangeCalls).toEqual([
      [DELIVERED, 2, "count", "panel", { panelId: LAYOUT_PANEL_ID, panelType: PANEL_TYPE }],
      [DELIVERED_BYTES, 150, "bytes", "panel", { panelId: LAYOUT_PANEL_ID, panelType: PANEL_TYPE }],
    ]);
  });

  it("computes nothing when telemetry is disabled", async () => {
    // GIVEN - a disabled sink and messages whose size must not be read
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
    setTelemetrySink(telemetry);
    const sizeSpy = jest.fn(() => 10);
    const message = buildMessage(0, 1);
    Object.defineProperty(message, "sizeInBytes", { get: sizeSpy });
    let lastAllFrames: Immutable<RenderState>["allFrames"];

    // WHEN
    renderPanelWithBlocks([message], (allFrames) => {
      lastAllFrames = allFrames;
    });
    await act(async () => {
      await Promise.resolve();
    });

    // THEN - the panel still got its data, but no size was read and nothing was recorded
    expect(lastAllFrames).toHaveLength(1);
    expect(telemetry.isEnabled.mock.calls.length).toBeGreaterThan(0);
    expect(sizeSpy).not.toHaveBeenCalled();
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });
});

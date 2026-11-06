/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";
import { act } from "react";

import {
  Immutable,
  MessageEvent,
  PanelExtensionContext,
  RenderState,
  Time,
} from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { TelemetryMock } from "@lichtblick/suite-base/util/telemetry/builders/types";

import PanelExtensionAdapter from "./PanelExtensionAdapter";
import { PANEL_TELEMETRY_METRICS } from "./panelTelemetry";

const LAYOUT_PANEL_ID = "Plot!3x9a";
const PANEL_TYPE = "Plot";
const EXPECTED_LABELS = { panelId: LAYOUT_PANEL_ID, panelType: PANEL_TYPE };
// Stable across re-renders so the adapter only re-initialises the panel when `initPanel` changes.
const TOPICS = [{ name: "/x", schemaName: "foo" }];
const EMPTY_CONFIG = {};
const noopSaveConfig = (): void => {};

function buildMessage(sizeInBytes: number): MessageEvent {
  return MessageEventBuilder.messageEvent({
    topic: "/x",
    receiveTime: { sec: 0, nsec: 1 },
    sizeInBytes,
    message: { value: sizeInBytes },
    schemaName: "foo",
  });
}

function counterCalls(telemetry: TelemetryMock, metric: string): unknown[][] {
  return telemetry.counter.mock.calls.filter(([name]) => name === metric);
}

type PauseFrame = (name: string) => () => void;

type WrapperProps = {
  currentTime: Time;
  frame?: Record<string, MessageEvent[]>;
  initPanel: (context: PanelExtensionContext) => void;
  /**
   * Overrides the mock pipeline's pauseFrame. The default one holds back new frames until the
   * panel calls done(); a non-blocking one emulates the real pipeline's pauseFrame timeout.
   */
  pauseFrame?: PauseFrame;
};

// Never holds back the pipeline, like the real pauseFrame once its timeout has elapsed.
const nonBlockingPauseFrame: PauseFrame = () => () => {};

function Wrapper({ currentTime, frame, initPanel, pauseFrame }: WrapperProps): React.JSX.Element {
  return (
    <ThemeProvider isDark>
      <MockPanelContextProvider id={LAYOUT_PANEL_ID} type={PANEL_TYPE} title="Visible title">
        <PanelSetup
          fixture={{ activeData: { currentTime }, frame, topics: TOPICS }}
          pauseFrame={pauseFrame}
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

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("PanelExtensionAdapter telemetry", () => {
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

  it("emits delivered messages/bytes, render count/duration and a single firstRender with the layout panel id", async () => {
    // GIVEN - an enabled telemetry sink and a panel subscribed to /x that always calls done()
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const frame = { "/x": [buildMessage(10), buildMessage(32)] };
    let renderCalls = 0;
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.watch("currentTime");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = (_renderState: Immutable<RenderState>, done) => {
        renderCalls++;
        done();
      };
    };

    // WHEN - the panel is rendered over several frames
    const handle = render(
      <Wrapper currentTime={{ sec: 1, nsec: 0 }} frame={frame} initPanel={initPanel} />,
    );
    await flush();
    handle.rerender(
      <Wrapper currentTime={{ sec: 2, nsec: 0 }} frame={frame} initPanel={initPanel} />,
    );
    await flush();
    handle.rerender(
      <Wrapper currentTime={{ sec: 3, nsec: 0 }} frame={frame} initPanel={initPanel} />,
    );
    await flush();

    // THEN - message counters are aggregated per frame and labelled with the layout id
    const delivered = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.messagesDelivered);
    expect(delivered.length).toBeGreaterThan(0);
    for (const call of delivered) {
      expect(call).toEqual([
        PANEL_TELEMETRY_METRICS.messagesDelivered,
        2,
        "count",
        "panel",
        EXPECTED_LABELS,
      ]);
    }
    const deliveredBytes = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.messagesDeliveredBytes);
    expect(deliveredBytes).toHaveLength(delivered.length);
    for (const call of deliveredBytes) {
      expect(call).toEqual([
        PANEL_TELEMETRY_METRICS.messagesDeliveredBytes,
        42,
        "bytes",
        "panel",
        EXPECTED_LABELS,
      ]);
    }

    // THEN - one render count + duration per completed render
    expect(renderCalls).toBeGreaterThan(1);
    const renderCount = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderCount);
    expect(renderCount).toHaveLength(renderCalls);
    expect(renderCount[0]).toEqual([
      PANEL_TELEMETRY_METRICS.renderCount,
      1,
      "count",
      "panel",
      EXPECTED_LABELS,
    ]);
    expect(telemetry.gauge.mock.calls).toHaveLength(0);
    expect(telemetry.observe.mock.calls).toHaveLength(renderCalls);
    for (const [metric, value, unit, scope, labels] of telemetry.observe.mock.calls) {
      expect(metric).toBe(PANEL_TELEMETRY_METRICS.renderDurationMs);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(unit).toBe("ms");
      expect(scope).toBe("panel");
      expect(labels).toEqual(EXPECTED_LABELS);
    }

    // THEN - firstRender is emitted exactly once per mount, and labels are reused (no per-frame allocation)
    expect(telemetry.event.mock.calls).toHaveLength(1);
    expect(telemetry.event.mock.calls[0]).toEqual([
      "panel.firstRender",
      "instant",
      "panel",
      EXPECTED_LABELS,
    ]);
    const labelObjects = new Set(telemetry.counter.mock.calls.map((call) => call[4]));
    expect(labelObjects.size).toBe(1);
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped)).toHaveLength(0);
  });

  it("should not count a hover-only re-run as skipped while a render is pending", async () => {
    // GIVEN - an enabled sink and a panel watching frames and preview time that never calls done()
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const frame = { "/x": [buildMessage(10)] };
    let panelContext: PanelExtensionContext | undefined;
    const onRender = jest.fn();
    const initPanel = (context: PanelExtensionContext) => {
      panelContext = context;
      context.watch("currentFrame");
      context.watch("previewTime");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = onRender;
    };
    render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} frame={frame} initPanel={initPanel} />);
    await flush();
    expect(onRender).toHaveBeenCalledTimes(1);
    const skippedBefore = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped).length;

    // WHEN - only the hover (preview time) changes, several times, while the render is pending
    act(() => {
      panelContext!.setPreviewTime(101);
    });
    await flush();
    act(() => {
      panelContext!.setPreviewTime(102);
    });
    await flush();

    // THEN - the panel was not rendered again and no skipped frame was recorded
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped)).toHaveLength(
      skippedBefore,
    );
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderCount)).toHaveLength(0);
  });

  it("should count a new frame as skipped while a render is pending", async () => {
    // GIVEN - an enabled sink, a pipeline that does not wait for the panel, and a panel watching
    // frames that never calls done()
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = jest.fn();
    };
    const handle = render(
      <Wrapper
        currentTime={{ sec: 1, nsec: 0 }}
        frame={{ "/x": [buildMessage(10)] }}
        initPanel={initPanel}
        pauseFrame={nonBlockingPauseFrame}
      />,
    );
    await flush();
    const skippedBefore = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped).length;

    // WHEN - a new frame arrives while the render is still pending
    handle.rerender(
      <Wrapper
        currentTime={{ sec: 2, nsec: 0 }}
        frame={{ "/x": [buildMessage(20)] }}
        initPanel={initPanel}
        pauseFrame={nonBlockingPauseFrame}
      />,
    );
    await flush();

    // THEN - exactly one more skipped frame is recorded, and its messages are not counted as delivered
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped)).toHaveLength(
      skippedBefore + 1,
    );
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped).at(-1)).toEqual([
      PANEL_TELEMETRY_METRICS.renderSkipped,
      1,
      "count",
      "panel",
      EXPECTED_LABELS,
    ]);
    expect(
      counterCalls(telemetry, PANEL_TELEMETRY_METRICS.messagesDeliveredBytes),
    ).not.toContainEqual([
      PANEL_TELEMETRY_METRICS.messagesDeliveredBytes,
      20,
      "bytes",
      "panel",
      EXPECTED_LABELS,
    ]);
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderCount)).toHaveLength(0);
  });

  it("should not count a tick without messages as skipped while a render is pending", async () => {
    // GIVEN - an enabled sink, a pipeline that does not wait for the panel, and a panel watching
    // frames that never calls done()
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = jest.fn();
    };
    const handle = render(
      <Wrapper
        currentTime={{ sec: 1, nsec: 0 }}
        frame={{ "/x": [buildMessage(10)] }}
        initPanel={initPanel}
        pauseFrame={nonBlockingPauseFrame}
      />,
    );
    await flush();
    const skippedBefore = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped).length;

    // WHEN - a player-state update carrying no messages for the panel arrives while the render is
    // still pending
    handle.rerender(
      <Wrapper
        currentTime={{ sec: 2, nsec: 0 }}
        initPanel={initPanel}
        pauseFrame={nonBlockingPauseFrame}
      />,
    );
    await flush();

    // THEN - no skipped frame is recorded
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderSkipped)).toHaveLength(
      skippedBefore,
    );
  });

  it("should not record telemetry from a stale done() called after the panel re-initialised", async () => {
    // GIVEN - a first panel instance whose render is still pending (done() captured, not called)
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    let staleDone: (() => void) | undefined;
    const initFirstPanel = (context: PanelExtensionContext) => {
      context.watch("currentTime");
      context.onRender = (_renderState: Immutable<RenderState>, done) => {
        staleDone ??= done;
      };
    };
    const handle = render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} initPanel={initFirstPanel} />);
    await flush();
    expect(staleDone).toBeDefined();

    // GIVEN - the adapter re-initialises with a new panel that completes its renders
    const onRender = jest.fn((_renderState: Immutable<RenderState>, done: () => void) => {
      done();
    });
    const initSecondPanel = (context: PanelExtensionContext) => {
      context.watch("currentTime");
      context.onRender = onRender;
    };
    handle.rerender(<Wrapper currentTime={{ sec: 1, nsec: 0 }} initPanel={initSecondPanel} />);
    await flush();
    expect(onRender).toHaveBeenCalled();
    // the first panel's pending render was not completed, so only the second panel's renders count
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderCount)).toHaveLength(
      onRender.mock.calls.length,
    );

    // WHEN - the first panel's done() arrives late
    act(() => {
      staleDone!();
    });
    await flush();

    // THEN - neither a render count nor a duration is recorded for it: every recorded render
    // belongs to the current panel instance (which may render again once the pipeline resumes)
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.renderCount)).toHaveLength(
      onRender.mock.calls.length,
    );
    expect(telemetry.observe.mock.calls).toHaveLength(onRender.mock.calls.length);
  });

  it("should not count the same frame again when a re-render is triggered by another input", async () => {
    // GIVEN - an enabled sink and a panel watching the frame and variables that always calls done()
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const frame = { "/x": [buildMessage(10), buildMessage(32)] };
    let panelContext: PanelExtensionContext | undefined;
    const onRender = jest.fn((_renderState: Immutable<RenderState>, done: () => void) => {
      done();
    });
    const initPanel = (context: PanelExtensionContext) => {
      panelContext = context;
      context.watch("currentFrame");
      context.watch("variables");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = onRender;
    };
    render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} frame={frame} initPanel={initPanel} />);
    await flush();
    const deliveredBefore = counterCalls(telemetry, PANEL_TELEMETRY_METRICS.messagesDelivered);
    const rendersBefore = onRender.mock.calls.length;

    // WHEN - a variable change triggers another render without a new frame
    act(() => {
      panelContext!.setVariable("foo", 1);
    });
    await flush();

    // THEN - the panel rendered again but the delivered messages were counted only once
    expect(deliveredBefore).toHaveLength(1);
    expect(onRender.mock.calls.length).toBeGreaterThan(rendersBefore);
    expect(counterCalls(telemetry, PANEL_TELEMETRY_METRICS.messagesDelivered)).toHaveLength(1);
  });

  it("should keep skipping frames but record nothing when telemetry is disabled", async () => {
    // GIVEN - a disabled sink and a panel that never calls done()
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
    setTelemetrySink(telemetry);
    let panelContext: PanelExtensionContext | undefined;
    const onRender = jest.fn();
    const initPanel = (context: PanelExtensionContext) => {
      panelContext = context;
      context.watch("currentTime");
      context.watch("variables");
      context.onRender = onRender;
    };
    render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} initPanel={initPanel} />);
    await flush();

    // WHEN - a new render input arrives while the first render is still pending
    act(() => {
      panelContext!.setVariable("foo", 1);
    });
    await flush();

    // THEN - the frame is skipped exactly as with telemetry enabled, and nothing is recorded
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
    expect(telemetry.gauge.mock.calls).toHaveLength(0);
    expect(telemetry.observe.mock.calls).toHaveLength(0);
    expect(telemetry.event.mock.calls).toHaveLength(0);
  });

  it("makes no telemetry calls when telemetry is disabled", async () => {
    // GIVEN - a disabled sink and a panel receiving messages
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
    setTelemetrySink(telemetry);
    const frame = { "/x": [buildMessage(10)] };
    const onRender = jest.fn((_renderState: Immutable<RenderState>, done: () => void) => {
      done();
    });
    const initPanel = (context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.watch("currentTime");
      context.subscribe([{ topic: "/x" }]);
      context.onRender = onRender;
    };

    // WHEN - the panel renders several frames
    const handle = render(
      <Wrapper currentTime={{ sec: 1, nsec: 0 }} frame={frame} initPanel={initPanel} />,
    );
    await flush();
    handle.rerender(
      <Wrapper currentTime={{ sec: 2, nsec: 0 }} frame={frame} initPanel={initPanel} />,
    );
    await flush();

    // THEN - the panel rendered but nothing was recorded
    expect(onRender).toHaveBeenCalled();
    expect(telemetry.isEnabled.mock.calls.length).toBeGreaterThan(0);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
    expect(telemetry.gauge.mock.calls).toHaveLength(0);
    expect(telemetry.observe.mock.calls).toHaveLength(0);
    expect(telemetry.event.mock.calls).toHaveLength(0);
  });
});

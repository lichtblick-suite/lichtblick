/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { ReactNode } from "react";

import { Immutable, MessageEvent } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { PANEL_TELEMETRY_METRICS } from "./panelTelemetry";
import { useSubscribeMessageRange } from "./useSubscribeMessageRange";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("./messageRangeIterator", () => ({
  createMessageRangeIterator: jest.fn(),
}));

const mockUseMessagePipelineGetter = useMessagePipelineGetter as jest.Mock;
const mockUseExtensionCatalog = useExtensionCatalog as jest.Mock;
const mockCreateMessageRangeIterator = createMessageRangeIterator as jest.Mock;

const LAYOUT_PANEL_ID = "StateTransitions!2ab7";
const PANEL_TYPE = "StateTransitions";
const EXPECTED_LABELS = { panelId: LAYOUT_PANEL_ID, panelType: PANEL_TYPE };

type RangeIterable = AsyncIterable<Immutable<MessageEvent[]>>;

function buildMessage(sizeInBytes: number): MessageEvent {
  return {
    topic: "/topic",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes,
    message: {},
    schemaName: "foo",
  };
}

/** Source iterable that records whether it was closed (finally block ran). */
function createSourceIterable(batches: MessageEvent[][]): {
  iterable: RangeIterable;
  wasClosed: () => boolean;
} {
  let closed = false;
  return {
    iterable: {
      async *[Symbol.asyncIterator]() {
        try {
          for (const batch of batches) {
            yield batch;
          }
        } finally {
          closed = true;
        }
      },
    },
    wasClosed: () => closed,
  };
}

function PanelWrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <MockPanelContextProvider id={LAYOUT_PANEL_ID} type={PANEL_TYPE} title="Visible title">
      {children}
    </MockPanelContextProvider>
  );
}

function setupPipeline(source: RangeIterable, cancel: () => void = jest.fn()): void {
  mockCreateMessageRangeIterator.mockReturnValue({ iterable: source, cancel });
  mockUseMessagePipelineGetter.mockReturnValue(
    jest.fn().mockReturnValue({
      sortedTopics: [],
      getBatchIterator: jest.fn().mockReturnValue({ [Symbol.asyncIterator]: jest.fn() }),
    }),
  );
}

describe("useSubscribeMessageRange telemetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseExtensionCatalog.mockReturnValue([]);
  });

  afterEach(() => {
    setTelemetrySink(undefined);
  });

  it("counts messages and bytes per yielded batch with the layout panel id", async () => {
    // GIVEN - an enabled sink, a panel context and a source yielding three batches
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const batches = [[buildMessage(10), buildMessage(5)], [], [buildMessage(0)]];
    const source = createSourceIterable(batches);
    setupPipeline(source.iterable);
    const received: Immutable<MessageEvent[]>[] = [];
    let handedIterable: RangeIterable | undefined;
    const onNewRangeIterator = jest.fn(async (iterable: RangeIterable) => {
      handedIterable = iterable;
      for await (const batch of iterable) {
        received.push(batch);
      }
    });
    const { result } = renderHook(() => useSubscribeMessageRange(), { wrapper: PanelWrapper });

    // WHEN - the panel subscribes and consumes the whole range
    await act(async () => {
      result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
      await onNewRangeIterator.mock.results[0]!.value;
    });

    // THEN - batches are forwarded unchanged through a wrapper
    expect(handedIterable).not.toBe(source.iterable);
    expect(received).toHaveLength(3);
    for (let i = 0; i < batches.length; i++) {
      expect(received[i]).toBe(batches[i]);
    }

    // THEN - one counter call per non-empty batch, bytes skipped when zero
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 2, "count", "panel", EXPECTED_LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes, 15, "bytes", "panel", EXPECTED_LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 1, "count", "panel", EXPECTED_LABELS],
    ]);
    expect(telemetry.gauge.mock.calls).toHaveLength(0);
    expect(telemetry.observe.mock.calls).toHaveLength(0);
    expect(telemetry.event.mock.calls).toHaveLength(0);
  });

  it("propagates early termination by the consumer to the source iterator", async () => {
    // GIVEN - an enabled sink and a consumer that stops after the first batch
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const source = createSourceIterable([[buildMessage(1)], [buildMessage(2)]]);
    setupPipeline(source.iterable);
    const received: Immutable<MessageEvent[]>[] = [];
    const onNewRangeIterator = jest.fn(async (iterable: RangeIterable) => {
      for await (const batch of iterable) {
        received.push(batch);
        break;
      }
    });
    const { result } = renderHook(() => useSubscribeMessageRange(), { wrapper: PanelWrapper });

    // WHEN
    await act(async () => {
      result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
      await onNewRangeIterator.mock.results[0]!.value;
    });

    // THEN - the source was closed and only the first batch was counted
    expect(received).toHaveLength(1);
    expect(source.wasClosed()).toBe(true);
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 1, "count", "panel", EXPECTED_LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes, 1, "bytes", "panel", EXPECTED_LABELS],
    ]);
  });

  it("passes the original iterable and cancel through by identity when telemetry is disabled", () => {
    // GIVEN - a disabled sink inside a panel context
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
    setTelemetrySink(telemetry);
    const source = createSourceIterable([[buildMessage(10)]]);
    const mockCancel = jest.fn();
    setupPipeline(source.iterable, mockCancel);
    const onNewRangeIterator = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubscribeMessageRange(), { wrapper: PanelWrapper });
    let cancel!: () => void;

    // WHEN
    act(() => {
      cancel = result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
    });

    // THEN
    expect(onNewRangeIterator).toHaveBeenCalledWith(source.iterable);
    expect(cancel).toBe(mockCancel);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });

  it("emits no metrics and does not throw outside a panel context", async () => {
    // GIVEN - an enabled sink but no PanelContext provider
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const source = createSourceIterable([[buildMessage(10)]]);
    setupPipeline(source.iterable);
    const received: Immutable<MessageEvent[]>[] = [];
    const onNewRangeIterator = jest.fn(async (iterable: RangeIterable) => {
      for await (const batch of iterable) {
        received.push(batch);
      }
    });

    // WHEN
    const { result } = renderHook(() => useSubscribeMessageRange());
    await act(async () => {
      result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
      await onNewRangeIterator.mock.results[0]!.value;
    });

    // THEN - the original iterable is passed through and nothing is recorded
    expect(onNewRangeIterator).toHaveBeenCalledWith(source.iterable);
    expect(received).toHaveLength(1);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });
});

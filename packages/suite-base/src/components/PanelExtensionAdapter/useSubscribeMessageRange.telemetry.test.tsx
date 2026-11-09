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

import { PANEL_TELEMETRY_METRICS } from "./constants";
import { createMessageRangeIterator } from "./messageRangeIterator";
import { CreateMessageRangeIteratorParams } from "./types";
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

type OnBatch = CreateMessageRangeIteratorParams["onBatch"];

/**
 * Stand-in for the iterable built by createMessageRangeIterator: calls `onBatch` right before
 * each yield (like the real iterator) and records whether it was closed (finally block ran).
 */
function createSourceIterable(
  batches: MessageEvent[][],
  onBatch?: OnBatch,
): {
  iterable: RangeIterable;
  wasClosed: () => boolean;
} {
  let closed = false;
  return {
    iterable: {
      async *[Symbol.asyncIterator]() {
        try {
          for (const batch of batches) {
            onBatch?.(batch);
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

/** Makes createMessageRangeIterator return an iterable over `batches` wired to the given onBatch. */
function setupPipeline(
  batches: MessageEvent[][],
  cancel: () => void = jest.fn(),
): { getSource: () => ReturnType<typeof createSourceIterable> } {
  let source: ReturnType<typeof createSourceIterable> | undefined;
  mockCreateMessageRangeIterator.mockImplementation((params: CreateMessageRangeIteratorParams) => {
    source = createSourceIterable(batches, params.onBatch);
    return { iterable: source.iterable, cancel };
  });
  mockUseMessagePipelineGetter.mockReturnValue(
    jest.fn().mockReturnValue({
      sortedTopics: [],
      getBatchIterator: jest.fn().mockReturnValue({ [Symbol.asyncIterator]: jest.fn() }),
    }),
  );
  return {
    getSource: () => {
      if (source == undefined) {
        throw new Error("createMessageRangeIterator was not called");
      }
      return source;
    },
  };
}

function lastOnBatch(): OnBatch {
  const params = mockCreateMessageRangeIterator.mock.calls.at(-1)?.[0] as
    | CreateMessageRangeIteratorParams
    | undefined;
  return params?.onBatch;
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
    const pipeline = setupPipeline(batches);
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

    // THEN - the iterator's own iterable is handed over (no wrapper) and batches are unchanged
    expect(lastOnBatch()).toEqual(expect.any(Function));
    expect(handedIterable).toBe(pipeline.getSource().iterable);
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

  it("counts only the batches the consumer pulled when it stops early", async () => {
    // GIVEN - an enabled sink and a consumer that stops after the first batch
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const pipeline = setupPipeline([[buildMessage(1)], [buildMessage(2)]]);
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
    expect(pipeline.getSource().wasClosed()).toBe(true);
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 1, "count", "panel", EXPECTED_LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes, 1, "bytes", "panel", EXPECTED_LABELS],
    ]);
  });

  it("installs no batch callback and passes iterable and cancel through when telemetry is disabled", () => {
    // GIVEN - a disabled sink inside a panel context
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
    setTelemetrySink(telemetry);
    const mockCancel = jest.fn();
    const pipeline = setupPipeline([[buildMessage(10)]], mockCancel);
    const onNewRangeIterator = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubscribeMessageRange(), { wrapper: PanelWrapper });
    let cancel!: () => void;

    // WHEN
    act(() => {
      cancel = result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
    });

    // THEN
    expect(lastOnBatch()).toBeUndefined();
    expect(onNewRangeIterator).toHaveBeenCalledWith(pipeline.getSource().iterable);
    expect(cancel).toBe(mockCancel);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });

  it("emits no metrics and does not throw outside a panel context", async () => {
    // GIVEN - an enabled sink but no PanelContext provider
    const telemetry = TelemetryBuilder.mockTelemetry();
    setTelemetrySink(telemetry);
    const pipeline = setupPipeline([[buildMessage(10)]]);
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

    // THEN - no batch callback is installed and nothing is recorded
    expect(lastOnBatch()).toBeUndefined();
    expect(onNewRangeIterator).toHaveBeenCalledWith(pipeline.getSource().iterable);
    expect(received).toHaveLength(1);
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });
});

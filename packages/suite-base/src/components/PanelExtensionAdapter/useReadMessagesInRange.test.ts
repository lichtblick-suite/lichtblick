/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Immutable, MessageEvent } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { BATCH_INTERVAL_MS } from "@lichtblick/suite-base/components/PanelExtensionAdapter/contants";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useReadMessagesInRange } from "./useReadMessagesInRange";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("./messageProcessing", () => ({
  convertMessage: jest.fn(),
  collateTopicSchemaConversions: jest.fn(),
}));

const mockUseMessagePipelineGetter = useMessagePipelineGetter as jest.Mock;
const mockUseExtensionCatalog = useExtensionCatalog as jest.Mock;

describe("useReadMessagesInRange", () => {
  const topic = `/${BasicBuilder.string()}`;
  let getBatchIterator: jest.Mock;
  let mockTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseExtensionCatalog.mockReturnValue([]);
    const { collateTopicSchemaConversions } = jest.requireMock("./messageProcessing");
    collateTopicSchemaConversions.mockReturnValue({
      topicSchemaConverters: new Map(),
      unconvertedSubscriptionTopics: new Set([topic]),
    });
    getBatchIterator = jest.fn();
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({ sortedTopics: [], getBatchIterator }),
    );
    // Advance past the batch interval on every call so each message is yielded as its own batch.
    mockTime = 0;
    jest.spyOn(performance, "now").mockImplementation(() => (mockTime += BATCH_INTERVAL_MS + 1));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildMessages(count: number): MessageEvent[] {
    return Array.from({ length: count }, () => MessageEventBuilder.messageEvent({ topic }));
  }

  function createSource(messages: MessageEvent[]): {
    iterator: AsyncIterableIterator<Readonly<IteratorResult>>;
    isClosed: () => boolean;
  } {
    let closed = false;
    async function* generate(): AsyncIterableIterator<Readonly<IteratorResult>> {
      try {
        for (const msgEvent of messages) {
          yield { type: "message-event", msgEvent };
        }
      } finally {
        closed = true;
      }
    }
    return { iterator: generate(), isClosed: () => closed };
  }

  async function collect(
    iterable: AsyncIterable<Immutable<MessageEvent[]>>,
  ): Promise<Immutable<MessageEvent>[]> {
    const result: Immutable<MessageEvent>[] = [];
    for await (const batch of iterable) {
      result.push(...batch);
    }
    return result;
  }

  function renderRead() {
    return renderHook(() => useReadMessagesInRange()).result.current;
  }

  it("does not read from the data source until the iterable is iterated", () => {
    // Given
    const read = renderRead();

    // When
    read(topic);

    // Then
    expect(getBatchIterator).not.toHaveBeenCalled();
  });

  it("reads the complete topic history when no bounds are given", async () => {
    // Given
    const messages = buildMessages(3);
    getBatchIterator.mockReturnValue(createSource(messages).iterator);
    const read = renderRead();

    // When
    const result = await collect(read(topic));

    // Then
    expect(getBatchIterator).toHaveBeenCalledWith(topic, undefined);
    expect(result).toEqual(messages);
  });

  it("forwards start and end bounds to the data source", async () => {
    // Given
    const start = RosTimeBuilder.time();
    const end = RosTimeBuilder.time();
    getBatchIterator.mockReturnValue(createSource([]).iterator);
    const read = renderRead();

    // When
    await collect(read(topic, { start, end }));

    // Then
    expect(getBatchIterator).toHaveBeenCalledWith(topic, { start, end });
  });

  it("forwards a single bound to the data source", async () => {
    // Given
    const start = RosTimeBuilder.time();
    getBatchIterator.mockReturnValue(createSource([]).iterator);
    const read = renderRead();

    // When
    await collect(read(topic, { start }));

    // Then
    expect(getBatchIterator).toHaveBeenCalledWith(topic, { start, end: undefined });
  });

  it("completes without yielding when the data source does not support range reads", async () => {
    // Given
    getBatchIterator.mockReturnValue(undefined);
    const read = renderRead();

    // When
    const result = await collect(read(topic));

    // Then
    expect(result).toEqual([]);
  });

  it("requests schema conversion when convertTo is given", async () => {
    // Given
    const convertTo = BasicBuilder.string();
    getBatchIterator.mockReturnValue(createSource([]).iterator);
    const { collateTopicSchemaConversions } = jest.requireMock("./messageProcessing");
    const read = renderRead();

    // When
    await collect(read(topic, { convertTo }));

    // Then
    expect(collateTopicSchemaConversions).toHaveBeenCalledWith(
      [{ topic, preload: true, convertTo }],
      [],
      [],
    );
  });

  it("does not read when the signal is already aborted", async () => {
    // Given
    const controller = new AbortController();
    controller.abort();
    const read = renderRead();

    // When
    const result = await collect(read(topic, { signal: controller.signal }));

    // Then
    expect(getBatchIterator).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("stops an in-flight read and closes the source when the signal is aborted", async () => {
    // Given
    const messages = buildMessages(3);
    const source = createSource(messages);
    getBatchIterator.mockReturnValue(source.iterator);
    const controller = new AbortController();
    const removeListenerSpy = jest.spyOn(controller.signal, "removeEventListener");
    const read = renderRead();
    const iterator = read(topic, { signal: controller.signal })[Symbol.asyncIterator]();

    // When
    const first = await iterator.next();
    controller.abort();
    const second = await iterator.next();

    // Then
    expect(first).toEqual({ done: false, value: [messages[0]] });
    expect(second.done).toBe(true);
    expect(source.isClosed()).toBe(true);
    expect(removeListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("closes the source when the consumer stops iterating early", async () => {
    // Given
    const source = createSource(buildMessages(3));
    getBatchIterator.mockReturnValue(source.iterator);
    const read = renderRead();

    // When
    const iterator = read(topic)[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();

    // Then
    expect(source.isClosed()).toBe(true);
  });

  it("starts an independent read each time the iterable is iterated", async () => {
    // Given
    const messages = buildMessages(2);
    getBatchIterator
      .mockReturnValueOnce(createSource(messages).iterator)
      .mockReturnValueOnce(createSource(messages).iterator);
    const read = renderRead();
    const iterable = read(topic);

    // When
    const first = await collect(iterable);
    const second = await collect(iterable);

    // Then
    expect(getBatchIterator).toHaveBeenCalledTimes(2);
    expect(first).toEqual(messages);
    expect(second).toEqual(messages);
  });
});

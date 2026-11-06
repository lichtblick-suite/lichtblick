/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, waitFor } from "@testing-library/react";

import { Immutable, MessageEvent, RegisterMessageConverterArgs } from "@lichtblick/suite";
import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import { mergeSubscriptions } from "@lichtblick/suite-base/components/MessagePipeline/subscriptions";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import ExtensionCatalogProvider from "@lichtblick/suite-base/providers/ExtensionCatalogProvider/ExtensionCatalogProvider";
import { channelCatalog } from "@lichtblick/suite-base/util/channels";

import { useChannelMessages } from "./useChannelMessages";

const topics = ["first", "second"].map((channelId) => ({
  name: "/shared",
  channelId,
  schemaName: "Input",
}));
const messages: MessageEvent[] = topics.map((topic, index) => ({
  topic: topic.name,
  channelId: topic.channelId,
  schemaName: "Input",
  message: { value: index },
  receiveTime: { sec: index, nsec: 0 },
  sizeInBytes: 1,
}));
const converters: RegisterMessageConverterArgs<unknown>[] = ["A", "B"].map((id) => ({
  id,
  fromSchemaName: "Input",
  toSchemaName: "Output",
  converter: (message) => ({ producer: id, message }),
}));
const outputId = channelCatalog(topics, converters).find(
  (channel) => channel.source.kind === "converted" && channel.source.inputChannelId === "second",
)!.id;

it("switches between same-topic native channels and virtual outputs without retaining the previous selection", async () => {
  const { result, rerender } = renderHook(
    ({ channelId }) => useChannelMessages("/shared", channelId),
    {
      initialProps: { channelId: "first" },
      wrapper: ({ children }) => (
        <MockCurrentLayoutProvider>
          <ExtensionCatalogProvider loaders={[]} mockMessageConverters={converters}>
            <MockMessagePipelineProvider topics={topics} messages={messages.slice()}>
              {children}
            </MockMessagePipelineProvider>
          </ExtensionCatalogProvider>
        </MockCurrentLayoutProvider>
      ),
    },
  );
  await waitFor(() => {
    expect(result.current[0]?.messageEvent.message).toEqual({ value: 0 });
  });
  rerender({ channelId: "second" });
  await waitFor(() => {
    expect(result.current[0]?.messageEvent.message).toEqual({ value: 1 });
  });
  rerender({ channelId: outputId });
  await waitFor(() => {
    expect(result.current[0]?.messageEvent.message).toEqual({
      producer: "A",
      message: { value: 1 },
    });
  });
  expect(result.current[0]?.messageEvent.channelId).toBe(outputId);
  rerender({ channelId: "missing" });
  expect(result.current).toEqual([]);
});

it("preserves 3D-authorized sampling while inspecting a native channel", async () => {
  const setSubscriptions = jest.fn<void, [string, Immutable<SubscribePayload[]>]>();
  renderHook(() => useChannelMessages("/shared.value", "first"), {
    wrapper: ({ children }) => (
      <MockCurrentLayoutProvider>
        <ExtensionCatalogProvider loaders={[]} mockMessageConverters={converters}>
          <MockMessagePipelineProvider topics={topics} setSubscriptions={setSubscriptions}>
            {children}
          </MockMessagePipelineProvider>
        </ExtensionCatalogProvider>
      </MockCurrentLayoutProvider>
    ),
  });
  await waitFor(() => {
    expect(setSubscriptions).toHaveBeenCalled();
  });
  const raw = setSubscriptions.mock.calls.flatMap(([, subscriptions]) => subscriptions);
  expect(raw).toContainEqual({
    topic: "/shared",
    channelIds: ["first"],
    fields: ["value"],
    preloadType: "partial",
    samplingRequest: { mode: "latest-per-render-tick" },
  });
  const scene = {
    topic: "/shared",
    channelIds: ["first"],
    preloadType: "partial" as const,
    samplingRequest: { mode: "latest-per-render-tick" as const },
    samplingAuthorized: true as const,
  };
  for (const subscriptions of [
    [...raw, scene],
    [scene, ...raw],
  ]) {
    expect(mergeSubscriptions(subscriptions)[0]).toMatchObject({
      samplingRequest: scene.samplingRequest,
      samplingAuthorized: true,
    });
  }
  expect(mergeSubscriptions(raw)[0]?.samplingRequest).toBeUndefined();
});

it("clears retained messages when the topic no longer has an explicit channel selection", async () => {
  const { result, rerender } = renderHook<ReturnType<typeof useChannelMessages>, { channelId?: string }>(
    ({ channelId }: { channelId?: string }) => useChannelMessages("/shared", channelId),
    {
      initialProps: { channelId: "first" },
      wrapper: ({ children }) => (
        <MockCurrentLayoutProvider>
          <ExtensionCatalogProvider loaders={[]} mockMessageConverters={converters}>
            <MockMessagePipelineProvider topics={topics} messages={messages}>
              {children}
            </MockMessagePipelineProvider>
          </ExtensionCatalogProvider>
        </MockCurrentLayoutProvider>
      ),
    },
  );
  await waitFor(() => {
    expect(result.current).toHaveLength(1);
  });
  rerender({ channelId: undefined });
  expect(result.current).toEqual([]);
});

it.each([false, true])(
  "respects a virtual channel converter's sampling capability (%s)",
  async (supportsLatestPerRenderTick) => {
    const setSubscriptions = jest.fn<void, [string, Immutable<SubscribePayload[]>]>();
    const installed = converters.map((converter) => ({
      ...converter,
      supportsLatestPerRenderTick,
    }));
    renderHook(() => useChannelMessages("/shared.producer", outputId), {
      wrapper: ({ children }) => (
        <MockCurrentLayoutProvider>
          <ExtensionCatalogProvider loaders={[]} mockMessageConverters={installed}>
            <MockMessagePipelineProvider topics={topics} setSubscriptions={setSubscriptions}>
              {children}
            </MockMessagePipelineProvider>
          </ExtensionCatalogProvider>
        </MockCurrentLayoutProvider>
      ),
    });
    await waitFor(() => {
      expect(setSubscriptions).toHaveBeenCalled();
    });
    const raw = setSubscriptions.mock.calls.flatMap(([, subscriptions]) => subscriptions);
    expect(raw).toContainEqual({
      topic: "/shared",
      channelIds: ["second"],
      fields: undefined,
      preloadType: "partial",
      ...(supportsLatestPerRenderTick
        ? { samplingRequest: { mode: "latest-per-render-tick" } }
        : {}),
    });
  },
);

it("queries only the latest native messages needed for history", async () => {
  const reads = Array.from({ length: 10 }, (_, value) => jest.fn(() => value));
  const batch = reads.map((getValue, index) => ({
    ...messages[0]!,
    message: {
      // eslint-disable-next-line no-restricted-syntax -- Observe which messages are actually queried.
      get value() {
        return getValue();
      },
    },
    receiveTime: { sec: index, nsec: 0 },
  }));
  const { result } = renderHook(() => useChannelMessages("/shared.value", "first", 2), {
    wrapper: ({ children }) => (
      <MockCurrentLayoutProvider>
        <ExtensionCatalogProvider loaders={[]} mockMessageConverters={converters}>
          <MockMessagePipelineProvider topics={topics} messages={batch}>
            {children}
          </MockMessagePipelineProvider>
        </ExtensionCatalogProvider>
      </MockCurrentLayoutProvider>
    ),
  });
  await waitFor(() => {
    expect(result.current.map((entry) => entry.queriedData[0]?.value)).toEqual([8, 9]);
  });
  for (const read of reads.slice(0, 8)) {
    expect(read).not.toHaveBeenCalled();
  }
});

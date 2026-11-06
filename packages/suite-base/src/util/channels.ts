// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Channel, Immutable, MessageEvent, Subscription } from "@lichtblick/suite";
import { Topic } from "@lichtblick/suite-base/players/types";
import { InstalledMessageConverter } from "@lichtblick/suite-base/types/messageConverters";
import { getConverterId } from "@lichtblick/suite-base/util/topicOutput";

/** Legacy sources expose one logical channel per topic and schema. */
export function nativeChannelId(topic: string, schemaName: string | undefined): string {
  return JSON.stringify(["native", topic, schemaName ?? ""])!;
}

export function messageChannelId(
  event: Pick<MessageEvent, "topic" | "schemaName" | "channelId">,
): string {
  return event.channelId ?? nativeChannelId(event.topic, event.schemaName);
}

export function convertedChannelId(inputChannelId: string, converterId: string): string {
  return JSON.stringify(["converted", inputChannelId, converterId])!;
}

export function channelCatalog(
  topics: readonly Topic[],
  converters: readonly InstalledMessageConverter[] = [],
): Channel[] {
  const channels = new Map<string, Channel>();
  for (const topic of topics) {
    const id = topic.channelId ?? nativeChannelId(topic.name, topic.schemaName);
    channels.set(JSON.stringify([topic.name, id])!, {
      id,
      topic: topic.name,
      schemaName: topic.schemaName ?? "",
      source: { kind: "native" },
    });
    for (const converter of converters) {
      if (converter.fromSchemaName !== topic.schemaName) {
        continue;
      }
      const converterId = getConverterId(converter);
      const outputId = convertedChannelId(id, converterId);
      channels.set(JSON.stringify([topic.name, outputId])!, {
        id: outputId,
        topic: topic.name,
        schemaName: converter.toSchemaName,
        source: { kind: "converted", inputChannelId: id, converterId },
      });
    }
  }
  return [...channels.values()];
}

/** Resolve virtual selections to native input subscriptions. Unknown IDs never fall back. */
export function resolveChannelSubscription(
  subscription: Immutable<Subscription>,
  channels: readonly Channel[],
): Subscription | undefined {
  if (subscription.channelId == undefined) {
    return subscription;
  }
  const channel = channels.find(
    (entry) => entry.id === subscription.channelId && entry.topic === subscription.topic,
  );
  if (channel == undefined) {
    return undefined;
  }
  return channel.source.kind === "native"
    ? { ...subscription, convertTo: undefined, converterId: undefined }
    : {
        ...subscription,
        channelId: channel.source.inputChannelId,
        convertTo: channel.schemaName,
        converterId: channel.source.converterId,
      };
}

export function matchesChannel(
  event: Pick<MessageEvent, "topic" | "schemaName" | "channelId">,
  subscription: { topic: string; channelIds?: readonly string[] },
): boolean {
  return (
    event.topic === subscription.topic &&
    (subscription.channelIds == undefined ||
      subscription.channelIds.includes(messageChannelId(event)))
  );
}

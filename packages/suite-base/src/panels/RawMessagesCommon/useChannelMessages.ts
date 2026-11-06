// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useMemo } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";
import { useDataSourceInfo, useMessageReducer } from "@lichtblick/suite-base/PanelAPI";
import {
  MessageAndData,
  useCachedGetMessagePathDataItems,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  collateTopicSchemaConversions,
  convertMessage,
  wantsOriginalMessage,
} from "@lichtblick/suite-base/components/PanelExtensionAdapter/messageProcessing";
import {
  selectInstalledMessageConverters,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { useChannels } from "@lichtblick/suite-base/hooks/useChannels";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { subscribePayloadFromMessagePath } from "@lichtblick/suite-base/players/subscribePayloadFromMessagePath";
import { SubscribePayload } from "@lichtblick/suite-base/players/types";
import { resolveChannelSubscription } from "@lichtblick/suite-base/util/channels";

type History = {
  selection: string;
  matches: MessageAndData[];
  events: readonly MessageEvent[];
};

const LATEST_PER_RENDER_TICK_SAMPLING = Object.freeze({
  mode: "latest-per-render-tick" as const,
});

/** Read the selected producer, including converter outputs, without merging same-topic streams. */
export function useChannelMessages(
  path: string,
  channelId: string | undefined,
  historySize = 1,
): MessageAndData[] {
  const { topics } = useDataSourceInfo();
  const channels = useChannels();
  const converters = useExtensionCatalog(selectInstalledMessageConverters);
  const { globalVariables } = useGlobalVariables();
  const topicName = useMemo(() => parseMessagePath(path)?.topicName, [path]);
  const channel = channels.find((entry) => entry.topic === topicName && entry.id === channelId);
  const resolved = useMemo(
    () =>
      topicName == undefined ||
      (channelId == undefined && channels.filter((entry) => entry.topic === topicName).length > 1)
        ? undefined
        : resolveChannelSubscription({ topic: topicName, channelId }, channels),
    [topicName, channelId, channels],
  );
  const conversions = useMemo(
    () =>
      collateTopicSchemaConversions(
        topicName == undefined ? [] : [{ topic: topicName, channelId }],
        topics,
        converters,
      ),
    [topicName, channelId, topics, converters],
  );
  const subscriptions = useMemo<SubscribePayload[]>(() => {
    if (resolved == undefined) {
      return [];
    }
    const needsConversion = conversions.topicSchemaConverters.size > 0;
    const allowsSampling =
      !needsConversion ||
      [...conversions.topicSchemaConverters.values()].every((entries) =>
        entries.every((converter) => converter.supportsLatestPerRenderTick === true),
      );
    // Native inspection consents to sampling, as before channel selection was introduced.
    // Authorization still comes from a capable visualization converter at pipeline merge time.
    const payload = subscribePayloadFromMessagePath(
      path,
      "partial",
      allowsSampling ? LATEST_PER_RENDER_TICK_SAMPLING : undefined,
    );
    if (payload == undefined) {
      return [];
    }
    return [
      {
        ...payload,
        topic: resolved.topic,
        // Output fields cannot be used to project a converter's native input.
        fields: needsConversion ? undefined : payload.fields,
        channelIds: resolved.channelId == undefined ? undefined : [resolved.channelId],
      },
    ];
  }, [resolved, conversions, path]);
  const schemaOverride = useMemo(
    () =>
      channel == undefined
        ? undefined
        : { topicName: channel.topic, schemaName: channel.schemaName },
    [channel],
  );
  const getData = useCachedGetMessagePathDataItems([path], schemaOverride);
  const selection = JSON.stringify([path, channelId])!;
  const outputConfigCache = useMemo(() => new Map<string, Record<string, unknown>>(), []);
  const queryEvents = useCallback(
    (events: readonly MessageEvent[]): MessageAndData[] => {
      if (resolved == undefined) {
        return [];
      }
      let delivered = events;
      if (conversions.topicSchemaConverters.size > 0) {
        const converted: MessageEvent[] = [];
        // Stateful converters must still receive inputs in chronological order.
        for (const event of events) {
          convertMessage(event, conversions.topicSchemaConverters, converted, globalVariables, {
            config: {},
            outputConfigCache,
          });
        }
        delivered = converted;
      }
      const matches: MessageAndData[] = [];
      // Query only enough matching messages to fill the inspector's retained history.
      for (let i = delivered.length - 1; i >= 0 && matches.length < historySize; --i) {
        const messageEvent = delivered[i]!;
        if (
          conversions.topicSchemaConverters.size === 0 &&
          !wantsOriginalMessage(messageEvent, conversions.originalSubscriptions)
        ) {
          continue;
        }
        const queriedData = getData(path, messageEvent);
        if (queriedData != undefined && queriedData.length > 0) {
          matches.push({ messageEvent, queriedData });
        }
      }
      return matches.reverse();
    },
    [conversions, getData, path, globalVariables, outputConfigCache, historySize, resolved],
  );
  const restore = useCallback(
    (previous?: History): History => {
      const events = previous?.events ?? [];
      return {
        selection,
        events,
        matches: queryEvents(events).slice(-historySize),
      };
    },
    [selection, queryEvents, historySize],
  );
  const addMessages = useCallback(
    (previous: History, events: readonly MessageEvent[]): History => {
      const matches = queryEvents(events);
      return {
        selection,
        events: [...previous.events, ...events].slice(-historySize),
        matches:
          matches.length === 0
            ? previous.matches
            : [...previous.matches, ...matches].slice(-historySize),
      };
    },
    [queryEvents, historySize, selection],
  );
  return useMessageReducer({ topics: subscriptions, restore, addMessages }).matches;
}

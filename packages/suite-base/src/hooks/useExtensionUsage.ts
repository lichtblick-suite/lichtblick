// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";
import { getLeaves } from "react-mosaic-component";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

/**
 * Hook to detect which panel extensions are currently in use in the layout
 * @returns Set of panel type identifiers that are currently active
 */
export function usePanelExtensionsInUse(): Set<string> {
  const { getCurrentLayoutState } = useCurrentLayoutActions();

  return useMemo(() => {
    const layoutState = getCurrentLayoutState();
    const layout = layoutState.selectedLayout?.data?.layout;

    if (layout == undefined) {
      return new Set<string>();
    }

    // Get all panel IDs from the mosaic layout tree
    const panelIds = getLeaves(layout);

    // Extract panel types from panel IDs
    const panelTypes = panelIds.map((id) => getPanelTypeFromId(id));

    return new Set(panelTypes);
  }, [getCurrentLayoutState]);
}

/**
 * Hook to detect which message converter extensions are currently in use
 * @returns Set of converter identifiers (fromSchemaName:toSchemaName) that are currently active
 */
export function useMessageConverterExtensionsInUse(): Set<string> {
  const installedConverters = useExtensionCatalog((state) => state.installedMessageConverters);
  const subscriptions = useMessagePipeline((ctx) => ctx.subscriptions);
  const topics = useMessagePipeline((ctx) => ctx.sortedTopics);

  return useMemo(() => {
    const activeConverters = new Set<string>();

    if (!installedConverters) {
      return activeConverters;
    }

    const topicSchemaMap = new Map<string, string>();
    for (const topic of topics) {
      if (topic.schemaName) {
        topicSchemaMap.set(topic.name, topic.schemaName);
      }
    }

    // Check each subscription to see if it uses a converter
    for (const subscription of subscriptions) {
      if (subscription.topic) {
        // Get the schema name of the subscribed topic
        const fromSchemaName = topicSchemaMap.get(subscription.topic);

        if (fromSchemaName) {
          // Find matching converter based on schema conversion
          for (const converter of installedConverters) {
            // Check if this converter can convert from the topic's schema to the requested schema
            if (converter.fromSchemaName === fromSchemaName) {
              // Create a unique identifier for the converter
              if (converter.extensionId) {
                activeConverters.add(converter.extensionId);
              }
            }
          }
        }
      }
    }

    return activeConverters;
  }, [installedConverters, subscriptions, topics]);
}

/**
 * Combined hook that returns both panel and message converter extensions in use
 * @returns Object containing sets of active panel types and converter identifiers
 */
export function useExtensionUsage(): {
  // panelExtensionsInUse: Set<string>;
  messageConverterExtensionsInUse: Set<string>;
} {
  // const panelExtensionsInUse = usePanelExtensionsInUse();
  const messageConverterExtensionsInUse = useMessageConverterExtensionsInUse();

  return useMemo(
    () => ({
      // panelExtensionsInUse,
      messageConverterExtensionsInUse,
    }),
    [messageConverterExtensionsInUse],
  );
}

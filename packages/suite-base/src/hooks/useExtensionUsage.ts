// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";
import { getLeaves, MosaicNode } from "react-mosaic-component";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { TabPanelConfig } from "@lichtblick/suite-base/types/layouts";
import { TAB_PANEL_TYPE } from "@lichtblick/suite-base/util/constants";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

/**
 * Recursively extracts all panel IDs from a layout, including panels nested in Tab panels
 */
function getAllPanelIds(
  layout: MosaicNode<string> | undefined,
  configById: Record<string, unknown>,
): string[] {
  if (layout == undefined) {
    return [];
  }

  const panelIds = getLeaves(layout);
  const allIds: string[] = [...panelIds];

  // Check each panel to see if it's a Tab panel with nested panels
  for (const panelId of panelIds) {
    const panelType = getPanelTypeFromId(panelId);
    if (panelType === TAB_PANEL_TYPE) {
      const tabConfig = configById[panelId] as TabPanelConfig | undefined;
      if (tabConfig?.tabs) {
        for (const tab of tabConfig.tabs) {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (tab.layout) {
            const nestedIds = getAllPanelIds(tab.layout, configById);
            allIds.push(...nestedIds);
          }
        }
      }
    }
  }

  return allIds;
}

/**
 * Hook to detect which panel extensions are currently in use in the layout
 * @returns Set of panel type identifiers that are currently active
 */
export function usePanelExtensionsInUse(): Set<string> {
  const { getCurrentLayoutState } = useCurrentLayoutActions();
  const installedPanels = useExtensionCatalog((state) => state.installedPanels);

  return useMemo(() => {
    const layoutState = getCurrentLayoutState();
    const layout = layoutState.selectedLayout?.data?.layout;
    const configById = layoutState.selectedLayout?.data?.configById ?? {};

    if (layout == undefined || installedPanels == undefined) {
      return new Set<string>();
    }

    // Get all panel IDs including those nested in Tab panels
    const allPanelIds = getAllPanelIds(layout, configById);
    const panelTypes = allPanelIds.map((id) => getPanelTypeFromId(id));

    const extensionsInUse = new Set<string>();
    for (const panelType of panelTypes) {
      const registeredPanel = installedPanels[panelType];
      if (registeredPanel?.extensionId) {
        extensionsInUse.add(registeredPanel.extensionId);
      }
    }

    return extensionsInUse;
  }, [getCurrentLayoutState, installedPanels]);
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
 * Hook to detect which camera state extensions are currently in use
 * @returns Set of camera model extension identifiers that are currently active
 * WIP
 */
export function useCameraModelsExtensionsInUse(): Set<string> {
  const cameraModels = useExtensionCatalog((state) => state.installedCameraModels);

  return useMemo(() => {
    const extensionsInUse = new Set<string>();

    if (cameraModels.size === 0) {
      return extensionsInUse;
    }

    return extensionsInUse;
  }, [cameraModels]);
}

// Due to how useTopicAliasFunctionsInUse is currently implemented there's no way to detect which topic alias function extensions are in use,
// so this is currently not implemented.
// Once we have a way to determine which topic alias functions are active, we can implement this hook similarly to the others
// and include it in the combined useExtensionUsage hook.
// export function useTopicAliasFunctionsInUse(): Set<string>

/**
 * Combined hook that returns all extensions in use
 * @returns Set of active extension identifiers
 */
export function useExtensionUsage(): Set<string> {
  const panelExtensionsInUse = usePanelExtensionsInUse();
  const messageConverterExtensionsInUse = useMessageConverterExtensionsInUse();
  const cameraModelExtensionsInUse = useCameraModelsExtensionsInUse();

  return useMemo(() => {
    return new Set([
      ...panelExtensionsInUse,
      ...messageConverterExtensionsInUse,
      ...cameraModelExtensionsInUse,
    ]);
  }, [panelExtensionsInUse, messageConverterExtensionsInUse, cameraModelExtensionsInUse]);
}

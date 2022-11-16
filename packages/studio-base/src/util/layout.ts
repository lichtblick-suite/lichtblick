// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { captureException } from "@sentry/core";
import { compact, flatMap, xor, uniq } from "lodash";
import {
  createRemoveUpdate,
  getLeaves,
  getNodeAtPath,
  updateTree,
  MosaicUpdate,
  isParent,
  MosaicNode,
  MosaicPath,
} from "react-mosaic-component";
import { MosaicDirection, MosaicKey } from "react-mosaic-component/lib/types";

import { filterMap } from "@foxglove/den/collection";
import Logger from "@foxglove/log";
import {
  ConfigsPayload,
  SaveConfigsPayload,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { TabConfig, TabLocation, TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import {
  PanelConfig,
  MosaicDropTargetPosition,
  SavedProps,
} from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";

const log = Logger.getLogger(__filename);

// given a panel type, create a unique id for a panel
// with the type embedded within the id
// we need this because react-mosaic
export function getPanelIdForType(type: string): string {
  const factor = 1e10;
  const rnd = Math.round(Math.random() * factor).toString(36);
  // a panel id consists of its type, an exclamation mark for splitting, and a random val
  // because each panel id functions is the react 'key' for the react-mosaic-component layout
  // but also must encode the panel type for panel factory construction
  return `${type}!${rnd}`;
}

export function getPanelTypeFromId(id: string): string {
  return id.split("!")[0] ?? "";
}

export function isTabPanel(panelId: string): boolean {
  return getPanelTypeFromId(panelId) === TAB_PANEL_TYPE;
}

export function isTabPanelConfig(config: PanelConfig | undefined): config is TabPanelConfig {
  return config != undefined && "tabs" in config && "activeTabIdx" in config;
}

// Traverses `tree` to find the path to the specified `node`
export function getPathFromNode<T extends MosaicKey>(
  node: T | undefined,
  tree: MosaicNode<T> | null, // eslint-disable-line no-restricted-syntax
  path: MosaicPath = [],
): MosaicPath {
  if (tree === node) {
    return path;
  }
  if (tree != undefined && isParent(tree)) {
    const first = getPathFromNode(node, tree.first, [...path, "first"]);
    if (first.length > 0) {
      return first;
    }
    const second = getPathFromNode(node, tree.second, [...path, "second"]);
    if (second.length > 0) {
      return second;
    }
  }
  return [];
}

type PanelIdMap = {
  [panelId: string]: string;
};
function mapTemplateIdsToNewIds(templateIds: string[]): PanelIdMap {
  const result: PanelIdMap = {};
  for (const id of templateIds) {
    result[id] = getPanelIdForType(getPanelTypeFromId(id));
  }
  return result;
}

type IndexableMosaic = MosaicNode<string> & Record<string, unknown>;

function getLayoutWithNewPanelIds(
  layout: undefined | IndexableMosaic,
  panelIdMap: PanelIdMap,
): MosaicNode<string> | undefined {
  if (typeof layout === "string") {
    // return corresponding ID if it exists in panelIdMap
    // (e.g. for Tab panel presets with 1 panel in active layout)
    return panelIdMap[layout] ?? getPanelIdForType(getPanelTypeFromId(layout));
  }

  if (layout == undefined) {
    return undefined;
  }
  const newLayout: Record<string, unknown> = {};
  for (const key in layout) {
    if (typeof layout[key] === "object" && !Array.isArray(layout[key])) {
      newLayout[key] = getLayoutWithNewPanelIds(layout[key] as IndexableMosaic, panelIdMap);
    } else if (typeof layout[key] === "string" && panelIdMap[layout[key] as string] != undefined) {
      newLayout[key] = panelIdMap[layout[key] as string];
    } else {
      newLayout[key] = layout[key];
    }
  }
  return newLayout as unknown as MosaicNode<string>;
}

// Recursively removes all empty nodes from a layout
function compactLayout(layout: MosaicNode<string>): MosaicNode<string> {
  if (typeof layout === "string") {
    return layout;
  }

  const prunedChildren = [layout.first, layout.second].filter(Boolean).map(compactLayout);
  const [first, second] = prunedChildren;
  if (first == undefined && second == undefined) {
    return "";
  } else if (first != undefined && second != undefined) {
    return {
      ...layout,
      first,
      second,
    };
  }

  return {
    ...layout,
    first: first ?? second ?? "",
    second: "",
  };
}

// Recursively replaces all leaves of the current layout
function replaceLeafLayouts(
  layout: MosaicNode<string>,
  replacerFn: (layout: MosaicNode<string>) => MosaicNode<string>,
): MosaicNode<string> {
  if (typeof layout === "string") {
    return replacerFn(layout);
  }
  return {
    ...layout,
    first: replaceLeafLayouts(layout.first, replacerFn),
    second: replaceLeafLayouts(layout.second, replacerFn),
  };
}

// Replaces Tab panels with their active tab's layout
export function inlineTabPanelLayouts(
  layout: MosaicNode<string>,
  savedProps: SavedProps,
  preserveTabPanelIds: readonly string[],
): MosaicNode<string> {
  const tabFreeLayout = replaceLeafLayouts(layout, (id) => {
    if (typeof id === "string" && isTabPanel(id) && !preserveTabPanelIds.includes(id)) {
      const panelProps = getValidTabPanelConfig(id, savedProps);
      const tabLayout = panelProps.tabs[panelProps.activeTabIdx]?.layout;
      if (tabLayout != undefined) {
        return inlineTabPanelLayouts(tabLayout, savedProps, preserveTabPanelIds);
      }
    }
    return id;
  });
  return compactLayout(tabFreeLayout);
}

// Maps panels to their parent Tab panel
export const getParentTabPanelByPanelId = (
  savedProps: SavedProps,
): {
  [key: string]: string;
} =>
  Object.entries(savedProps).reduce(
    (
      memo: Record<string, string>,
      [savedPanelId, savedConfig]: [string, undefined | PanelConfig],
    ) => {
      if (isTabPanel(savedPanelId) && savedConfig != undefined) {
        const tabPanelConfig = savedConfig as Partial<TabPanelConfig>;
        tabPanelConfig.tabs?.forEach((tab) => {
          const panelIdsInTab = getLeaves(tab.layout ?? ReactNull);
          panelIdsInTab.forEach((id) => (memo[id] = savedPanelId));
        });
      }
      return memo;
    },
    {},
  );

const replaceMaybeTabLayoutWithNewPanelIds = (panelIdMap: PanelIdMap) => {
  return ({ id, config }: { id: string; config: Partial<TabPanelConfig> }) => {
    return config.tabs
      ? {
          id,
          config: {
            ...config,
            tabs: config.tabs.map((tab: TabConfig) => ({
              ...tab,
              layout: getLayoutWithNewPanelIds(tab.layout as IndexableMosaic, panelIdMap),
            })),
          },
        }
      : { id, config };
  };
};

export const getSaveConfigsPayloadForAddedPanel = ({
  id,
  config,
  relatedConfigs,
}: {
  id: string;
  config: PanelConfig;
  relatedConfigs?: SavedProps;
}): SaveConfigsPayload => {
  if (!relatedConfigs) {
    return { configs: [{ id, config }] };
  }
  const templateIds = getPanelIdsInsideTabPanels([id], { [id]: config });
  const panelIdMap = mapTemplateIdsToNewIds(templateIds);
  const newConfigs = filterMap(templateIds, (templateId) => {
    const panelId = panelIdMap[templateId];
    const relatedConfig = relatedConfigs[templateId];
    if (panelId == undefined || relatedConfig == undefined) {
      return;
    }

    return {
      id: panelId,
      config: relatedConfig,
    };
  });
  const allConfigs = [...newConfigs, { id, config }].map(
    replaceMaybeTabLayoutWithNewPanelIds(panelIdMap),
  );
  return { configs: allConfigs };
};

export function getPanelIdsInsideTabPanels(panelIds: string[], savedProps: SavedProps): string[] {
  const tabPanelIds = panelIds.filter(isTabPanel);
  const tabLayouts: MosaicNode<string>[] = [];
  tabPanelIds.forEach((panelId) => {
    const tabProps = savedProps[panelId] as Partial<TabPanelConfig> | undefined;
    if (tabProps?.tabs) {
      tabProps.tabs.forEach((tab: TabConfig) => {
        tabLayouts.push(
          tab.layout as MosaicNode<string>,
          ...getPanelIdsInsideTabPanels(getLeaves(tab.layout ?? ReactNull), savedProps),
        );
      });
    }
  });
  return flatMap(tabLayouts, getLeaves);
}

export const DEFAULT_TAB_PANEL_CONFIG: TabPanelConfig = {
  activeTabIdx: 0,
  tabs: [{ title: "1", layout: undefined }],
};
// Returns all panelIds for a given layout (including layouts stored in Tab panels)
export function getAllPanelIds(layout: MosaicNode<string>, savedProps: SavedProps): string[] {
  const layoutPanelIds = getLeaves(layout);
  const tabPanelIds = getPanelIdsInsideTabPanels(layoutPanelIds, savedProps);
  return [...layoutPanelIds, ...tabPanelIds];
}

export const validateTabPanelConfig = (config?: PanelConfig): config is TabPanelConfig => {
  if (!config) {
    return false;
  }

  if (!Array.isArray(config.tabs) || typeof config.activeTabIdx !== "number") {
    const error = new Error(
      "A non-Tab panel config is being operated on as if it were a Tab panel.",
    );
    log.info(`Invalid Tab panel config: ${error.message}`, config);
    captureException(error);
    return false;
  }
  if (config.activeTabIdx >= config.tabs.length) {
    const error = new Error("A Tab panel has an activeTabIdx for a nonexistent tab.");
    log.info(`Invalid Tab panel config: ${error.message}`, config);
    captureException(error);
    return false;
  }
  return true;
};

export const updateTabPanelLayout = (
  layout: MosaicNode<string> | undefined,
  tabPanelConfig: TabPanelConfig,
): TabPanelConfig => {
  const updatedTabs = tabPanelConfig.tabs.map((tab, i) => {
    if (i === tabPanelConfig.activeTabIdx) {
      return { ...tab, layout };
    }
    return tab;
  });
  // Create a new tab if there isn't one active
  if (tabPanelConfig.activeTabIdx === -1) {
    updatedTabs.push({ layout, title: "1" });
  }
  return {
    ...tabPanelConfig,
    tabs: updatedTabs,
    activeTabIdx: Math.max(0, tabPanelConfig.activeTabIdx),
  };
};

export const removePanelFromTabPanel = (
  path: MosaicPath = [],
  config: TabPanelConfig,
  tabId: string,
): SaveConfigsPayload => {
  if (!validateTabPanelConfig(config)) {
    return { configs: [] };
  }

  const currentTabLayout = config.tabs[config.activeTabIdx]?.layout;
  let newTree: MosaicNode<string> | undefined;
  if (path.length === 0) {
    newTree = undefined;
  } else {
    const update = createRemoveUpdate(currentTabLayout ?? ReactNull, path);
    newTree = updateTree<string>(currentTabLayout as MosaicNode<string>, [update]);
  }

  const saveConfigsPayload = {
    configs: [{ id: tabId, config: updateTabPanelLayout(newTree, config) }],
  };
  return saveConfigsPayload;
};

export const createAddUpdates = (
  tree: MosaicNode<string> | undefined,
  panelId: string,
  newPath: MosaicPath,
  position: MosaicDropTargetPosition,
): MosaicUpdate<string>[] => {
  if (tree == undefined) {
    return [];
  }
  const node = getNodeAtPath(tree, newPath) as MosaicNode<string>;
  const before = position === "left" || position === "top";
  const [first, second] = before ? [panelId, node] : [node, panelId];
  const direction: MosaicDirection = position === "left" || position === "right" ? "row" : "column";
  const updates = [{ path: newPath, spec: { $set: { first, second, direction } } }];
  return updates;
};

export const addPanelToTab = (
  insertedPanelId: string,
  destinationPath: MosaicPath | undefined,
  destinationPosition: MosaicDropTargetPosition | undefined,
  tabConfig: PanelConfig | undefined,
  tabId: string,
): SaveConfigsPayload => {
  const safeTabConfig = validateTabPanelConfig(tabConfig) ? tabConfig : DEFAULT_TAB_PANEL_CONFIG;

  const currentTabLayout = safeTabConfig.tabs[safeTabConfig.activeTabIdx]?.layout;
  const newTree =
    currentTabLayout != undefined && destinationPath && destinationPosition != undefined
      ? updateTree<string>(
          currentTabLayout,
          createAddUpdates(currentTabLayout, insertedPanelId, destinationPath, destinationPosition),
        )
      : insertedPanelId;

  const saveConfigsPayload = {
    configs: [
      {
        id: tabId,
        config: updateTabPanelLayout(newTree, safeTabConfig),
      },
    ],
  };
  return saveConfigsPayload;
};

function getValidTabPanelConfig(panelId: string, savedProps: SavedProps): TabPanelConfig {
  const config = savedProps[panelId];
  if (!config) {
    return DEFAULT_TAB_PANEL_CONFIG;
  }
  return validateTabPanelConfig(config) ? config : DEFAULT_TAB_PANEL_CONFIG;
}

export const reorderTabWithinTabPanel = ({
  source,
  target,
  savedProps,
}: {
  source: TabLocation;
  target: TabLocation;
  savedProps: SavedProps;
}): SaveConfigsPayload => {
  const { tabs, activeTabIdx } = getValidTabPanelConfig(source.panelId, savedProps);

  const sourceIndex = source.tabIndex ?? tabs.length - 1; // source.tabIndex will always be set
  const targetIndex = target.tabIndex ?? tabs.length - 1; // target.tabIndex will only be set when dropping on a tab

  const nextSourceTabs = [...tabs.slice(0, sourceIndex), ...tabs.slice(sourceIndex + 1)];
  nextSourceTabs.splice(targetIndex, 0, tabs[sourceIndex]!);

  // Update activeTabIdx so the active tab does not change when we move the tab
  const movedActiveTab = activeTabIdx === source.tabIndex;
  const movedToBeforeActiveTab = targetIndex <= activeTabIdx && sourceIndex >= activeTabIdx;
  const movedFromBeforeActiveTab = sourceIndex <= activeTabIdx && targetIndex >= activeTabIdx;

  let nextActiveTabIdx = activeTabIdx;
  if (movedActiveTab) {
    nextActiveTabIdx = targetIndex;
  } else if (movedToBeforeActiveTab) {
    nextActiveTabIdx++;
  } else if (movedFromBeforeActiveTab) {
    nextActiveTabIdx--;
  }

  return {
    configs: [
      { id: source.panelId, config: { tabs: nextSourceTabs, activeTabIdx: nextActiveTabIdx } },
    ],
  };
};

export const moveTabBetweenTabPanels = ({
  source,
  target,
  savedProps,
}: {
  source: TabLocation;
  target: TabLocation;
  savedProps: SavedProps;
}): SaveConfigsPayload => {
  const sourceConfig = getValidTabPanelConfig(source.panelId, savedProps);
  const targetConfig = getValidTabPanelConfig(target.panelId, savedProps);

  const sourceIndex = source.tabIndex ?? sourceConfig.tabs.length;
  const targetIndex = target.tabIndex ?? targetConfig.tabs.length;
  const nextTabsSource = [
    ...sourceConfig.tabs.slice(0, sourceIndex),
    ...sourceConfig.tabs.slice(sourceIndex + 1),
  ];

  const nextTabsTarget = targetConfig.tabs.slice();
  nextTabsTarget.splice(targetIndex, 0, sourceConfig.tabs[sourceIndex]!);

  // Update activeTabIdx so the active tab does not change as we move the tab
  const movedToBeforeActiveTabSource = sourceIndex <= sourceConfig.activeTabIdx;
  const nextActiveTabIdxSource = movedToBeforeActiveTabSource
    ? Math.max(0, sourceConfig.activeTabIdx - 1)
    : sourceConfig.activeTabIdx;

  const movedToBeforeActiveTabTarget = targetIndex <= targetConfig.activeTabIdx;
  const nextActiveTabIdxTarget = movedToBeforeActiveTabTarget
    ? targetConfig.activeTabIdx + 1
    : targetConfig.activeTabIdx;

  return {
    configs: [
      {
        id: source.panelId,
        config: { tabs: nextTabsSource, activeTabIdx: nextActiveTabIdxSource },
      },
      {
        id: target.panelId,
        config: { tabs: nextTabsTarget, activeTabIdx: nextActiveTabIdxTarget },
      },
    ],
  };
};

export const replaceAndRemovePanels = (
  panelArgs: {
    originalId?: string;
    newId?: string;
    idsToRemove?: readonly string[];
  },
  layout: MosaicNode<string>,
): MosaicNode<string> | undefined => {
  const { originalId, newId, idsToRemove = [] } = panelArgs;
  const panelIds = getLeaves(layout);
  if (xor(panelIds, idsToRemove).length === 0) {
    return newId;
  }

  return uniq(compact([...idsToRemove, originalId])).reduce(
    (currentLayout: MosaicNode<string> | undefined, panelIdToRemove) => {
      if (!panelIds.includes(panelIdToRemove)) {
        return currentLayout;
      } else if (currentLayout === originalId) {
        return newId;
      } else if (currentLayout == undefined || currentLayout === panelIdToRemove) {
        return undefined;
      }

      const pathToNode = getPathFromNode(panelIdToRemove, currentLayout);
      const update =
        panelIdToRemove === originalId
          ? ({ path: pathToNode, spec: { $set: newId } } as MosaicUpdate<string>)
          : createRemoveUpdate(currentLayout, pathToNode);
      return updateTree(currentLayout, [update]);
    },
    layout,
  );
};

export function getConfigsForNestedPanelsInsideTab(
  panelIdToReplace: string | undefined,
  tabPanelId: string | undefined,
  panelIdsToRemove: readonly string[],
  savedProps: SavedProps,
): ConfigsPayload[] {
  const configs: ConfigsPayload[] = [];
  const tabPanelIds = Object.keys(savedProps).filter(isTabPanel);
  tabPanelIds.forEach((panelId) => {
    const { tabs, activeTabIdx } = getValidTabPanelConfig(panelId, savedProps);
    const tabLayout = tabs[activeTabIdx]?.layout;
    if (
      tabLayout != undefined &&
      getLeaves(tabLayout).some((id) => panelIdsToRemove.includes(id))
    ) {
      const newTabLayout = replaceAndRemovePanels(
        { originalId: panelIdToReplace, newId: tabPanelId, idsToRemove: panelIdsToRemove },
        tabLayout,
      );
      const newTabConfig = updateTabPanelLayout(
        newTabLayout,
        savedProps[panelId] as TabPanelConfig,
      );
      configs.push({ id: panelId, config: newTabConfig });
    }
  });
  return configs;
}

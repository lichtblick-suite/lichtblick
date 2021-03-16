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
import { captureException } from "@sentry/electron";
import CBOR from "cbor-js";
import { create as JsonDiffCreate } from "jsondiffpatch";
import { compact, cloneDeep, flatMap, isEmpty, xor, uniq } from "lodash";
import {
  createRemoveUpdate,
  getLeaves,
  getNodeAtPath,
  getPathFromNode,
  updateTree,
  MosaicUpdate,
} from "react-mosaic-component";
import zlib from "zlib";

import { PanelsState } from "@foxglove-studio/app/reducers/panels";
import { TabLocation, TabPanelConfig } from "@foxglove-studio/app/types/layouts";
import {
  ConfigsPayload,
  PanelConfig,
  SaveConfigsPayload,
  MosaicNode,
  MosaicPath,
  MosaicDropTargetPosition,
  SavedProps,
} from "@foxglove-studio/app/types/panels";
import {
  TAB_PANEL_TYPE,
  LAYOUT_QUERY_KEY,
  LAYOUT_URL_QUERY_KEY,
  PATCH_QUERY_KEY,
} from "@foxglove-studio/app/util/globalConstants";

import Logger from "./Logger";
import { isInIFrame } from "./iframeUtils";

const jsondiffpatch = JsonDiffCreate({});

const IS_IN_IFRAME = isInIFrame();

const PARAMS_TO_DECODE = new Set([LAYOUT_URL_QUERY_KEY]);

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
  return id.split("!")[0];
}

export function getPanelIdWithNewType(id: string, newPanelType: string): string {
  return id.replace(getPanelTypeFromId(id), newPanelType);
}

export function isTabPanel(panelId: string) {
  return getPanelTypeFromId(panelId) === TAB_PANEL_TYPE;
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

function getLayoutWithNewPanelIds(
  layout: MosaicNode,
  panelIdMap: PanelIdMap,
): MosaicNode | undefined {
  if (typeof layout === "string") {
    // return corresponding ID if it exists in panelIdMap
    // (e.g. for Tab panel presets with 1 panel in active layout)
    return panelIdMap[layout] || getPanelIdForType(getPanelTypeFromId(layout));
  }

  if (!layout) {
    return undefined;
  }
  const newLayout: Record<string, any> = {};
  for (const key in layout) {
    if (typeof (layout as any)[key] === "object" && !Array.isArray((layout as any)[key])) {
      newLayout[key] = getLayoutWithNewPanelIds((layout as any)[key], panelIdMap);
    } else if (typeof (layout as any)[key] === "string" && panelIdMap[(layout as any)[key]]) {
      newLayout[key] = panelIdMap[(layout as any)[key]];
    } else {
      newLayout[key] = (layout as any)[key];
    }
  }
  // TODO: Refactor above to allow for better typing here.
  return (newLayout as any) as MosaicNode;
}

// Recursively removes all empty nodes from a layout
function compactLayout(layout: MosaicNode): MosaicNode {
  if (typeof layout === "string") {
    return layout;
  }

  const prunedChildren = [layout.first, layout.second].filter(Boolean).map(compactLayout);
  return prunedChildren.length < 2
    ? prunedChildren[0]
    : {
        ...layout,
        first: prunedChildren[0],
        second: prunedChildren[1],
      };
}

// Recursively replaces all leaves of the current layout
function replaceLeafLayouts(
  layout: MosaicNode,
  replacerFn: (layout: MosaicNode) => MosaicNode,
): MosaicNode {
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
  layout: MosaicNode,
  savedProps: SavedProps,
  preserveTabPanelIds: string[],
) {
  const tabFreeLayout = replaceLeafLayouts(layout, (id) => {
    if (typeof id === "string" && isTabPanel(id) && !preserveTabPanelIds.includes(id)) {
      const panelProps = getValidTabPanelConfig(id, savedProps);
      const tabLayout = panelProps.tabs[panelProps.activeTabIdx]?.layout;
      if (tabLayout) {
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
  Object.entries(savedProps).reduce((memo: any, [savedPanelId, savedConfig]) => {
    if (isTabPanel(savedPanelId) && savedConfig) {
      const tabPanelConfig: TabPanelConfig = savedConfig as any;
      tabPanelConfig.tabs.forEach((tab: any) => {
        const panelIdsInTab = getLeaves(tab.layout);
        panelIdsInTab.forEach((id) => (memo[id] = savedPanelId));
      });
    }
    return memo;
  }, {});

const replaceMaybeTabLayoutWithNewPanelIds = (panelIdMap: PanelIdMap) => ({ id, config }: any) => {
  return config.tabs
    ? {
        id,
        config: {
          ...config,
          tabs: config.tabs.map((t: any) => ({
            ...t,
            layout: getLayoutWithNewPanelIds(t.layout, panelIdMap),
          })),
        },
      }
    : { id, config };
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
  let newConfigs = templateIds.map((tempId) => ({
    id: panelIdMap[tempId],
    config: relatedConfigs[tempId],
  }));
  newConfigs = [...newConfigs, { id, config }]
    .filter((configObj) => configObj.config)
    .map(replaceMaybeTabLayoutWithNewPanelIds(panelIdMap));
  return { configs: newConfigs };
};

export function getPanelIdsInsideTabPanels(panelIds: string[], savedProps: SavedProps): string[] {
  const tabPanelIds = panelIds.filter(isTabPanel);
  const tabLayouts: any = [];
  tabPanelIds.forEach((panelId) => {
    if (savedProps[panelId]?.tabs) {
      savedProps[panelId].tabs.forEach((tab: any) => {
        tabLayouts.push(
          tab.layout,
          ...getPanelIdsInsideTabPanels(getLeaves(tab.layout), savedProps),
        );
      });
    }
  });
  return flatMap(tabLayouts, getLeaves);
}

export const DEFAULT_TAB_PANEL_CONFIG = {
  activeTabIdx: 0,
  tabs: [{ title: "1", layout: undefined }],
};
// Returns all panelIds for a given layout (including layouts stored in Tab panels)
export function getAllPanelIds(layout: MosaicNode, savedProps: SavedProps): string[] {
  const layoutPanelIds = getLeaves(layout);
  const tabPanelIds = getPanelIdsInsideTabPanels(layoutPanelIds, savedProps);
  return [...layoutPanelIds, ...tabPanelIds];
}

export const validateTabPanelConfig = (config?: PanelConfig) => {
  if (!config) {
    return false;
  }

  if (!Array.isArray(config?.tabs) || typeof config?.activeTabIdx !== "number") {
    const error = new Error(
      "A non-Tab panel config is being operated on as if it were a Tab panel.",
    );
    new Logger("layout").info(`Invalid Tab panel config: ${error.message}`, config);
    captureException(error);
    return false;
  }
  if (config && config.activeTabIdx >= config.tabs.length) {
    const error = new Error("A Tab panel has an activeTabIdx for a nonexistent tab.");
    new Logger("layout").info(`Invalid Tab panel config: ${error.message}`, config);
    captureException(error);
    return false;
  }
  return true;
};

export const updateTabPanelLayout = (
  layout: MosaicNode | undefined,
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

  const currentTabLayout = config.tabs[config.activeTabIdx].layout;
  let newTree: MosaicNode | undefined;
  if (!path.length) {
    newTree = undefined;
  } else {
    // eslint-disable-next-line no-restricted-syntax
    const update = createRemoveUpdate(currentTabLayout ?? null, path);
    newTree = updateTree<string>(currentTabLayout!, [update]);
  }

  const saveConfigsPayload = {
    configs: [{ id: tabId, config: updateTabPanelLayout(newTree, config) }],
  };
  return saveConfigsPayload;
};

export const createAddUpdates = (
  tree: MosaicNode | undefined,
  panelId: string,
  newPath: MosaicPath,
  position: MosaicDropTargetPosition,
): MosaicUpdate<string>[] => {
  if (!tree) {
    return [];
  }
  const node = getNodeAtPath(tree, newPath);
  const before = position === "left" || position === "top";
  const [first, second] = before ? [panelId, node] : [node, panelId];
  const direction = position === "left" || position === "right" ? "row" : "column";
  const updates = [{ path: newPath, spec: { $set: { first, second, direction } } }];
  return updates as any;
};

export const addPanelToTab = (
  insertedPanelId: string,
  destinationPath: MosaicPath | undefined,
  destinationPosition: MosaicDropTargetPosition | undefined,
  tabConfig: PanelConfig | undefined,
  tabId: string,
): SaveConfigsPayload => {
  const safeTabConfig = validateTabPanelConfig(tabConfig)
    ? ((tabConfig as any) as TabPanelConfig)
    : DEFAULT_TAB_PANEL_CONFIG;

  const currentTabLayout = safeTabConfig.tabs[safeTabConfig.activeTabIdx]?.layout;
  const newTree =
    currentTabLayout && destinationPath && destinationPosition
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

function getValidTabPanelConfig(panelId: string, savedProps: SavedProps): PanelConfig {
  const config = savedProps[panelId];
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
  nextSourceTabs.splice(targetIndex, 0, tabs[sourceIndex]);

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
  nextTabsTarget.splice(targetIndex, 0, sourceConfig.tabs[sourceIndex]);

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
    idsToRemove?: string[];
  },
  layout: MosaicNode,
): MosaicNode | undefined => {
  const { originalId, newId, idsToRemove = [] } = panelArgs;
  const panelIds = getLeaves(layout);
  if (xor(panelIds, idsToRemove).length === 0) {
    return newId;
  }

  return uniq(compact([...idsToRemove, originalId])).reduce(
    (currentLayout: any, panelIdToRemove: any) => {
      if (!panelIds.includes(panelIdToRemove)) {
        return currentLayout;
      } else if (currentLayout === originalId) {
        return newId;
      } else if (!currentLayout || currentLayout === panelIdToRemove) {
        return undefined;
      }

      const pathToNode = getPathFromNode(panelIdToRemove, currentLayout);
      const update =
        panelIdToRemove === originalId
          ? { path: pathToNode, spec: { $set: newId } }
          : createRemoveUpdate(currentLayout, pathToNode);
      return updateTree(currentLayout, [update]);
    },
    layout,
  );
};

export function getConfigsForNestedPanelsInsideTab(
  panelIdToReplace: string | undefined,
  tabPanelId: string | undefined,
  panelIdsToRemove: string[],
  savedProps: SavedProps,
): ConfigsPayload[] {
  const configs: ConfigsPayload[] = [];
  const tabPanelIds = Object.keys(savedProps).filter(isTabPanel);
  tabPanelIds.forEach((panelId) => {
    const { tabs, activeTabIdx } = getValidTabPanelConfig(panelId, savedProps);
    const tabLayout = tabs[activeTabIdx]?.layout;
    if (tabLayout && getLeaves(tabLayout).some((id) => panelIdsToRemove.includes(id))) {
      const newTabLayout = replaceAndRemovePanels(
        { originalId: panelIdToReplace, newId: tabPanelId, idsToRemove: panelIdsToRemove },
        tabLayout,
      );
      const newTabConfig = updateTabPanelLayout(newTabLayout, savedProps[panelId] as any);
      configs.push({ id: panelId, config: newTabConfig });
    }
  });
  return configs;
}

export function getLayoutPatch(
  baseState: PanelsState | undefined,
  newState: PanelsState | undefined,
): string {
  const delta = jsondiffpatch.diff(baseState, newState);
  return delta ? JSON.stringify(delta) : "";
}

export function stringifyParams(params: URLSearchParams): string {
  const stringifiedParams = [];
  for (const [key, value] of params) {
    if (PARAMS_TO_DECODE.has(key)) {
      stringifiedParams.push(`${key}=${decodeURIComponent(value)}`);
    } else {
      stringifiedParams.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  return stringifiedParams.length ? `?${stringifiedParams.join("&")}` : "";
}

const stateKeyMap = {
  layout: "l",
  savedProps: "sa",
  globalVariables: "g",
  userNodes: "u",
  linkedGlobalVariables: "lg",
  version: "v",
  playbackConfig: "p",
};
const layoutKeyMap = {
  direction: "d",
  first: "f",
  second: "se",
  row: "r",
  column: "c",
  splitPercentage: "sp",
};
export const dictForPatchCompression = { ...layoutKeyMap, ...stateKeyMap };

export function getUpdatedURLWithPatch(search: string, diff: string): string {
  // Return the original search directly if the diff is empty.
  if (!diff) {
    return search;
  }
  const params = new URLSearchParams(search);

  const diffBuffer = Buffer.from(CBOR.encode(JSON.parse(diff)));
  const dictionaryBuffer = Buffer.from(CBOR.encode(dictForPatchCompression));
  const zlibPatch = zlib
    .deflateSync(diffBuffer, { dictionary: dictionaryBuffer })
    .toString("base64");

  params.set(PATCH_QUERY_KEY, zlibPatch);
  return stringifyParams(params);
}

export function getUpdatedURLWithNewVersion(
  search: string,
  name: string,
  version?: string,
): string {
  const params = new URLSearchParams(search);
  params.set(LAYOUT_QUERY_KEY, `${name}${version ? `@${version}` : ""}`);
  params.delete(PATCH_QUERY_KEY);
  return stringifyParams(params);
}
export function getShouldProcessPatch() {
  // Skip processing patch in iframe (currently used for MiniViz) since we can't update the URL anyway.
  return !IS_IN_IFRAME;
}
// If we have a URL patch, the user has edited the layout.
export function hasEditedLayout() {
  const params = new URLSearchParams(window.location.search);
  return params.has(PATCH_QUERY_KEY);
}

export function setDefaultFields(defaultLayout: PanelsState, layout: PanelsState): PanelsState {
  const clonedLayout = cloneDeep(layout) as any;

  // Extra checks to make sure all the common fields for panels are present.
  Object.keys(defaultLayout).forEach((fieldName) => {
    const newFieldValue = clonedLayout[fieldName];
    if (isEmpty(newFieldValue)) {
      clonedLayout[fieldName] = (defaultLayout as any)[fieldName];
    }
  });
  return clonedLayout;
}

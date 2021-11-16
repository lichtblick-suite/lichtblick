// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEmpty, isEqual, pick } from "lodash";
import {
  updateTree,
  createDragToUpdates,
  createRemoveUpdate,
  createHideUpdate,
  getNodeAtPath,
  MosaicPath,
  getLeaves,
  MosaicNode,
} from "react-mosaic-component";

import { filterMap } from "@foxglove/den/collection";
import {
  StartDragPayload,
  EndDragPayload,
  SplitPanelPayload,
  DropPanelPayload,
  SwapPanelPayload,
  AddPanelPayload,
  ClosePanelPayload,
  MoveTabPayload,
  PanelsActions,
  PanelsState,
  ConfigsPayload,
  CreateTabPanelPayload,
  ChangePanelLayoutPayload,
  SaveConfigsPayload,
  SaveFullConfigPayload,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import {
  SavedProps,
  PlaybackConfig,
  MosaicDropTargetPosition,
} from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import {
  updateTabPanelLayout,
  replaceAndRemovePanels,
  getPanelIdForType,
  getPanelTypeFromId,
  getPanelIdsInsideTabPanels,
  DEFAULT_TAB_PANEL_CONFIG,
  getConfigsForNestedPanelsInsideTab,
  getAllPanelIds,
  inlineTabPanelLayouts,
  getSaveConfigsPayloadForAddedPanel,
  addPanelToTab,
  reorderTabWithinTabPanel,
  moveTabBetweenTabPanels,
  createAddUpdates,
  removePanelFromTabPanel,
  getPathFromNode,
} from "@foxglove/studio-base/util/layout";

import { isTabPanelConfig } from "../../util/layout";

export const defaultPlaybackConfig: PlaybackConfig = {
  speed: 1.0,
  messageOrder: "receiveTime",
};

function changePanelLayout(
  state: PanelsState,
  { layout, trimConfigById = true }: ChangePanelLayoutPayload,
): PanelsState {
  const panelIds: string[] = getLeaves(layout ?? ReactNull).filter((panelId) => !isEmpty(panelId));
  const panelIdsInsideTabPanels = getPanelIdsInsideTabPanels(panelIds, state.configById);
  // Filter configById in case a panel was removed from the layout
  // We don't want its configById hanging around forever
  const configById = trimConfigById
    ? pick(state.configById, [...panelIdsInsideTabPanels, ...panelIds])
    : state.configById;
  return { ...state, configById, layout };
}

function savePanelConfigs(state: PanelsState, payload: SaveConfigsPayload): PanelsState {
  const { configs } = payload;
  const prevConfigById = state.configById;

  // create a configById object with new configs merged on top of previous configs
  //
  // Note: If no configs are changed, the return value of newConfigById is the same as the state input
  //       This keeps the state object unchagned if the configs values did not change.
  const newConfigById = configs.reduce(
    (currentSavedProps, { id, config, defaultConfig = {}, override = false }) => {
      if (override) {
        return { ...currentSavedProps, [id]: config };
      }

      const oldConfig = currentSavedProps[id];
      const newConfig = {
        // merge the partial new config with the default config and the old config
        // any entries in the new config can override default config and previous config entries
        ...defaultConfig,
        ...currentSavedProps[id],
        ...config,
      };

      // if the new config is unchanged, return currentSavedProps to keep same object
      // keeping the same object around is useful for upstream consumers of state which look at changes
      // in object reference to mean the object changed
      if (isEqual(oldConfig, newConfig)) {
        return currentSavedProps;
      }

      return { ...currentSavedProps, [id]: newConfig };
    },
    state.configById,
  );
  const tabPanelConfigSaved = configs.find(({ id }) => getPanelTypeFromId(id) === TAB_PANEL_TYPE);
  if (tabPanelConfigSaved) {
    // eslint-disable-next-line no-restricted-syntax
    const panelIds = getLeaves(state.layout ?? null);
    const panelIdsInsideTabPanels = getPanelIdsInsideTabPanels(panelIds, newConfigById);
    // Filter savedProps in case a panel was removed from a Tab layout
    // We don't want its savedProps hanging around forever
    return { ...state, configById: pick(newConfigById, [...panelIdsInsideTabPanels, ...panelIds]) };
  }

  // if none of the configs changed, then we keep the same state object
  if (prevConfigById === newConfigById) {
    return state;
  }
  return { ...state, configById: newConfigById };
}

function saveFullPanelConfig(state: PanelsState, payload: SaveFullConfigPayload): PanelsState {
  const { panelType, perPanelFunc } = payload;
  const newProps = { ...state.configById };
  const fullConfig = state.configById;
  for (const [panelId, panelConfig] of Object.entries(fullConfig)) {
    if (getPanelTypeFromId(panelId) === panelType) {
      newProps[panelId] = perPanelFunc(panelConfig);
    }
  }

  return { ...state, configById: newProps };
}

const closePanel = (
  panelsState: PanelsState,
  { tabId, root, path }: ClosePanelPayload,
): PanelsState => {
  if (tabId != undefined) {
    const config = panelsState.configById[tabId] as TabPanelConfig;
    const saveConfigsPayload = removePanelFromTabPanel(path, config, tabId);
    return savePanelConfigs(panelsState, saveConfigsPayload);
  } else if (typeof root === "string") {
    // When layout consists of 1 panel, clear the layout
    return changePanelLayout(panelsState, { layout: undefined });
  }
  const update = createRemoveUpdate(root, path);
  const newLayout = updateTree(root, [update]);
  return changePanelLayout(panelsState, { layout: newLayout });
};

const splitPanel = (
  panelsState: PanelsState,
  { id, tabId, direction, config, root, path }: SplitPanelPayload,
): PanelsState => {
  const type = getPanelTypeFromId(id);
  const newId = getPanelIdForType(type);
  let newPanelsState = { ...panelsState };
  const { configById: savedProps } = newPanelsState;
  if (tabId != undefined) {
    const prevConfig = savedProps[tabId] as TabPanelConfig;
    const activeTabLayout = prevConfig.tabs[prevConfig.activeTabIdx]?.layout;
    if (activeTabLayout != undefined) {
      const newTabLayout = updateTree(activeTabLayout, [
        {
          path: getPathFromNode(id, activeTabLayout),
          spec: { $set: { first: id, second: newId, direction } },
        },
      ]);
      const newTabConfig = updateTabPanelLayout(newTabLayout, prevConfig);
      newPanelsState = savePanelConfigs(newPanelsState, {
        configs: [
          { id: tabId, config: newTabConfig },
          { id: newId, config },
        ],
      });
    }
  } else {
    newPanelsState = changePanelLayout(newPanelsState, {
      layout: updateTree(root, [{ path, spec: { $set: { first: id, second: newId, direction } } }]),
      trimConfigById: type !== TAB_PANEL_TYPE,
    });

    const relatedConfigs =
      type === TAB_PANEL_TYPE
        ? (getPanelIdsInsideTabPanels([id], savedProps).reduce(
            (res: Record<string, unknown>, panelId: string) => ({
              ...res,
              [panelId]: savedProps[panelId],
            }),
            {},
          ) as SavedProps)
        : undefined;
    newPanelsState = savePanelConfigs(
      newPanelsState,
      getSaveConfigsPayloadForAddedPanel({ id: newId, config, relatedConfigs }),
    );
  }
  return newPanelsState;
};

const swapPanel = (
  panelsState: PanelsState,
  { tabId, originalId, type, config, relatedConfigs, root, path }: SwapPanelPayload,
): PanelsState => {
  const newId = getPanelIdForType(type);
  let newPanelsState = { ...panelsState };
  // For a panel inside a Tab panel, update the Tab panel's tab layouts via savedProps
  if (tabId != undefined && originalId != undefined) {
    const tabSavedProps = newPanelsState.configById[tabId] as TabPanelConfig | undefined;
    if (tabSavedProps) {
      const activeTabLayout = tabSavedProps.tabs[tabSavedProps.activeTabIdx]?.layout;
      if (activeTabLayout != undefined) {
        const newTabLayout = replaceAndRemovePanels({ originalId, newId }, activeTabLayout);

        const newTabConfig = updateTabPanelLayout(newTabLayout, tabSavedProps);
        newPanelsState = savePanelConfigs(newPanelsState, {
          configs: [{ id: tabId, config: newTabConfig }],
        });
      }
    }
  } else {
    newPanelsState = changePanelLayout(newPanelsState, {
      layout: updateTree(root, [{ path, spec: { $set: newId } }]),
      trimConfigById: type !== TAB_PANEL_TYPE,
    });
  }

  newPanelsState = savePanelConfigs(
    newPanelsState,
    getSaveConfigsPayloadForAddedPanel({ id: newId, config, relatedConfigs }),
  );
  return newPanelsState;
};

const createTabPanelWithSingleTab = (
  panelsState: PanelsState,
  { idToReplace, layout, idsToRemove }: CreateTabPanelPayload,
): PanelsState => {
  const newId = getPanelIdForType(TAB_PANEL_TYPE);
  const { configById: savedProps } = panelsState;
  // Build the layout for the new tab
  const layoutWithInlinedTabs = inlineTabPanelLayouts(layout, savedProps, idsToRemove);
  const panelIdsNotInNewTab = getAllPanelIds(layout, savedProps).filter(
    (leaf: string) => !idsToRemove.includes(leaf),
  );
  const tabLayout = replaceAndRemovePanels(
    { idsToRemove: panelIdsNotInNewTab },
    layoutWithInlinedTabs,
  );

  const newLayout = replaceAndRemovePanels({ originalId: idToReplace, newId, idsToRemove }, layout);
  let newPanelsState = changePanelLayout(panelsState, {
    layout: newLayout ?? "",
    trimConfigById: false,
  });

  const tabPanelConfig = {
    id: newId,
    config: { ...DEFAULT_TAB_PANEL_CONFIG, tabs: [{ title: "1", layout: tabLayout }] },
  };
  const nestedPanelConfigs = getConfigsForNestedPanelsInsideTab(
    idToReplace,
    newId,
    idsToRemove,
    savedProps,
  );
  newPanelsState = savePanelConfigs(newPanelsState, {
    configs: [tabPanelConfig, ...nestedPanelConfigs],
  });
  return newPanelsState;
};

const createTabPanelWithMultipleTabs = (
  panelsState: PanelsState,
  { idToReplace, layout, idsToRemove }: CreateTabPanelPayload,
): PanelsState => {
  const { configById: savedProps } = panelsState;
  const newId = getPanelIdForType(TAB_PANEL_TYPE);
  const newLayout = replaceAndRemovePanels({ originalId: idToReplace, newId, idsToRemove }, layout);
  let newPanelsState = changePanelLayout(
    { ...panelsState },
    { layout: newLayout ?? "", trimConfigById: false },
  );

  const tabs = idsToRemove.map((panelId) => ({
    title: getPanelTypeFromId(panelId),
    layout: panelId,
  }));
  const tabPanelConfig = { id: newId, config: { ...DEFAULT_TAB_PANEL_CONFIG, tabs } };
  const nestedPanelConfigs = getConfigsForNestedPanelsInsideTab(
    idToReplace,
    newId,
    idsToRemove,
    savedProps,
  );
  newPanelsState = savePanelConfigs(newPanelsState, {
    configs: [tabPanelConfig, ...nestedPanelConfigs],
  });

  return newPanelsState;
};

const moveTab = (panelsState: PanelsState, { source, target }: MoveTabPayload): PanelsState => {
  const saveConfigsPayload =
    source.panelId === target.panelId
      ? reorderTabWithinTabPanel({ source, target, savedProps: panelsState.configById })
      : moveTabBetweenTabPanels({ source, target, savedProps: panelsState.configById });
  return savePanelConfigs(panelsState, saveConfigsPayload);
};

const addPanel = (
  panelsState: PanelsState,
  { tabId, id, config, relatedConfigs }: AddPanelPayload,
) => {
  let newPanelsState = { ...panelsState };
  let saveConfigsPayload: { configs: ConfigsPayload[] } = { configs: [] };
  if (config) {
    saveConfigsPayload = getSaveConfigsPayloadForAddedPanel({ id, config, relatedConfigs });
  }
  let layout: MosaicNode<string> | undefined;
  if (tabId != undefined) {
    const tabPanelConfig = panelsState.configById[tabId];
    if (isTabPanelConfig(tabPanelConfig)) {
      layout = tabPanelConfig.tabs[tabPanelConfig.activeTabIdx]?.layout;
    }
  } else {
    layout = panelsState.layout;
  }
  const fixedLayout: MosaicNode<string> = isEmpty(layout)
    ? id
    : { direction: "row", first: id, second: layout as MosaicNode<string> };
  const changeLayoutPayload = {
    layout: fixedLayout,
    trimConfigById: !relatedConfigs,
  };
  if (tabId != undefined && typeof changeLayoutPayload.layout === "string") {
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        {
          id: tabId,
          config: updateTabPanelLayout(changeLayoutPayload.layout, {
            ...DEFAULT_TAB_PANEL_CONFIG,
            ...panelsState.configById[tabId],
          }),
        },
      ],
    });
  } else {
    newPanelsState = changePanelLayout(newPanelsState, changeLayoutPayload);
  }
  newPanelsState = savePanelConfigs(newPanelsState, saveConfigsPayload);
  return newPanelsState;
};

const dropPanel = (
  panelsState: PanelsState,
  { newPanelType, destinationPath = [], position, tabId, config, relatedConfigs }: DropPanelPayload,
) => {
  const id = getPanelIdForType(newPanelType);

  const configs = [];
  // This means we've dragged into a Tab panel
  if (tabId != undefined) {
    const { configs: newConfigs } = addPanelToTab(
      id,
      destinationPath,
      position,
      panelsState.configById[tabId],
      tabId,
    );
    configs.push(...newConfigs);
  }

  const newLayout =
    tabId != undefined
      ? panelsState.layout
      : updateTree<string>(
          panelsState.layout as MosaicNode<string>,
          createAddUpdates(panelsState.layout, id, destinationPath, position ?? "left"),
        );

  // 'relatedConfigs' are used in Tab panel presets, so that the panels'
  // respective configs will be saved globally.
  if (config) {
    const { configs: newConfigs } = getSaveConfigsPayloadForAddedPanel({
      id,
      config,
      relatedConfigs,
    });
    configs.push(...newConfigs);
  }

  let newPanelsState = changePanelLayout(panelsState, {
    layout: newLayout,
    trimConfigById: !relatedConfigs,
  });
  newPanelsState = savePanelConfigs(newPanelsState, { configs });
  return newPanelsState;
};

const dragWithinSameTab = (
  panelsState: PanelsState,
  {
    originalLayout,
    sourceTabId,
    position,
    destinationPath,
    ownPath,
    sourceTabConfig,
    sourceTabChildConfigs,
  }: {
    originalLayout: MosaicNode<string>;
    sourceTabId: string;
    position: MosaicDropTargetPosition;
    destinationPath: MosaicPath;
    ownPath: MosaicPath;
    sourceTabConfig: TabPanelConfig;
    sourceTabChildConfigs: ConfigsPayload[];
  },
): PanelsState => {
  const currentTabLayout = sourceTabConfig.tabs[sourceTabConfig.activeTabIdx]?.layout;
  let newPanelsState = { ...panelsState };
  if (typeof currentTabLayout === "string") {
    newPanelsState = changePanelLayout(panelsState, {
      layout: originalLayout,
      trimConfigById: false,
    });
    // We assume `begin` handler already removed tab from config. Here it is replacing it, or keeping it as is
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        { id: sourceTabId, config: updateTabPanelLayout(currentTabLayout, sourceTabConfig) },
        ...sourceTabChildConfigs,
      ],
    });
  } else if (currentTabLayout != undefined) {
    const updates = createDragToUpdates(currentTabLayout, ownPath, destinationPath, position);
    const newTree = updateTree(currentTabLayout, updates);

    newPanelsState = changePanelLayout(panelsState, {
      layout: originalLayout,
      trimConfigById: false,
    });
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        {
          id: sourceTabId,
          config: updateTabPanelLayout(
            newTree,
            panelsState.configById[sourceTabId] as TabPanelConfig,
          ),
        },
        ...sourceTabChildConfigs,
      ],
    });
  }
  return newPanelsState;
};

const dragToMainFromTab = (
  panelsState: PanelsState,
  {
    originalLayout,
    sourceTabId,
    position,
    destinationPath,
    ownPath,
    sourceTabConfig,
    sourceTabChildConfigs,
  }: {
    originalLayout: MosaicNode<string>;
    sourceTabId: string;
    position: MosaicDropTargetPosition;
    destinationPath: MosaicPath;
    ownPath: MosaicPath;
    sourceTabConfig: TabPanelConfig;
    sourceTabChildConfigs: ConfigsPayload[];
  },
): PanelsState => {
  const currentTabLayout = sourceTabConfig.tabs[sourceTabConfig.activeTabIdx]?.layout;
  if (currentTabLayout == undefined) {
    return panelsState;
  }
  // Remove panel from tab layout
  const saveConfigsPayload = removePanelFromTabPanel(
    ownPath,
    panelsState.configById[sourceTabId] as TabPanelConfig,
    sourceTabId,
  );
  const panelConfigs = {
    ...saveConfigsPayload,
    configs: [...saveConfigsPayload.configs, ...sourceTabChildConfigs],
  };

  // Insert it into main layout
  const currentNode = getNodeAtPath(currentTabLayout, ownPath);
  if (typeof currentNode !== "string") {
    return panelsState;
  }
  const newLayout = updateTree(
    originalLayout,
    createAddUpdates(originalLayout, currentNode, destinationPath, position),
  );

  let newPanelsState = changePanelLayout(panelsState, { layout: newLayout, trimConfigById: false });
  newPanelsState = savePanelConfigs(newPanelsState, panelConfigs);
  return newPanelsState;
};

const dragToTabFromMain = (
  panelsState: PanelsState,
  {
    originalLayout,
    panelId,
    targetTabId,
    position,
    destinationPath,
    ownPath,
    targetTabConfig,
    sourceTabChildConfigs,
  }: {
    originalLayout: MosaicNode<string>;
    panelId: string;
    targetTabId: string;
    position?: MosaicDropTargetPosition;
    destinationPath?: MosaicPath;
    ownPath: MosaicPath;
    targetTabConfig?: TabPanelConfig;
    sourceTabChildConfigs: ConfigsPayload[];
  },
): PanelsState => {
  const saveConfigsPayload = addPanelToTab(
    panelId,
    destinationPath,
    position,
    targetTabConfig,
    targetTabId,
  );
  const panelConfigs = {
    ...saveConfigsPayload,
    configs: [...saveConfigsPayload.configs, ...sourceTabChildConfigs],
  };
  const update = createRemoveUpdate(originalLayout, ownPath);
  const newLayout = updateTree(originalLayout, [update]);
  let newPanelsState = changePanelLayout(panelsState, { layout: newLayout, trimConfigById: false });
  newPanelsState = savePanelConfigs(newPanelsState, { configs: panelConfigs.configs });
  return newPanelsState;
};

const dragToTabFromTab = (
  panelsState: PanelsState,
  {
    originalLayout,
    panelId,
    sourceTabId,
    targetTabId,
    position,
    destinationPath,
    ownPath,
    targetTabConfig,
    sourceTabConfig,
    sourceTabChildConfigs,
  }: {
    originalLayout: MosaicNode<string>;
    panelId: string;
    sourceTabId: string;
    targetTabId: string;
    position?: MosaicDropTargetPosition;
    destinationPath?: MosaicPath;
    ownPath: MosaicPath;
    targetTabConfig?: TabPanelConfig;
    sourceTabConfig: TabPanelConfig;
    sourceTabChildConfigs: ConfigsPayload[];
  },
): PanelsState => {
  // Remove panel from tab layout
  const { configs: fromTabConfigs } = removePanelFromTabPanel(
    ownPath,
    sourceTabConfig,
    sourceTabId,
  );

  // Insert it into another tab
  const { configs: toTabConfigs } = addPanelToTab(
    panelId,
    destinationPath,
    position,
    targetTabConfig,
    targetTabId,
  );
  let newPanelsState = changePanelLayout(panelsState, {
    layout: originalLayout,
    trimConfigById: false,
  });
  newPanelsState = savePanelConfigs(newPanelsState, {
    configs: [...fromTabConfigs, ...toTabConfigs, ...sourceTabChildConfigs],
  });
  return newPanelsState;
};

const startDrag = (
  panelsState: PanelsState,
  { path, sourceTabId }: StartDragPayload,
): PanelsState => {
  // Collapse or remove the panel being dragged so it's temporarily hidden from the layout.
  if (path.length > 0) {
    if (sourceTabId != undefined) {
      const tabConfig = panelsState.configById[sourceTabId] as TabPanelConfig;
      const activeLayout = tabConfig.tabs[tabConfig.activeTabIdx]?.layout;
      if (activeLayout == undefined) {
        return panelsState;
      }
      const newTabLayout = updateTree(activeLayout, [createHideUpdate(path)]);
      const newTabConfig = updateTabPanelLayout(newTabLayout, tabConfig);
      return savePanelConfigs(panelsState, {
        configs: [{ id: sourceTabId, config: newTabConfig }],
      });
    }
    return changePanelLayout(panelsState, {
      layout: updateTree<string>(panelsState.layout ?? "", [createHideUpdate(path)]),
      trimConfigById: false,
    });
  } else if (sourceTabId != undefined) {
    // If we've dragged a panel from a single panel tab layout, remove that panel
    const sourceTabConfig = panelsState.configById[sourceTabId] as TabPanelConfig;
    return savePanelConfigs(panelsState, {
      configs: [{ id: sourceTabId, config: updateTabPanelLayout(undefined, sourceTabConfig) }],
    });
  }
  return panelsState;
};

const endDrag = (panelsState: PanelsState, dragPayload: EndDragPayload): PanelsState => {
  const {
    originalLayout,
    originalSavedProps,
    panelId,
    sourceTabId,
    targetTabId,
    position,
    destinationPath,
    ownPath,
  } = dragPayload;
  const toMainFromTab = sourceTabId != undefined && targetTabId == undefined;
  const toTabfromMain = sourceTabId == undefined && targetTabId != undefined;
  const toTabfromTab = sourceTabId != undefined && targetTabId != undefined;
  const withinSameTab = sourceTabId === targetTabId && toTabfromTab; // In case it's simply a drag within the main layout.

  const sourceTabConfig =
    sourceTabId != undefined ? (originalSavedProps[sourceTabId] as TabPanelConfig) : undefined;
  const targetTabConfig =
    targetTabId != undefined ? (originalSavedProps[targetTabId] as TabPanelConfig) : undefined;
  const panelIdsInsideTabPanels =
    (sourceTabId != undefined && getPanelIdsInsideTabPanels([sourceTabId], originalSavedProps)) ||
    [];

  const sourceTabChildConfigs = filterMap(panelIdsInsideTabPanels, (id) => {
    const config = originalSavedProps[id];
    return config ? { id, config } : undefined;
  });

  if (
    withinSameTab &&
    sourceTabConfig &&
    sourceTabId != undefined &&
    position != undefined &&
    destinationPath != undefined
  ) {
    return dragWithinSameTab(panelsState, {
      originalLayout,
      sourceTabId,
      position,
      destinationPath,
      ownPath,
      sourceTabConfig,
      sourceTabChildConfigs,
    });
  }

  if (
    toMainFromTab &&
    sourceTabConfig &&
    sourceTabId != undefined &&
    position != undefined &&
    destinationPath != undefined
  ) {
    return dragToMainFromTab(panelsState, {
      originalLayout,
      sourceTabId,
      position,
      destinationPath,
      ownPath,
      sourceTabConfig,
      sourceTabChildConfigs,
    });
  }

  if (toTabfromMain && targetTabId != undefined) {
    return dragToTabFromMain(panelsState, {
      originalLayout,
      panelId,
      targetTabId,
      position,
      destinationPath,
      ownPath,
      targetTabConfig,
      sourceTabChildConfigs,
    });
  }

  if (toTabfromTab && sourceTabConfig && sourceTabId != undefined && targetTabId != undefined) {
    return dragToTabFromTab(panelsState, {
      originalLayout,
      panelId,
      sourceTabId,
      targetTabId,
      position,
      destinationPath,
      ownPath,
      targetTabConfig,
      sourceTabConfig,
      sourceTabChildConfigs,
    });
  }

  if (typeof originalLayout === "string") {
    return changePanelLayout(panelsState, { layout: originalLayout, trimConfigById: false });
  }

  if (position != undefined && destinationPath != undefined && !isEqual(destinationPath, ownPath)) {
    const updates = createDragToUpdates(originalLayout, ownPath, destinationPath, position);
    const newLayout = updateTree(originalLayout, updates);
    return changePanelLayout(panelsState, { layout: newLayout, trimConfigById: false });
  }

  // The drag was canceled; restore the original layout to re-show/re-add the dragged panel.
  // This undoes the effects of startDrag().
  return { ...panelsState, layout: originalLayout, configById: originalSavedProps };
};

export default function (panelsState: Readonly<PanelsState>, action: PanelsActions): PanelsState {
  // start the newPanelsState as the current panels state so if there are no changes the identity
  // of the panels state object remains the same
  switch (action.type) {
    case "CHANGE_PANEL_LAYOUT":
      return changePanelLayout(panelsState, action.payload);

    case "SAVE_PANEL_CONFIGS":
      return savePanelConfigs(panelsState, action.payload);

    case "SAVE_FULL_PANEL_CONFIG":
      return saveFullPanelConfig(panelsState, action.payload);

    case "CREATE_TAB_PANEL":
      return action.payload.singleTab
        ? createTabPanelWithSingleTab(panelsState, action.payload)
        : createTabPanelWithMultipleTabs(panelsState, action.payload);

    case "OVERWRITE_GLOBAL_DATA":
      return {
        ...panelsState,
        globalVariables: action.payload,
      };

    case "SET_GLOBAL_DATA": {
      const globalVariables = {
        ...panelsState.globalVariables,
        ...action.payload,
      };
      Object.keys(globalVariables).forEach((key) => {
        if (globalVariables[key] == undefined) {
          delete globalVariables[key];
        }
      });
      return {
        ...panelsState,
        globalVariables,
      };
    }

    case "SET_USER_NODES": {
      const userNodes = { ...panelsState.userNodes };
      for (const [key, value] of Object.entries(action.payload)) {
        if (value == undefined) {
          delete userNodes[key];
        } else {
          userNodes[key] = value;
        }
      }
      return {
        ...panelsState,
        userNodes,
      };
    }

    case "SET_LINKED_GLOBAL_VARIABLES":
      return {
        ...panelsState,
        linkedGlobalVariables: action.payload,
      };
    case "SET_PLAYBACK_CONFIG":
      return {
        ...panelsState,
        playbackConfig: {
          ...panelsState.playbackConfig,
          ...action.payload,
        },
      };
    case "CLOSE_PANEL":
      return closePanel(panelsState, action.payload);

    case "SPLIT_PANEL":
      return splitPanel(panelsState, action.payload);

    case "SWAP_PANEL":
      return swapPanel(panelsState, action.payload);

    case "MOVE_TAB":
      return moveTab(panelsState, action.payload);

    case "ADD_PANEL":
      return addPanel(panelsState, action.payload);

    case "DROP_PANEL":
      return dropPanel(panelsState, action.payload);

    case "START_DRAG":
      return startDrag(panelsState, action.payload);

    case "END_DRAG":
      return endDrag(panelsState, action.payload);

    default:
      throw new Error("This reducer should only be used for panel actions");
  }

  return panelsState;
}

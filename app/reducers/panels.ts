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

import { isEmpty, isEqual, dropRight, pick, cloneDeep } from "lodash";
import {
  updateTree,
  createDragToUpdates,
  createRemoveUpdate,
  createHideUpdate,
  getNodeAtPath,
  MosaicPath,
  getLeaves,
  MosaicParent,
  MosaicNode,
} from "react-mosaic-component";

import { ActionTypes } from "@foxglove/studio-base/actions";
import {
  StartDragPayload,
  EndDragPayload,
  SplitPanelPayload,
  DropPanelPayload,
  SwapPanelPayload,
  AddPanelPayload,
  ClosePanelPayload,
  MoveTabPayload,
} from "@foxglove/studio-base/actions/panels";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { State, PersistedState } from "@foxglove/studio-base/reducers";
import { TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import {
  PanelConfig,
  ConfigsPayload,
  CreateTabPanelPayload,
  ChangePanelLayoutPayload,
  SaveConfigsPayload,
  SaveFullConfigPayload,
  ImportPanelLayoutPayload,
  SavedProps,
  UserNodes,
  PlaybackConfig,
  MosaicDropTargetPosition,
} from "@foxglove/studio-base/types/panels";
import Storage from "@foxglove/studio-base/util/Storage";
import filterMap from "@foxglove/studio-base/util/filterMap";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import {
  setDefaultFields,
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

const storage = new Storage();

export const DEPRECATED_GLOBAL_STATE_STORAGE_KEY = "webvizGlobalState";
export const GLOBAL_STATE_STORAGE_KEY = "studioGlobalState";
export const defaultPlaybackConfig: PlaybackConfig = {
  speed: 0.2,
  messageOrder: "receiveTime",
  timeDisplayMethod: "ROS",
};

export type PanelsState = {
  id?: string;
  name?: string;
  layout?: MosaicNode<string>;
  // We store config for each panel in a hash keyed by the panel id.
  // This should at some point be renamed to `config` or `configById` or so,
  // but it's inconvenient to have this diverge from `PANEL_PROPS_KEY`.
  savedProps: SavedProps;
  globalVariables: GlobalVariables;
  userNodes: UserNodes;
  linkedGlobalVariables: LinkedGlobalVariables;
  playbackConfig: PlaybackConfig;
  version?: number;
};

export const setPersistedStateInLocalStorage = (persistedState: PersistedState): void => {
  storage.setItem(GLOBAL_STATE_STORAGE_KEY, persistedState);
};

// All panel fields have to be present.
export const defaultPersistedState = Object.freeze<PersistedState>({
  search: "",
  panels: {
    layout: {
      direction: "row",
      first: "DiagnosticSummary!3edblo1",
      second: {
        direction: "row",
        first: "RosOut!1f38b3d",
        second: "3D Panel!1my2ydk",
        splitPercentage: 50,
      },
      splitPercentage: 33.3333333333,
    },
    savedProps: {},
    globalVariables: {},
    userNodes: {},
    linkedGlobalVariables: [],
    playbackConfig: {
      speed: 0.2,
      messageOrder: "receiveTime",
      timeDisplayMethod: "ROS",
    },
  },
});

// initialPersistedState will be initialized once when the store initializes this reducer. It is
// initialized lazily so we can manipulate localStorage in test setup and when we create new stores
// new stores they will use the new values in localStorage. Re-initializing it for every action is
// too expensive.
let initialPersistedState: PersistedState | undefined = undefined;
export function getInitialPersistedStateAndMaybeUpdateLocalStorageAndURL(): PersistedState {
  if (initialPersistedState == undefined) {
    const oldPersistedState: any =
      storage.getItem(GLOBAL_STATE_STORAGE_KEY) ??
      storage.getItem(DEPRECATED_GLOBAL_STATE_STORAGE_KEY);
    storage.removeItem(DEPRECATED_GLOBAL_STATE_STORAGE_KEY);

    // cast to PersistedState to remove the Readonly created by the Object.freeze above
    const newPersistedState = cloneDeep(defaultPersistedState) as PersistedState;

    if (oldPersistedState?.panels) {
      newPersistedState.panels = oldPersistedState.panels;
    } else if (oldPersistedState?.layout) {
      // The localStorage is on old format with {layout, savedProps...}
      newPersistedState.panels = oldPersistedState;
    }
    newPersistedState.panels = setDefaultFields(
      defaultPersistedState.panels,
      newPersistedState.panels,
    );

    // Store in localStorage.
    initialPersistedState = {
      ...newPersistedState,
      panels: { ...defaultPersistedState.panels, ...newPersistedState.panels },
    };

    setPersistedStateInLocalStorage(initialPersistedState);
  }

  return initialPersistedState;
}

// Export for testing.
export function resetInitialPersistedState(): void {
  initialPersistedState = undefined;
}

function changePanelLayout(
  state: PanelsState,
  { layout, trimSavedProps = true }: ChangePanelLayoutPayload,
): PanelsState {
  // eslint-disable-next-line no-restricted-syntax
  const panelIds = getLeaves(layout ?? null).filter((panelId) => !isEmpty(panelId));
  const panelIdsInsideTabPanels = getPanelIdsInsideTabPanels(panelIds, state.savedProps);
  // Filter savedProps in case a panel was removed from the layout
  // We don't want its savedProps hanging around forever
  const savedProps = trimSavedProps
    ? pick(state.savedProps, [...panelIdsInsideTabPanels, ...panelIds])
    : state.savedProps;
  return { ...state, savedProps, layout };
}

function savePanelConfigs(state: PanelsState, payload: SaveConfigsPayload): PanelsState {
  const { configs } = payload;
  // imutable update of key/value pairs
  const newSavedProps = configs.reduce(
    (currentSavedProps, { id, config, defaultConfig = {}, override = false }) => {
      return override
        ? { ...currentSavedProps, [id]: config }
        : {
            ...currentSavedProps,
            [id]: {
              // merge new config with old one
              // similar to how this.setState merges props
              // When updating the panel state, we merge the new config (which may be just a part of config) with the old config and the default config every time.
              // Previously this was done inside the component, but since the lifecycle of Redux is Action => Reducer => new state => Component,
              // dispatching an update to the panel state is not instant and can take some time to propagate back to the component.
              // If the existing panel config is the complete config1, and two actions were fired in quick succession the component with partial config2 and config3,
              // the correct behavior is to merge config2 with config1 and dispatch that, and then merge config 3 with the combined config2 and config1.
              // Instead we had stale state so we would merge config3 with config1 and overwrite any keys that exist in config2 but do not exist in config3.
              // The solution is to do this merge inside the reducer itself, since the state inside the reducer is never stale (unlike the state inside the component).
              ...defaultConfig,
              ...currentSavedProps[id],
              ...config,
            },
          };
    },
    state.savedProps,
  );
  const tabPanelConfigSaved = configs.find(({ id }) => getPanelTypeFromId(id) === TAB_PANEL_TYPE);
  if (tabPanelConfigSaved) {
    // eslint-disable-next-line no-restricted-syntax
    const panelIds = getLeaves(state.layout ?? null);
    const panelIdsInsideTabPanels = getPanelIdsInsideTabPanels(panelIds, newSavedProps);
    // Filter savedProps in case a panel was removed from a Tab layout
    // We don't want its savedProps hanging around forever
    return { ...state, savedProps: pick(newSavedProps, [...panelIdsInsideTabPanels, ...panelIds]) };
  }
  return { ...state, savedProps: newSavedProps };
}

function saveFullPanelConfig(state: PanelsState, payload: SaveFullConfigPayload): PanelsState {
  const { panelType, perPanelFunc } = payload;
  const newProps = { ...state.savedProps };
  const fullConfig = state.savedProps;
  Object.keys(fullConfig).forEach((panelId) => {
    if (getPanelTypeFromId(panelId) === panelType) {
      const newPanelConfig = perPanelFunc(fullConfig[panelId]);
      if (newPanelConfig) {
        newProps[panelId] = newPanelConfig;
      }
    }
  });

  return { ...state, savedProps: newProps };
}

const closePanel = (
  panelsState: PanelsState,
  { tabId, root, path }: ClosePanelPayload,
): PanelsState => {
  if (tabId != undefined) {
    const config = panelsState.savedProps[tabId] as TabPanelConfig;
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
  state: State,
  { id, tabId, direction, config, root, path }: SplitPanelPayload,
): PanelsState => {
  const type = getPanelTypeFromId(id);
  const newId = getPanelIdForType(type);
  let newPanelsState = { ...state.persistedState.panels };
  const { savedProps } = newPanelsState;
  if (tabId != undefined) {
    const activeTabLayout = savedProps[tabId]?.tabs[savedProps[tabId]?.activeTabIdx].layout;
    const newTabLayout = updateTree(activeTabLayout, [
      {
        path: getPathFromNode(id, activeTabLayout),
        spec: { $set: { first: id, second: newId, direction } },
      },
    ]);
    const prevConfig = savedProps[tabId] as TabPanelConfig;
    const newTabConfig = updateTabPanelLayout(newTabLayout, prevConfig);
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        { id: tabId, config: newTabConfig },
        { id: newId, config },
      ],
    });
  } else {
    newPanelsState = changePanelLayout(newPanelsState, {
      layout: updateTree(root, [{ path, spec: { $set: { first: id, second: newId, direction } } }]),
      trimSavedProps: type !== TAB_PANEL_TYPE,
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
  state: State,
  { tabId, originalId, type, config, relatedConfigs, root, path }: SwapPanelPayload,
): PanelsState => {
  const newId = getPanelIdForType(type);
  let newPanelsState = { ...state.persistedState.panels };
  // For a panel inside a Tab panel, update the Tab panel's tab layouts via savedProps
  if (tabId != undefined && originalId != undefined) {
    const tabSavedProps = newPanelsState.savedProps[tabId];
    if (tabSavedProps) {
      const activeTabLayout = tabSavedProps.tabs[tabSavedProps.activeTabIdx]
        .layout as MosaicParent<string>;
      const newTabLayout = replaceAndRemovePanels({ originalId, newId }, activeTabLayout);

      const newTabConfig = updateTabPanelLayout(newTabLayout, tabSavedProps as TabPanelConfig);
      newPanelsState = savePanelConfigs(newPanelsState, {
        configs: [{ id: tabId, config: newTabConfig }],
      });
    }
  } else {
    newPanelsState = changePanelLayout(newPanelsState, {
      layout: updateTree(root, [{ path, spec: { $set: newId } }]),
      trimSavedProps: type !== TAB_PANEL_TYPE,
    });
  }

  newPanelsState = savePanelConfigs(
    newPanelsState,
    getSaveConfigsPayloadForAddedPanel({ id: newId, config, relatedConfigs }),
  );
  return newPanelsState;
};

const createTabPanelWithSingleTab = (
  state: State,
  { idToReplace, layout, idsToRemove }: CreateTabPanelPayload,
): State => {
  const newId = getPanelIdForType(TAB_PANEL_TYPE);
  const { savedProps } = state.persistedState.panels;
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
  let newPanelsState = changePanelLayout(state.persistedState.panels, {
    layout: newLayout ?? "",
    trimSavedProps: false,
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
  return {
    ...state,
    mosaic: { ...state.mosaic, selectedPanelIds: [newId] },
    persistedState: { ...state.persistedState, panels: newPanelsState },
  };
};

export const createTabPanelWithMultipleTabs = (
  state: State,
  { idToReplace, layout, idsToRemove }: CreateTabPanelPayload,
): State => {
  const { savedProps } = state.persistedState.panels;
  const newId = getPanelIdForType(TAB_PANEL_TYPE);
  const newLayout = replaceAndRemovePanels({ originalId: idToReplace, newId, idsToRemove }, layout);
  let newPanelsState = changePanelLayout(
    { ...state.persistedState.panels },
    { layout: newLayout ?? "", trimSavedProps: false },
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

  return {
    ...state,
    mosaic: { ...state.mosaic, selectedPanelIds: [newId] },
    persistedState: { ...state.persistedState, panels: newPanelsState },
  };
};

function importPanelLayout(state: PanelsState, payload: ImportPanelLayoutPayload): PanelsState {
  try {
    const newPanelsState = {
      ...payload,
      layout: payload.layout,
      savedProps: payload.savedProps ?? {},
      globalVariables: payload.globalVariables ?? {},
      userNodes: payload.userNodes ?? {},
      linkedGlobalVariables: payload.linkedGlobalVariables ?? [],
      playbackConfig: payload.playbackConfig ?? defaultPlaybackConfig,
    };

    return newPanelsState;
  } catch (err) {
    return state;
  }
}

const moveTab = (panelsState: PanelsState, { source, target }: MoveTabPayload): PanelsState => {
  const saveConfigsPayload =
    source.panelId === target.panelId
      ? reorderTabWithinTabPanel({ source, target, savedProps: panelsState.savedProps })
      : moveTabBetweenTabPanels({ source, target, savedProps: panelsState.savedProps });
  return savePanelConfigs(panelsState, saveConfigsPayload);
};

const addPanel = (
  panelsState: PanelsState,
  { tabId, layout, id, config, relatedConfigs }: AddPanelPayload,
) => {
  let newPanelsState = { ...panelsState };
  let saveConfigsPayload: { configs: ConfigsPayload[] } = { configs: [] };
  if (config) {
    saveConfigsPayload = getSaveConfigsPayloadForAddedPanel({ id, config, relatedConfigs });
  }
  const fixedLayout = isEmpty(layout)
    ? id
    : ({ direction: "row", first: id, second: layout } as MosaicParent<string>);
  const changeLayoutPayload = {
    layout: fixedLayout,
    trimSavedProps: !relatedConfigs,
  };
  if (tabId != undefined && typeof changeLayoutPayload.layout === "string") {
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        {
          id: tabId,
          config: updateTabPanelLayout(changeLayoutPayload.layout, {
            ...DEFAULT_TAB_PANEL_CONFIG,
            ...panelsState.savedProps[tabId],
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
      panelsState.savedProps[tabId],
      tabId,
    );
    configs.push(...newConfigs);
  }

  const newLayout =
    tabId != undefined
      ? panelsState.layout
      : updateTree<string>(
          panelsState.layout!,
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
    trimSavedProps: !relatedConfigs,
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
      trimSavedProps: false,
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
      trimSavedProps: false,
    });
    newPanelsState = savePanelConfigs(newPanelsState, {
      configs: [
        {
          id: sourceTabId,
          config: updateTabPanelLayout(
            newTree,
            panelsState.savedProps[sourceTabId] as TabPanelConfig,
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
    sourceTabConfig: PanelConfig;
    sourceTabChildConfigs: ConfigsPayload[];
  },
): PanelsState => {
  const currentTabLayout = sourceTabConfig.tabs[sourceTabConfig.activeTabIdx].layout;
  // Remove panel from tab layout
  const saveConfigsPayload = removePanelFromTabPanel(
    ownPath,
    panelsState.savedProps[sourceTabId] as TabPanelConfig,
    sourceTabId,
  );
  const panelConfigs = {
    ...saveConfigsPayload,
    configs: [...saveConfigsPayload.configs, ...sourceTabChildConfigs],
  };

  // Insert it into main layout
  const currentNode = getNodeAtPath(currentTabLayout, ownPath);
  const newLayout = updateTree(
    originalLayout,
    createAddUpdates(originalLayout, currentNode, destinationPath, position),
  );

  let newPanelsState = changePanelLayout(panelsState, { layout: newLayout, trimSavedProps: false });
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
  let newPanelsState = changePanelLayout(panelsState, { layout: newLayout, trimSavedProps: false });
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
    trimSavedProps: false,
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
  if (path.length > 0) {
    if (sourceTabId != undefined) {
      const tabConfig = panelsState.savedProps[sourceTabId] as TabPanelConfig;
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
      trimSavedProps: false,
    });
  } else if (sourceTabId != undefined) {
    // If we've dragged a panel from a single panel tab layout, remove that panel
    const sourceTabConfig = panelsState.savedProps[sourceTabId] as TabPanelConfig;
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
    (sourceTabId !== undefined && getPanelIdsInsideTabPanels([sourceTabId], originalSavedProps)) ||
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
    return changePanelLayout(panelsState, { layout: originalLayout, trimSavedProps: false });
  }

  if (position != undefined && destinationPath != undefined && !isEqual(destinationPath, ownPath)) {
    const updates = createDragToUpdates(originalLayout, ownPath, destinationPath, position);
    const newLayout = updateTree(originalLayout, updates);
    return changePanelLayout(panelsState, { layout: newLayout, trimSavedProps: false });
  }

  const newLayout = updateTree(originalLayout, [
    { path: dropRight(ownPath), spec: { splitPercentage: { $set: undefined } } },
  ]);
  return changePanelLayout(panelsState, { layout: newLayout, trimSavedProps: false });
};

const panelsReducer = function (state: State, action: ActionTypes): State {
  // Make a copy of the persistedState before mutation.
  // Only return the copy if we mutated persistedState, otherwise we return the old state
  let newState = {
    ...state,
    persistedState: { ...state.persistedState, panels: { ...state.persistedState.panels } },
  };

  // Any action that changes panels state should potentially trigger a URL update in updateUrlMiddlewareDebounced.
  switch (action.type) {
    case "CHANGE_PANEL_LAYOUT":
      // don't allow the last panel to be removed
      newState.persistedState.panels = changePanelLayout(
        newState.persistedState.panels,
        action.payload,
      );
      break;

    case "SAVE_PANEL_CONFIGS":
      newState.persistedState.panels = savePanelConfigs(
        newState.persistedState.panels,
        action.payload,
      );
      break;

    case "SAVE_FULL_PANEL_CONFIG":
      newState.persistedState.panels = saveFullPanelConfig(
        newState.persistedState.panels,
        action.payload,
      );
      break;

    case "CREATE_TAB_PANEL":
      newState = action.payload.singleTab
        ? createTabPanelWithSingleTab(newState, action.payload)
        : createTabPanelWithMultipleTabs(newState, action.payload);
      break;

    case "IMPORT_PANEL_LAYOUT":
      newState.persistedState.panels = importPanelLayout(
        newState.persistedState.panels,
        action.payload,
      );
      break;

    case "OVERWRITE_GLOBAL_DATA":
      newState.persistedState.panels.globalVariables = action.payload;
      break;

    case "SET_GLOBAL_DATA": {
      const globalVariables = {
        ...newState.persistedState.panels.globalVariables,
        ...action.payload,
      };
      Object.keys(globalVariables).forEach((key) => {
        if (globalVariables[key] === undefined) {
          delete globalVariables[key];
        }
      });
      newState.persistedState.panels.globalVariables = globalVariables;
      break;
    }

    case "SET_USER_NODES": {
      const userNodes = { ...newState.persistedState.panels.userNodes, ...action.payload };
      Object.keys(action.payload).forEach((key) => {
        if (userNodes[key] === undefined) {
          delete userNodes[key];
        }
      });
      newState.persistedState.panels.userNodes = userNodes;
      break;
    }

    case "SET_LINKED_GLOBAL_VARIABLES":
      newState.persistedState.panels.linkedGlobalVariables = action.payload;
      break;

    case "SET_PLAYBACK_CONFIG":
      newState.persistedState.panels.playbackConfig = {
        ...newState.persistedState.panels.playbackConfig,
        ...action.payload,
      };
      break;

    case "CLOSE_PANEL": {
      newState.persistedState.panels = closePanel(newState.persistedState.panels, action.payload);
      // Deselect the removed panel
      const removedId = getNodeAtPath(action.payload.root, action.payload.path);
      newState.mosaic.selectedPanelIds = newState.mosaic.selectedPanelIds.filter(
        (id) => id !== removedId,
      );
      break;
    }

    case "SPLIT_PANEL":
      newState.persistedState.panels = splitPanel(state, action.payload);
      break;

    case "SWAP_PANEL":
      newState.persistedState.panels = swapPanel(state, action.payload);
      break;

    case "MOVE_TAB":
      newState.persistedState.panels = moveTab(newState.persistedState.panels, action.payload);
      break;

    case "ADD_PANEL":
      newState.persistedState.panels = addPanel(newState.persistedState.panels, action.payload);
      break;

    case "DROP_PANEL":
      newState.persistedState.panels = dropPanel(newState.persistedState.panels, action.payload);
      break;

    case "START_DRAG":
      newState.persistedState.panels = startDrag(newState.persistedState.panels, action.payload);
      break;

    case "END_DRAG":
      newState.persistedState.panels = endDrag(newState.persistedState.panels, action.payload);
      break;

    case "LOAD_LAYOUT":
      // Dispatched when loading the page with a layout query param, or when manually selecting a different layout.
      // Do not update URL based on ensuing migration changes.
      newState.persistedState.panels = importPanelLayout(
        newState.persistedState.panels,
        action.payload,
      );
      break;

    default:
      // avoid returning a copy of the state if we did not handle the action
      return state;
  }

  return newState;
};

export default panelsReducer;

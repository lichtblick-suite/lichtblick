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

import BorderAllIcon from "@mdi/svg/svg/border-all.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import ExpandAllOutlineIcon from "@mdi/svg/svg/expand-all-outline.svg";
import FullscreenIcon from "@mdi/svg/svg/fullscreen.svg";
import GridLargeIcon from "@mdi/svg/svg/grid-large.svg";
import TrashCanOutlineIcon from "@mdi/svg/svg/trash-can-outline.svg";
import cx from "classnames";
import { last, without, xor } from "lodash";
import React, { useState, useCallback, useContext, useMemo, useRef, ComponentType } from "react";
import DocumentEvents from "react-document-events";
import {
  MosaicContext,
  MosaicRootActions,
  MosaicWindowActions,
  MosaicWindowContext,
  getNodeAtPath,
  getOtherBranch,
  getPathFromNode,
  isParent,
  updateTree,
} from "react-mosaic-component";
import { useSelector, useDispatch } from "react-redux";
import { bindActionCreators } from "redux";

import styles from "./Panel.module.scss";
import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import {
  addSelectedPanelId,
  removeSelectedPanelId,
  setSelectedPanelIds,
  selectAllPanelIds,
} from "@foxglove-studio/app/actions/mosaic";
import {
  savePanelConfigs,
  saveFullPanelConfig,
  changePanelLayout,
  createTabPanel,
} from "@foxglove-studio/app/actions/panels";
import Button from "@foxglove-studio/app/components/Button";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import MosaicDragHandle from "@foxglove-studio/app/components/PanelToolbar/MosaicDragHandle";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import PanelList, { getPanelsByType } from "@foxglove-studio/app/panels/PanelList";
import { Topic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { TabPanelConfig } from "@foxglove-studio/app/types/layouts";
import {
  CreateTabPanelPayload,
  EditHistoryOptions,
  SaveConfigsPayload,
  SaveFullConfigPayload,
  PanelConfig,
  SaveConfig,
} from "@foxglove-studio/app/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove-studio/app/util/globalConstants";
import {
  getAllPanelIds,
  getPanelIdForType,
  getPanelTypeFromId,
  getParentTabPanelByPanelId,
  isTabPanel,
  updateTabPanelLayout,
} from "@foxglove-studio/app/util/layout";
import logEvent, { getEventTags, getEventNames } from "@foxglove-studio/app/util/logEvent";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

type Props<Config> = {
  childId?: string;
  config?: Config;
  saveConfig?: (arg0: Config) => void;
  tabId?: string;
};
type ActionProps = {
  savePanelConfigs: (arg0: SaveConfigsPayload) => void;
  saveFullPanelConfig: (arg0: SaveFullConfigPayload) => PanelConfig;
  changePanelLayout: (panels: any) => void;
  addSelectedPanelId: (panelId: string) => void;
  removeSelectedPanelId: (panelId: string) => void;
  setSelectedPanelIds: (panelIds: string[]) => void;
  selectAllPanelIds: () => void;
  createTabPanel: (arg0: CreateTabPanelPayload) => void;
};
interface PanelStatics<Config> {
  panelType: string;
  defaultConfig: Config;
}

const EMPTY_CONFIG = Object.freeze({});

// HOC that wraps panel in an error boundary and flex box.
// Gives panel a `config` and `saveConfig`.
//   export default Panel(MyPanelComponent)
//
// `config` comes from Redux, but in stories / tests you can pass in your own:
//   `<MyPanel config={…} />`
export default function Panel<Config extends PanelConfig>(
  PanelComponent: (
    | ComponentType
    | ComponentType<
        Partial<{
          config: Config;
          saveConfig: SaveConfig<Config>;
          openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
          topics: Topic[];
          capabilities: string[];
          datatypes: RosDatatypes;
          isHovered: boolean;
        }>
      >
  ) &
    PanelStatics<Config>, // TODO(JP): Add `& PanelStatics<Config>` to the return type when we have figured out
  // https://stackoverflow.com/questions/52508434/adding-static-variable-to-union-of-class-types
): ComponentType<Props<Config>> & PanelStatics<Config> {
  function ConnectedPanel(props: Props<Config>) {
    const { childId, config: originalConfig, saveConfig, tabId } = props;
    const { mosaicActions }: { mosaicActions: MosaicRootActions<any> } = useContext(MosaicContext);
    const { mosaicWindowActions }: { mosaicWindowActions: MosaicWindowActions } = useContext(
      MosaicWindowContext,
    );

    const layout = useSelector((state: any) => state.persistedState.panels.layout);
    const savedProps = useSelector((state: any) => state.persistedState.panels.savedProps);
    const stableSavedProps = useRef(savedProps);
    stableSavedProps.current = savedProps;
    const selectedPanelIds = useSelector((state: any) => state.mosaic.selectedPanelIds);
    const isSelected = selectedPanelIds.includes(childId);
    const isFocused = selectedPanelIds.length === 1 && selectedPanelIds[0] === childId; // the current panel is the only selected panel

    const isOnlyPanel = useMemo(() => (tabId ? false : !isParent(layout)), [layout, tabId]);
    const config = savedProps[childId as any] || originalConfig || EMPTY_CONFIG;

    const { topics, datatypes, capabilities } = PanelAPI.useDataSourceInfo();
    const dispatch = useDispatch();
    const actions: ActionProps = useMemo(
      () =>
        bindActionCreators(
          {
            savePanelConfigs,
            saveFullPanelConfig,
            changePanelLayout,
            addSelectedPanelId,
            removeSelectedPanelId,
            setSelectedPanelIds,
            selectAllPanelIds,
            createTabPanel,
          },
          dispatch,
        ),
      [dispatch],
    );

    const [quickActionsKeyPressed, setQuickActionsKeyPressed] = useState(false);
    const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
    const [cmdKeyPressed, setCmdKeyPressed] = useState(false);
    const [fullScreen, setFullScreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [fullScreenLocked, setFullScreenLocked] = useState(false);

    const panelsByType = useMemo(() => getPanelsByType(), []);
    const type = PanelComponent.panelType;
    const title = useMemo(() => panelsByType[type]?.title, [panelsByType, type]);
    const panelComponentConfig = useMemo(() => ({ ...PanelComponent.defaultConfig, ...config }), [
      config,
    ]);

    // Mix partial config with current config or `defaultConfig`
    const saveCompleteConfig = useCallback(
      (
        configToSave: Partial<Config>,
        options: { historyOptions?: EditHistoryOptions } | undefined,
      ) => {
        if (saveConfig) {
          saveConfig(configToSave as any);
        }
        if (childId) {
          actions.savePanelConfigs({
            configs: [
              { id: childId, config: configToSave, defaultConfig: PanelComponent.defaultConfig },
            ],
            historyOptions: options?.historyOptions,
          });
        }
      },
      [actions, childId, saveConfig],
    );

    const updatePanelConfig = useCallback(
      (
        panelType: string,
        perPanelFunc: (arg0: PanelConfig) => PanelConfig,
        historyOptions?: EditHistoryOptions,
      ) => {
        actions.saveFullPanelConfig({ panelType, perPanelFunc, historyOptions });
      },
      [actions],
    );

    // Open a panel next to the current panel, of the specified `panelType`.
    // If such a panel already exists, we update it with the new props.
    const openSiblingPanel = useCallback(
      (panelType: string, siblingConfigCreator: (arg0: PanelConfig) => PanelConfig) => {
        const siblingComponent = PanelList.getComponentForType(panelType);
        if (!siblingComponent) {
          return;
        }
        const siblingDefaultConfig = siblingComponent.defaultConfig;
        const ownPath = mosaicWindowActions.getPath();

        // Try to find a sibling summary panel and update it with the `siblingConfig`
        const siblingPathEnd = last(ownPath) ? getOtherBranch(last(ownPath) as any) : "second";
        const siblingPath = ownPath.slice(0, -1).concat(siblingPathEnd);
        const siblingId = getNodeAtPath(mosaicActions.getRoot(), siblingPath);
        if (typeof siblingId === "string" && getPanelTypeFromId(siblingId) === panelType) {
          const siblingConfig: PanelConfig = {
            ...siblingDefaultConfig,
            ...stableSavedProps.current[siblingId],
          };
          actions.savePanelConfigs({
            configs: [
              {
                id: siblingId,
                config: siblingConfigCreator(siblingConfig),
                defaultConfig: siblingDefaultConfig,
              },
            ],
          });
          return;
        }

        // Otherwise, open new panel
        const newPanelPath = ownPath.concat("second");
        mosaicWindowActions.split({ type: panelType }).then(() => {
          const newPanelId = getNodeAtPath(mosaicActions.getRoot(), newPanelPath);
          actions.savePanelConfigs({
            configs: [
              {
                id: newPanelId,
                config: siblingConfigCreator(siblingDefaultConfig),
                defaultConfig: siblingDefaultConfig,
              },
            ],
          });
        });
      },
      [actions, mosaicActions, mosaicWindowActions],
    );

    const selectPanel = useCallback(
      (panelId: string, toggleSelection: boolean) => {
        const panelIdsToDeselect = [];

        // If we selected a Tab panel, deselect its children
        const savedConfig = savedProps[panelId];
        if (isTabPanel(panelId) && savedConfig) {
          const { activeTabIdx, tabs } = savedConfig as TabPanelConfig;
          const activeTabLayout = tabs[activeTabIdx]?.layout;
          if (activeTabLayout) {
            const childrenPanelIds = getAllPanelIds(activeTabLayout, savedProps);
            panelIdsToDeselect.push(...childrenPanelIds);
          }
        }

        // If we selected a child, deselect all parent Tab panels
        const parentTabPanelByPanelId = getParentTabPanelByPanelId(savedProps);
        let nextParentId = tabId;
        const parentTabPanelIds = [];
        while (nextParentId) {
          parentTabPanelIds.push(nextParentId);
          nextParentId = parentTabPanelByPanelId[nextParentId];
        }
        panelIdsToDeselect.push(...parentTabPanelIds);

        const nextSelectedPanelIds = toggleSelection ? xor(selectedPanelIds, [panelId]) : [panelId];
        const nextValidSelectedPanelIds = without(nextSelectedPanelIds, ...panelIdsToDeselect);
        actions.setSelectedPanelIds(nextValidSelectedPanelIds);

        // Deselect any text that was selected due to holding the shift key while clicking
        if (nextValidSelectedPanelIds.length >= 2) {
          (window.getSelection() as any).removeAllRanges();
        }
      },
      [actions, savedProps, selectedPanelIds, tabId],
    );

    const onOverlayClick = useCallback(
      (e) => {
        if (!fullScreen && quickActionsKeyPressed) {
          setFullScreen(true);
          if (shiftKeyPressed) {
            setFullScreenLocked(true);
          }
          return;
        }

        if (childId) {
          e.stopPropagation();
          const toggleSelection = e.metaKey || shiftKeyPressed;
          selectPanel(childId, toggleSelection);
        }
      },
      [childId, fullScreen, quickActionsKeyPressed, selectPanel, shiftKeyPressed],
    );

    const groupPanels = useCallback(() => {
      actions.createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: selectedPanelIds,
        singleTab: true,
      });
    }, [actions, childId, layout, selectedPanelIds]);

    const createTabs = useCallback(() => {
      actions.createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: selectedPanelIds,
        singleTab: false,
      });
    }, [actions, childId, layout, selectedPanelIds]);

    const { closePanel, splitPanel } = useMemo(
      () => ({
        closePanel: () => {
          logEvent({
            name: getEventNames().PANEL_REMOVE,
            tags: { [getEventTags().PANEL_TYPE]: type },
          });
          mosaicActions.remove(mosaicWindowActions.getPath());
        },
        splitPanel: () => {
          if (tabId) {
            const newId = getPanelIdForType(PanelComponent.panelType);
            const activeTabLayout = savedProps[tabId].tabs[savedProps[tabId].activeTabIdx].layout;
            const pathToPanelInTab = getPathFromNode(childId, activeTabLayout);
            const newTabLayout = updateTree(activeTabLayout, [
              {
                path: pathToPanelInTab,
                spec: { $set: { first: childId, second: newId, direction: "row" } },
              },
            ]);
            const newTabConfig = updateTabPanelLayout(newTabLayout, savedProps[tabId]);
            actions.savePanelConfigs({
              configs: [
                { id: tabId, config: newTabConfig },
                { id: newId, config },
              ],
            });
          } else {
            mosaicWindowActions.split({ type: PanelComponent.panelType });
          }
          logEvent({
            name: getEventNames().PANEL_SPLIT,
            tags: { [getEventTags().PANEL_TYPE]: type },
          });
        },
      }),
      [actions, childId, config, mosaicActions, mosaicWindowActions, savedProps, tabId, type],
    );

    const { onMouseEnter, onMouseLeave, onMouseMove, enterFullscreen, exitFullScreen } = useMemo(
      () => ({
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onMouseMove: (e: any) => {
          if (e.metaKey !== cmdKeyPressed) {
            setCmdKeyPressed(e.metaKey);
          }
        },
        enterFullscreen: () => {
          setFullScreen(true);
          setFullScreenLocked(true);
        },
        exitFullScreen: () => {
          setFullScreen(false);
          setFullScreenLocked(false);
        },
      }),
      [cmdKeyPressed],
    );

    const onReleaseQuickActionsKey = useCallback(() => {
      setQuickActionsKeyPressed(false);
      if (fullScreen && !fullScreenLocked) {
        exitFullScreen();
      }
    }, [exitFullScreen, fullScreen, fullScreenLocked]);

    const { keyUpHandlers, keyDownHandlers } = useMemo(
      () => ({
        keyUpHandlers: {
          "`": () => onReleaseQuickActionsKey(),
          "~": () => onReleaseQuickActionsKey(),
          Shift: () => setShiftKeyPressed(false),
          Meta: () => setCmdKeyPressed(false),
        },
        keyDownHandlers: {
          a: (e: any) => {
            e.preventDefault();
            if (cmdKeyPressed) {
              actions.selectAllPanelIds();
            }
          },
          "`": () => setQuickActionsKeyPressed(true),
          "~": () => setQuickActionsKeyPressed(true),
          Shift: () => setShiftKeyPressed(true),
          Escape: () => exitFullScreen(),
          Meta: () => setCmdKeyPressed(true),
        },
      }),
      [actions, cmdKeyPressed, exitFullScreen, onReleaseQuickActionsKey],
    );

    const onBlurDocument = useCallback(() => {
      exitFullScreen();
      setCmdKeyPressed(false);
      setShiftKeyPressed(false);
      onReleaseQuickActionsKey();
    }, [exitFullScreen, onReleaseQuickActionsKey]);

    const child = useMemo(
      () => (
        <PanelComponent
          config={panelComponentConfig}
          saveConfig={saveCompleteConfig}
          openSiblingPanel={openSiblingPanel}
          topics={[...topics]}
          datatypes={datatypes}
          capabilities={capabilities}
          isHovered={isHovered}
        />
      ),
      [
        panelComponentConfig,
        saveCompleteConfig,
        openSiblingPanel,
        topics,
        datatypes,
        capabilities,
        isHovered,
      ],
    );

    const isDemoMode = useExperimentalFeature("demoMode");
    return (
      <PanelContext.Provider
        value={{
          type,
          id: childId as any,
          title,
          config,
          saveConfig: saveCompleteConfig as any,
          updatePanelConfig,
          openSiblingPanel,
          enterFullscreen,
          isHovered,
          isFocused,
          tabId,
        }}
      >
        {/* Ensure user exits full-screen mode when leaving window, even if key is still pressed down */}
        <DocumentEvents target={window} enabled onBlur={onBlurDocument} />
        <KeyListener global keyUpHandlers={keyUpHandlers} keyDownHandlers={keyDownHandlers} />
        <Flex
          onClick={onOverlayClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onMouseMove={onMouseMove}
          className={cx({
            [styles.root]: true,
            [styles.rootFullScreen]: fullScreen,
            [styles.selected]: isSelected && !isDemoMode,
          })}
          col
          dataTest={`panel-mouseenter-container ${childId || ""}`}
          clip
        >
          {fullScreen && <div className={styles.notClickable} />}
          {isSelected && !fullScreen && selectedPanelIds.length > 1 && (
            <div data-tab-options className={styles.tabActionsOverlay}>
              <Button style={{ backgroundColor: colors.BLUE }} onClick={groupPanels}>
                <Icon small style={{ marginBottom: 5 }}>
                  <BorderAllIcon />
                </Icon>
                Group in tab
              </Button>
              <Button style={{ backgroundColor: colors.BLUE }} onClick={createTabs}>
                <Icon small style={{ marginBottom: 5 }}>
                  <ExpandAllOutlineIcon />
                </Icon>
                Create {selectedPanelIds.length} tabs
              </Button>
            </div>
          )}
          {type !== TAB_PANEL_TYPE && quickActionsKeyPressed && !fullScreen && (
            <div className={styles.quickActionsOverlay} data-panel-overlay>
              <MosaicDragHandle tabId={tabId}>
                <>
                  <div>
                    <FullscreenIcon />
                    {shiftKeyPressed ? "Lock fullscreen" : "Fullscreen (Shift+click to lock)"}
                  </div>
                  <div>
                    <Button onClick={closePanel} disabled={isOnlyPanel}>
                      <TrashCanOutlineIcon />
                      Remove
                    </Button>
                    <Button onClick={splitPanel}>
                      <GridLargeIcon />
                      Split
                    </Button>
                  </div>
                  {!isOnlyPanel && <p>Drag to move</p>}
                </>
              </MosaicDragHandle>
            </div>
          )}
          {fullScreen && (
            <button
              className={styles.exitFullScreen}
              onClick={exitFullScreen}
              data-panel-overlay-exit
            >
              <CloseIcon /> <span>Exit fullscreen</span>
            </button>
          )}
          <ErrorBoundary>{child}</ErrorBoundary>
        </Flex>
      </PanelContext.Provider>
    );
  }
  ConnectedPanel.displayName = `Panel(${PanelComponent.displayName || PanelComponent.name || ""})`;

  return Object.assign(React.memo(ConnectedPanel), {
    defaultConfig: PanelComponent.defaultConfig,
    panelType: PanelComponent.panelType,
  });
}

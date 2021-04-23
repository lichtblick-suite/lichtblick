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
import React, {
  useState,
  useCallback,
  useContext,
  useMemo,
  useRef,
  ComponentType,
  Profiler,
} from "react";
import DocumentEvents from "react-document-events";
import {
  MosaicContext,
  MosaicRootActions,
  MosaicWindowActions,
  MosaicWindowContext,
  getNodeAtPath,
  getOtherBranch,
  isParent,
  updateTree,
} from "react-mosaic-component";
import { useSelector, useDispatch, useStore } from "react-redux";
import { bindActionCreators } from "redux";
import styled from "styled-components";

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
import { usePanelCatalog } from "@foxglove-studio/app/context/PanelCatalogContext";
import { State } from "@foxglove-studio/app/reducers";
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
  getPathFromNode,
  isTabPanel,
  updateTabPanelLayout,
} from "@foxglove-studio/app/util/layout";
import logEvent, { getEventTags, getEventNames } from "@foxglove-studio/app/util/logEvent";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

import styles from "./Panel.module.scss";

const PerfInfo = styled.div`
  position: absolute;
  white-space: pre-line;
  bottom: 2px;
  left: 2px;
  font-size: 9px;
  opacity: 0.5;
  user-select: none;
`;

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

export interface PanelStatics<Config> {
  panelType: string;
  defaultConfig: Config;
  supportsStrictMode?: boolean;
}

const EMPTY_CONFIG = Object.freeze({});

// Like React.ComponentType<P>, but without restrictions on the constructor return type.
type ComponentConstructorType<P> = { displayName?: string } & (
  | { new (props: P): React.Component<unknown, unknown> }
  | { (props: P): React.ReactElement<unknown> | ReactNull }
);

// HOC that wraps panel in an error boundary and flex box.
// Gives panel a `config` and `saveConfig`.
//   export default Panel(MyPanelComponent)
//
// `config` comes from Redux, but in stories / tests you can pass in your own:
//   `<MyPanel config={…} />`
export default function Panel<Config extends PanelConfig>(
  PanelComponent: ComponentConstructorType<{
    config: Config;
    saveConfig: SaveConfig<Config>;
  }> &
    PanelStatics<Config>,
): ComponentType<Props<Config>> & PanelStatics<Config> {
  function ConnectedPanel(props: Props<Config>) {
    const { childId, config: originalConfig, saveConfig, tabId } = props;
    const { mosaicActions }: { mosaicActions: MosaicRootActions<any> } = useContext(MosaicContext);
    const { mosaicWindowActions }: { mosaicWindowActions: MosaicWindowActions } = useContext(
      MosaicWindowContext,
    );

    // Used by actions that need to operate on the current state without causing the panel to
    // re-render by subscribing to various unnecessary parts of the state.
    const store = useStore<State>();

    const isSelected = useSelector(
      (state: State) => childId != undefined && state.mosaic.selectedPanelIds.includes(childId),
    );
    const numSelectedPanelsIfSelected = useSelector((state: State) =>
      isSelected ? state.mosaic.selectedPanelIds.length : 0,
    );
    const isFocused = useSelector(
      // the current panel is the only selected panel
      (state: State) =>
        childId != undefined &&
        state.mosaic.selectedPanelIds.length === 1 &&
        state.mosaic.selectedPanelIds[0] === childId,
    );

    const isOnlyPanel = useSelector((state: State) =>
      tabId != undefined || state.persistedState.panels.layout == undefined
        ? false
        : !isParent(state.persistedState.panels.layout),
    );
    const config = useSelector(
      (state: State) =>
        (childId == undefined ? undefined : state.persistedState.panels.savedProps[childId]) ??
        originalConfig ??
        EMPTY_CONFIG,
    );

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
    const panelCatalog = usePanelCatalog();

    const panelsByType = useMemo(() => panelCatalog.getPanelsByType(), [panelCatalog]);
    const type = PanelComponent.panelType;
    const title = useMemo(() => panelsByType.get(type)?.title ?? "", [panelsByType, type]);
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
        if (childId != undefined) {
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
        const siblingComponent = panelCatalog.getComponentForType(panelType);
        if (!siblingComponent) {
          return;
        }
        const siblingDefaultConfig = siblingComponent.defaultConfig;
        const ownPath = mosaicWindowActions.getPath();

        // Try to find a sibling summary panel and update it with the `siblingConfig`
        const lastNode = last(ownPath);
        const siblingPathEnd = lastNode != undefined ? getOtherBranch(lastNode) : "second";
        const siblingPath = ownPath.slice(0, -1).concat(siblingPathEnd);
        const siblingId = getNodeAtPath(mosaicActions.getRoot(), siblingPath);
        if (typeof siblingId === "string" && getPanelTypeFromId(siblingId) === panelType) {
          const siblingConfig: PanelConfig = {
            ...siblingDefaultConfig,
            ...store.getState().persistedState.panels.savedProps[siblingId],
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
      [store, actions, mosaicActions, mosaicWindowActions, panelCatalog],
    );

    const togglePanelSelected = useCallback(
      (panelId: string) => {
        const panelIdsToDeselect = [];
        const savedProps = store.getState().persistedState.panels.savedProps;
        const selectedPanelIds = store.getState().mosaic.selectedPanelIds;

        // If we selected a Tab panel, deselect its children
        const savedConfig = savedProps[panelId];
        if (isTabPanel(panelId) && savedConfig) {
          const { activeTabIdx, tabs } = savedConfig as TabPanelConfig;
          const activeTabLayout = tabs[activeTabIdx]?.layout;
          if (activeTabLayout != undefined) {
            const childrenPanelIds = getAllPanelIds(activeTabLayout, savedProps);
            panelIdsToDeselect.push(...childrenPanelIds);
          }
        }

        // If we selected a child, deselect all parent Tab panels
        const parentTabPanelByPanelId = getParentTabPanelByPanelId(savedProps);
        let nextParentId = tabId;
        const parentTabPanelIds = [];
        while (nextParentId != undefined) {
          parentTabPanelIds.push(nextParentId);
          nextParentId = parentTabPanelByPanelId[nextParentId];
        }
        panelIdsToDeselect.push(...parentTabPanelIds);

        const nextSelectedPanelIds = xor(selectedPanelIds, [panelId]);
        const nextValidSelectedPanelIds = without(nextSelectedPanelIds, ...panelIdsToDeselect);
        actions.setSelectedPanelIds(nextValidSelectedPanelIds);

        // Deselect any text that was selected due to holding the shift key while clicking
        if (nextValidSelectedPanelIds.length >= 2) {
          (window.getSelection() as any).removeAllRanges();
        }
      },
      [store, actions, tabId],
    );

    const onOverlayClick = useCallback(
      (e: MouseEvent) => {
        if (!fullScreen && quickActionsKeyPressed) {
          setFullScreen(true);
          if (shiftKeyPressed) {
            setFullScreenLocked(true);
          }
          return;
        }

        if (childId != undefined && (e.metaKey || shiftKeyPressed || isSelected)) {
          e.stopPropagation();
          togglePanelSelected(childId);
        }
      },
      [
        childId,
        fullScreen,
        quickActionsKeyPressed,
        togglePanelSelected,
        shiftKeyPressed,
        isSelected,
      ],
    );

    const groupPanels = useCallback(() => {
      const layout = store.getState().persistedState.panels.layout;
      const selectedPanelIds = store.getState().mosaic.selectedPanelIds;
      if (layout == undefined) {
        return;
      }
      actions.createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: selectedPanelIds,
        singleTab: true,
      });
    }, [store, actions, childId]);

    const createTabs = useCallback(() => {
      const layout = store.getState().persistedState.panels.layout;
      const selectedPanelIds = store.getState().mosaic.selectedPanelIds;
      if (layout == undefined) {
        return;
      }
      actions.createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: selectedPanelIds,
        singleTab: false,
      });
    }, [store, actions, childId]);

    const closePanel = useCallback(() => {
      const name = getEventNames().PANEL_REMOVE;
      const eventType = getEventTags().PANEL_TYPE;
      if (name != undefined && eventType !== undefined) {
        logEvent({
          name,
          tags: { [eventType]: type },
        });
      }
      mosaicActions.remove(mosaicWindowActions.getPath());
    }, [mosaicActions, mosaicWindowActions, type]);

    const splitPanel = useCallback(() => {
      const savedProps = store.getState().persistedState.panels.savedProps;
      const tabSavedProps = tabId != undefined ? (savedProps[tabId] as TabPanelConfig) : undefined;
      if (tabId != undefined && tabSavedProps != undefined && childId != undefined) {
        const newId = getPanelIdForType(PanelComponent.panelType);
        const activeTabLayout = tabSavedProps.tabs[tabSavedProps.activeTabIdx]?.layout;
        if (activeTabLayout == undefined) {
          return;
        }
        const pathToPanelInTab = getPathFromNode(childId, activeTabLayout);
        const newTabLayout = updateTree(activeTabLayout, [
          {
            path: pathToPanelInTab,
            spec: { $set: { first: childId, second: newId, direction: "row" } },
          },
        ]);
        const newTabConfig = updateTabPanelLayout(newTabLayout, tabSavedProps);
        actions.savePanelConfigs({
          configs: [
            { id: tabId, config: newTabConfig },
            { id: newId, config },
          ],
        });
      } else {
        mosaicWindowActions.split({ type: PanelComponent.panelType });
      }
      const name = getEventNames().PANEL_SPLIT;
      const eventType = getEventTags().PANEL_TYPE;
      if (name != undefined && eventType !== undefined) {
        logEvent({
          name,
          tags: { [eventType]: type },
        });
      }
    }, [actions, childId, config, mosaicWindowActions, store, tabId, type]);

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
      () => <PanelComponent config={panelComponentConfig} saveConfig={saveCompleteConfig} />,
      [panelComponentConfig, saveCompleteConfig],
    );

    const isDemoMode = useExperimentalFeature("demoMode");
    const renderCount = useRef(0);
    const perfInfo = useRef<HTMLDivElement>(ReactNull);
    return (
      <Profiler
        id={childId ?? "$unknown_id"}
        onRender={(
          id,
          phase,
          actualDuration,
          _baseDuration,
          _startTime,
          _commitTime,
          _interactions,
        ) => {
          if (perfInfo.current) {
            perfInfo.current.innerText = `${++renderCount.current}\n${actualDuration.toFixed(1)}ms`;
          }
        }}
      >
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
            supportsStrictMode: PanelComponent.supportsStrictMode ?? true,
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
              [styles.root!]: true,
              [styles.rootFullScreen!]: fullScreen,
              [styles.selected!]: isSelected && !isDemoMode,
            })}
            col
            dataTest={`panel-mouseenter-container ${childId ?? ""}`}
            clip
          >
            {fullScreen && <div className={styles.notClickable} />}
            {isSelected && !fullScreen && numSelectedPanelsIfSelected > 1 && (
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
                  Create {numSelectedPanelsIfSelected} tabs
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
            <ErrorBoundary>
              {PanelComponent.supportsStrictMode ?? true ? (
                <React.StrictMode>{child}</React.StrictMode>
              ) : (
                child
              )}
            </ErrorBoundary>
            {process.env.NODE_ENV !== "production" && <PerfInfo ref={perfInfo} />}
          </Flex>
        </PanelContext.Provider>
      </Profiler>
    );
  }
  ConnectedPanel.displayName = `Panel(${PanelComponent.displayName ?? PanelComponent.name})`;

  return Object.assign(React.memo(ConnectedPanel), {
    defaultConfig: PanelComponent.defaultConfig,
    panelType: PanelComponent.panelType,
  });
}

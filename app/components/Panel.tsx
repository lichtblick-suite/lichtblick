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

import { useConfigById } from "@foxglove-studio/app/PanelAPI";
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
  closePanel,
} from "@foxglove-studio/app/actions/panels";
import Button from "@foxglove-studio/app/components/Button";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import MultiProvider from "@foxglove-studio/app/components/MultiProvider";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import { usePanelCatalog } from "@foxglove-studio/app/context/PanelCatalogContext";
import { PanelIdContext } from "@foxglove-studio/app/context/PanelIdContext";
import { usePanelSettings } from "@foxglove-studio/app/context/PanelSettingsContext";
import usePanelDrag from "@foxglove-studio/app/hooks/usePanelDrag";
import { State } from "@foxglove-studio/app/reducers";
import { TabPanelConfig } from "@foxglove-studio/app/types/layouts";
import { PanelConfig, SaveConfig, PanelConfigSchema } from "@foxglove-studio/app/types/panels";
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
  overrideConfig?: Config;
  tabId?: string;
};

export interface PanelStatics<Config> {
  panelType: string;
  defaultConfig: Config;
  supportsStrictMode?: boolean;
  configSchema?: PanelConfigSchema<Config>;
}

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
    const { childId, overrideConfig, tabId } = props;
    const { mosaicActions }: { mosaicActions: MosaicRootActions<any> } = useContext(MosaicContext);
    const { mosaicWindowActions }: { mosaicWindowActions: MosaicWindowActions } =
      useContext(MosaicWindowContext);

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

    const dispatch = useDispatch();
    const actions = useMemo(
      () =>
        bindActionCreators(
          {
            savePanelConfigs,
            closePanel,
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

    const [config, saveConfig] = useConfigById<Config>(childId, PanelComponent.defaultConfig);
    const panelComponentConfig = useMemo(
      () => ({ ...config, ...overrideConfig }),
      [config, overrideConfig],
    );

    const updatePanelConfig = useCallback(
      (panelType: string, perPanelFunc: (arg0: PanelConfig) => PanelConfig) => {
        actions.saveFullPanelConfig({ panelType, perPanelFunc });
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

    const { panelSettingsOpen } = usePanelSettings();

    const onOverlayClick = useCallback(
      (e: MouseEvent) => {
        if (!fullScreen && quickActionsKeyPressed) {
          setFullScreen(true);
          if (shiftKeyPressed) {
            setFullScreenLocked(true);
          }
          return;
        }

        if (childId == undefined) {
          return;
        }
        if (panelSettingsOpen) {
          // Allow clicking with no modifiers to select a panel (and deselect others) when panel settings are open
          e.stopPropagation(); // select the deepest clicked panel, not parent tab panels
          actions.setSelectedPanelIds(isSelected ? [] : [childId]);
        } else if (e.metaKey || shiftKeyPressed || isSelected) {
          e.stopPropagation(); // select the deepest clicked panel, not parent tab panels
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
        actions,
        panelSettingsOpen,
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

    const removePanel = useCallback(() => {
      const name = getEventNames().PANEL_REMOVE;
      const eventType = getEventTags().PANEL_TYPE;
      if (name != undefined && eventType !== undefined) {
        logEvent({
          name,
          tags: { [eventType]: type },
        });
      }
      actions.closePanel({
        path: mosaicWindowActions.getPath(),
        root: mosaicActions.getRoot(),
        tabId,
      });
    }, [actions, mosaicActions, mosaicWindowActions, tabId, type]);

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
      () => <PanelComponent config={panelComponentConfig} saveConfig={saveConfig} />,
      [panelComponentConfig, saveConfig],
    );

    const renderCount = useRef(0);

    const perfInfo = useRef<HTMLDivElement>(ReactNull);
    const quickActionsOverlayRef = useRef<HTMLDivElement>(ReactNull);
    const onDragStart = useCallback(() => {
      // Temporarily hide the overlay so that the panel can be shown as the drag preview image --
      // even though the overlay is a sibling rather than a child, Chrome still includes it in the
      // preview if it is visible. Changing the appearance in the next React render cycle is not
      // enough; it actually needs to happen during the dragstart event.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1203107
      const overlay = quickActionsOverlayRef.current;
      if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => (overlay.style.opacity = "1"));
      }
    }, []);
    const dragSpec = { tabId, panelId: childId, onDragStart };
    const [connectOverlayDragSource, connectOverlayDragPreview] = usePanelDrag(dragSpec);
    const [connectToolbarDragHandle, connectToolbarDragPreview] = usePanelDrag(dragSpec);

    return (
      <Profiler
        id={childId ?? "$unknown_id"}
        onRender={(
          _id,
          _phase,
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
        <MultiProvider
          providers={[
            /* eslint-disable react/jsx-key */
            <PanelContext.Provider
              value={{
                type,
                id: childId as any,
                title,
                config,
                saveConfig: saveConfig as SaveConfig<PanelConfig>,
                updatePanelConfig,
                openSiblingPanel,
                enterFullscreen,
                isHovered,
                isFocused,
                hasSettings: PanelComponent.configSchema != undefined,
                tabId,
                supportsStrictMode: PanelComponent.supportsStrictMode ?? true,
                connectToolbarDragHandle,
              }}
            />,
            <PanelIdContext.Provider value={childId} />,
            /* eslint-enable react/jsx-key */
          ]}
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
              [styles.selected!]: isSelected,
            })}
            col
            dataTest={`panel-mouseenter-container ${childId ?? ""}`}
            clip
            ref={(el) => {
              connectOverlayDragPreview(el);
              connectToolbarDragPreview(el);
            }}
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
              <div
                className={styles.quickActionsOverlay}
                ref={(el) => {
                  quickActionsOverlayRef.current = el;
                  connectOverlayDragSource(el);
                }}
                data-panel-overlay
              >
                <div>
                  <div>
                    <FullscreenIcon />
                    {shiftKeyPressed ? "Lock fullscreen" : "Fullscreen (Shift+click to lock)"}
                  </div>
                  <div>
                    <Button onClick={removePanel} disabled={isOnlyPanel}>
                      <TrashCanOutlineIcon />
                      Remove
                    </Button>
                    <Button onClick={splitPanel}>
                      <GridLargeIcon />
                      Split
                    </Button>
                  </div>
                  {!isOnlyPanel && <p>Drag to move</p>}
                </div>
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
        </MultiProvider>
      </Profiler>
    );
  }

  return Object.assign(React.memo(ConnectedPanel), {
    defaultConfig: PanelComponent.defaultConfig,
    panelType: PanelComponent.panelType,
    displayName: `Panel(${PanelComponent.displayName ?? PanelComponent.name})`,
    configSchema: PanelComponent.configSchema,
  });
}

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

import { MessageBar, MessageBarType, Stack, useTheme, makeStyles } from "@fluentui/react";
import BorderAllIcon from "@mdi/svg/svg/border-all.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import ExpandAllOutlineIcon from "@mdi/svg/svg/expand-all-outline.svg";
import FullscreenIcon from "@mdi/svg/svg/fullscreen.svg";
import GridLargeIcon from "@mdi/svg/svg/grid-large.svg";
import TrashCanOutlineIcon from "@mdi/svg/svg/trash-can-outline.svg";
import cx from "classnames";
import { last } from "lodash";
import React, {
  useState,
  useCallback,
  useContext,
  useMemo,
  useRef,
  ComponentType,
  Profiler,
  MouseEventHandler,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  MosaicContext,
  MosaicWindowActions,
  MosaicWindowContext,
  getNodeAtPath,
  getOtherBranch,
  updateTree,
  MosaicNode,
} from "react-mosaic-component";
import { useMountedState } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import { useConfigById } from "@foxglove/studio-base/PanelAPI";
import Button from "@foxglove/studio-base/components/Button";
import ErrorBoundary, { ErrorRendererProps } from "@foxglove/studio-base/components/ErrorBoundary";
import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  useCurrentLayoutActions,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import usePanelDrag from "@foxglove/studio-base/hooks/usePanelDrag";
import { TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import {
  PanelConfig,
  SaveConfig,
  PanelConfigSchema,
  OpenSiblingPanel,
} from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import {
  getPanelIdForType,
  getPanelTypeFromId,
  getPathFromNode,
  updateTabPanelLayout,
} from "@foxglove/studio-base/util/layout";
import { colors, spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles((theme) => ({
  root: {
    zIndex: 1,
    backgroundColor: theme.isInverted ? colors.DARK : colors.LIGHT,
    position: "relative",

    // // To use css to hide/show toolbars on hover we use a global panelToolbar class
    // // because the PanelToolbar component is currently added within each panels render
    // // function rather than handling by the panel HOC

    ".panelToolbarHovered": {
      display: "none",
    },
    ":hover .panelToolbarHovered": {
      display: "flex",
    },
    ":after": {
      content: '""',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0,
      border: `1px solid ${colors.ACCENT}`,
      position: "absolute",
      pointerEvents: "none",
      transition: "opacity 0.125s ease-out",
      zIndex: 100000,
    },
  },
  perfInfo: {
    position: "absolute",
    whiteSpace: "pre-line",
    bottom: 2,
    left: 2,
    fontSize: "9px",
    opacity: 0.7,
    userSelect: "none",
    mixBlendMode: "difference",
  },
  rootFullScreen: {
    position: "fixed",
    zIndex: 100,
    border: "4px solid rgba(110, 81, 238, 0.3)",
    top: 0,
    left: 0,
    right: 0,
    bottom: spacing.PLAYBACK_CONTROL_HEIGHT,

    ":hover [data-panel-overlay-exit]": {
      display: "block",
    },
  },
  rootSelected: {
    ":after": {
      // https://github.com/microsoft/fluentui/issues/20452
      opacity: "1 !important",
      transition: "opacity 0.05s ease-out !important",
    },
  },
  actionsOverlay: {
    cursor: "pointer",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100000, // highest level within panel
    display: "none",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    fontSize: "14px",
    paddingTop: "24px",

    ".mosaic-window:hover &": {
      backgroundColor: theme.palette.neutralLight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    // for screenshot tests
    ".hoverForScreenshot": {
      backgroundColor: theme.palette.neutralLight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
    },

    div: {
      width: "100%",
      padding: "6px 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
    },

    svg: {
      marginRight: "4px",
      width: "24px",
      height: "24px",
      fill: "white",
    },
    p: {
      fontSize: "12px",
      color: colors.TEXT_MUTED,
    },
  },
  quickActionsOverlayButton: {
    width: 72,
    height: 72,
    margin: 4,
    flex: "none",
    fontSize: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: `${theme.semanticColors.primaryButtonBackground} !important`,
    color: `${theme.semanticColors.primaryButtonText} !important`,

    svg: {
      margin: "0 0 6px",
      fill: theme.semanticColors.primaryButtonText,
    },

    ":not(.disabled):hover": {
      background: `${theme.semanticColors.primaryButtonBackgroundHovered} !important`,
    },
  },
  tabActionsOverlayButton: {
    margin: "4px",
    flex: "none",
    fontSize: "14px",
    alignItems: "center",
    background: `${theme.semanticColors.primaryButtonBackground} !important`,
    color: `${theme.semanticColors.primaryButtonText} !important`,
    width: 145,
    height: 40,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",

    svg: {
      margin: "0 0 6px",
      fill: theme.semanticColors.primaryButtonText,
    },
    ":not(.disabled):hover": {
      background: `${theme.semanticColors.primaryButtonBackgroundHovered} !important`,
    },
  },
  exitFullScreen: {
    position: "fixed !important" as unknown as "fixed", // ensure this overrides LegacyButton styles
    top: 75,
    right: 8,
    zIndex: 102,
    opacity: 1,
    backgroundColor: colors.DARK3,
    display: "none",

    ".mosaic-window:hover &": {
      display: "block",
    },
    ".hoverForScreenshot &": {
      display: "block",
    },
    svg: {
      width: 16,
      height: 16,
      fill: "currentColor",
      float: "left",
    },
    span: {
      float: "right",
      paddingLeft: "3",
    },
  },
}));

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

function ErrorToolbar(errorProps: ErrorRendererProps): JSX.Element {
  const theme = useTheme();
  return (
    <Stack style={{ overflow: "hidden" }}>
      <PanelToolbar backgroundColor={theme.semanticColors.errorBackground}>
        <MessageBar
          messageBarType={MessageBarType.error}
          dismissIconProps={{ iconName: "Refresh" }}
          dismissButtonAriaLabel="Reset"
          onDismiss={errorProps.onDismiss}
        >
          {errorProps.error.toString()}
        </MessageBar>
      </PanelToolbar>
      {errorProps.defaultRenderErrorDetails(errorProps)}
    </Stack>
  );
}

// HOC that wraps panel in an error boundary and flex box.
// Gives panel a `config` and `saveConfig`.
//   export default Panel(MyPanelComponent)
//
// `config` comes from the current layout, but in stories / tests you can pass in your own:
//   `<MyPanel config={…} />`
export default function Panel<
  Config extends PanelConfig,
  PanelProps extends { config: Config; saveConfig: SaveConfig<Config> },
>(
  PanelComponent: ComponentConstructorType<PanelProps> & PanelStatics<Config>,
): ComponentType<Props<Config> & Omit<PanelProps, "config" | "saveConfig">> & PanelStatics<Config> {
  function ConnectedPanel(props: Props<Config>) {
    const { childId, overrideConfig, tabId, ...otherProps } = props;

    const classes = useStyles();
    const theme = useTheme();
    const isMounted = useMountedState();

    const { mosaicActions } = useContext(MosaicContext);
    const { mosaicWindowActions }: { mosaicWindowActions: MosaicWindowActions } =
      useContext(MosaicWindowContext);

    const {
      selectedPanelIds,
      setSelectedPanelIds,
      selectAllPanels,
      togglePanelSelected,
      getSelectedPanelIds,
    } = useSelectedPanels();

    const isSelected = useMemo(
      () => childId != undefined && selectedPanelIds.includes(childId),
      [childId, selectedPanelIds],
    );
    const numSelectedPanelsIfSelected = useMemo(
      () => (isSelected ? selectedPanelIds.length : 0),
      [isSelected, selectedPanelIds],
    );

    const {
      savePanelConfigs,
      updatePanelConfigs,
      createTabPanel,
      closePanel,
      getCurrentLayoutState,
    } = useCurrentLayoutActions();

    const [quickActionsKeyPressed, setQuickActionsKeyPressed] = useState(false);
    const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
    const [cmdKeyPressed, setCmdKeyPressed] = useState(false);
    const [fullScreen, setFullScreen] = useState(false);
    const [fullScreenLocked, setFullScreenLocked] = useState(false);
    const panelCatalog = usePanelCatalog();

    const type = PanelComponent.panelType;
    const title = useMemo(
      () => panelCatalog.getPanelByType(type)?.title ?? "",
      [panelCatalog, type],
    );

    const defaultConfig = PanelComponent.defaultConfig;
    const [savedConfig, saveConfig] = useConfigById<Config>(childId);

    // PanelSettings needs useConfigById to return a config
    // If there is no saved config, we save the default config provided by the panel.
    // This typically happens when a new panel is added and the layout does not yet have a config.
    // Even if this effect gets run more than once, we only need to save the default config once.
    const savedDefaultConfig = useRef(false);
    useLayoutEffect(() => {
      if (!savedConfig && !savedDefaultConfig.current) {
        savedDefaultConfig.current = true;
        saveConfig(defaultConfig);
      }
    }, [defaultConfig, saveConfig, savedConfig]);

    const panelComponentConfig = useMemo(
      () => ({ ...defaultConfig, ...savedConfig, ...overrideConfig }),
      [savedConfig, defaultConfig, overrideConfig],
    );

    // Open a panel next to the current panel, of the specified `panelType`.
    // If such a panel already exists, we update it with the new props.
    const openSiblingPanel = useCallback<OpenSiblingPanel>(
      async ({ panelType, siblingConfigCreator, updateIfExists }) => {
        const panelsState = getCurrentLayoutState().selectedLayout?.data;
        if (!panelsState) {
          return;
        }
        const siblingPanel = panelCatalog.getPanelByType(panelType);
        if (!siblingPanel) {
          return;
        }

        const siblingModule = await siblingPanel.module();
        if (!isMounted()) {
          return;
        }

        const siblingDefaultConfig = siblingModule.default.defaultConfig;
        const ownPath = mosaicWindowActions.getPath();

        // Try to find a sibling panel and update it with the `siblingConfig`
        if (updateIfExists) {
          const lastNode = last(ownPath);
          const siblingPathEnd = lastNode != undefined ? getOtherBranch(lastNode) : "second";
          const siblingPath = ownPath.slice(0, -1).concat(siblingPathEnd);
          const siblingId = getNodeAtPath(mosaicActions.getRoot(), siblingPath);
          if (typeof siblingId === "string" && getPanelTypeFromId(siblingId) === panelType) {
            const siblingConfig: PanelConfig = {
              ...siblingDefaultConfig,
              ...panelsState.configById[siblingId],
            };
            savePanelConfigs({
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
        }

        // Otherwise, open new panel
        const newPanelPath = ownPath.concat("second");
        void mosaicWindowActions.split({ type: panelType }).then(() => {
          const newPanelId = getNodeAtPath(mosaicActions.getRoot(), newPanelPath) as string;
          savePanelConfigs({
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
      [
        getCurrentLayoutState,
        isMounted,
        mosaicActions,
        mosaicWindowActions,
        panelCatalog,
        savePanelConfigs,
      ],
    );

    const { panelSettingsOpen } = useWorkspace();

    const onOverlayClick: MouseEventHandler<HTMLDivElement> = useCallback(
      (e) => {
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
          setSelectedPanelIds(isSelected ? [] : [childId]);
        } else if (e.metaKey || shiftKeyPressed || isSelected) {
          e.stopPropagation(); // select the deepest clicked panel, not parent tab panels
          togglePanelSelected(childId, tabId);
        }
      },
      [
        childId,
        tabId,
        fullScreen,
        quickActionsKeyPressed,
        togglePanelSelected,
        shiftKeyPressed,
        isSelected,
        setSelectedPanelIds,
        panelSettingsOpen,
      ],
    );

    const groupPanels = useCallback(() => {
      const layout = getCurrentLayoutState().selectedLayout?.data?.layout;
      if (layout == undefined) {
        return;
      }
      createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: getSelectedPanelIds(),
        singleTab: true,
      });
    }, [getCurrentLayoutState, getSelectedPanelIds, createTabPanel, childId]);

    const createTabs = useCallback(() => {
      const layout = getCurrentLayoutState().selectedLayout?.data?.layout;
      if (layout == undefined) {
        return;
      }
      createTabPanel({
        idToReplace: childId,
        layout,
        idsToRemove: getSelectedPanelIds(),
        singleTab: false,
      });
    }, [getCurrentLayoutState, getSelectedPanelIds, createTabPanel, childId]);

    const removePanel = useCallback(() => {
      closePanel({
        path: mosaicWindowActions.getPath(),
        root: mosaicActions.getRoot() as MosaicNode<string>,
        tabId,
      });
    }, [closePanel, mosaicActions, mosaicWindowActions, tabId]);

    const splitPanel = useCallback(() => {
      const savedProps = getCurrentLayoutState().selectedLayout?.data?.configById;
      if (!savedProps) {
        return;
      }
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
        savePanelConfigs({
          configs: [
            { id: tabId, config: newTabConfig },
            { id: newId, config: panelComponentConfig },
          ],
        });
      } else {
        void mosaicWindowActions.split({ type: PanelComponent.panelType });
      }
    }, [
      childId,
      getCurrentLayoutState,
      mosaicWindowActions,
      panelComponentConfig,
      savePanelConfigs,
      tabId,
    ]);

    const { onMouseMove, enterFullscreen, exitFullScreen } = useMemo(
      () => ({
        onMouseMove: ((e) => {
          if (e.metaKey !== cmdKeyPressed) {
            setCmdKeyPressed(e.metaKey);
          }
        }) as MouseEventHandler<HTMLDivElement>,
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
          a: (e: KeyboardEvent) => {
            e.preventDefault();
            if (cmdKeyPressed) {
              selectAllPanels();
            }
          },
          "`": () => setQuickActionsKeyPressed(true),
          "~": () => setQuickActionsKeyPressed(true),
          Shift: () => setShiftKeyPressed(true),
          Escape: () => exitFullScreen(),
          Meta: () => setCmdKeyPressed(true),
        },
      }),
      [selectAllPanels, cmdKeyPressed, exitFullScreen, onReleaseQuickActionsKey],
    );

    /* Ensure user exits full-screen mode when leaving window, even if key is still pressed down */
    useEffect(() => {
      const listener = () => {
        exitFullScreen();
        setCmdKeyPressed(false);
        setShiftKeyPressed(false);
        onReleaseQuickActionsKey();
      };
      window.addEventListener("blur", listener);
      return () => window.removeEventListener("blur", listener);
    }, [exitFullScreen, onReleaseQuickActionsKey]);

    const otherPanelProps = useShallowMemo(otherProps);
    const childProps = useMemo(
      // We have to lie to TypeScript with "as PanelProps" because the "PanelProps extends {...}"
      // constraint technically allows the panel to require the types of config/saveConfig be more
      // specific types that aren't satisfied by the functions we pass in
      () => ({ config: panelComponentConfig, saveConfig, ...otherPanelProps } as PanelProps),
      [otherPanelProps, panelComponentConfig, saveConfig],
    );
    const child = useMemo(() => <PanelComponent {...childProps} />, [childProps]);

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
        <PanelContext.Provider
          value={{
            type,
            id: childId ?? "$unknown_id",
            title,
            config: panelComponentConfig,
            saveConfig: saveConfig as SaveConfig<PanelConfig>,
            updatePanelConfigs,
            openSiblingPanel,
            enterFullscreen,
            hasSettings: PanelComponent.configSchema != undefined,
            tabId,
            supportsStrictMode: PanelComponent.supportsStrictMode ?? true,
            connectToolbarDragHandle,
          }}
        >
          <KeyListener global keyUpHandlers={keyUpHandlers} keyDownHandlers={keyDownHandlers} />
          <Flex
            onClick={onOverlayClick}
            onMouseMove={onMouseMove}
            className={cx(classes.root, {
              [classes.rootFullScreen]: fullScreen,
              [classes.rootSelected]: isSelected,
            })}
            col
            dataTest={`panel-mouseenter-container ${childId ?? ""}`}
            clip
            ref={(el) => {
              connectOverlayDragPreview(el);
              connectToolbarDragPreview(el);
            }}
          >
            {isSelected && !fullScreen && numSelectedPanelsIfSelected > 1 && (
              <div data-tab-options className={classes.actionsOverlay}>
                <Button
                  className={classes.tabActionsOverlayButton}
                  style={{ backgroundColor: colors.BLUE }}
                  onClick={groupPanels}
                >
                  <Icon size="small" style={{ marginBottom: 5 }}>
                    <BorderAllIcon />
                  </Icon>
                  Group in tab
                </Button>
                <Button style={{ backgroundColor: colors.BLUE }} onClick={createTabs}>
                  <Icon size="small" style={{ marginBottom: 5 }}>
                    <ExpandAllOutlineIcon />
                  </Icon>
                  Create {numSelectedPanelsIfSelected} tabs
                </Button>
              </div>
            )}
            {type !== TAB_PANEL_TYPE && quickActionsKeyPressed && !fullScreen && (
              <div
                className={classes.actionsOverlay}
                ref={(el) => {
                  quickActionsOverlayRef.current = el;
                  connectOverlayDragSource(el);
                }}
                data-panel-overlay
              >
                <div>
                  <div>
                    <FullscreenIcon style={{ fill: theme.semanticColors.bodyText }} />
                    {shiftKeyPressed ? "Lock fullscreen" : "Fullscreen (Shift+click to lock)"}
                  </div>
                  <div>
                    <Button className={classes.quickActionsOverlayButton} onClick={removePanel}>
                      <TrashCanOutlineIcon />
                      Remove
                    </Button>
                    <Button className={classes.quickActionsOverlayButton} onClick={splitPanel}>
                      <GridLargeIcon />
                      Split
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {fullScreen && (
              <Button
                className={classes.exitFullScreen}
                onClick={exitFullScreen}
                data-panel-overlay-exit
              >
                <CloseIcon /> <span>Exit fullscreen</span>
              </Button>
            )}
            <ErrorBoundary renderError={(errorProps) => <ErrorToolbar {...errorProps} />}>
              {PanelComponent.supportsStrictMode ?? true ? (
                <React.StrictMode>{child}</React.StrictMode>
              ) : (
                child
              )}
            </ErrorBoundary>
            {process.env.NODE_ENV !== "production" && (
              <div className={classes.perfInfo} ref={perfInfo} />
            )}
          </Flex>
        </PanelContext.Provider>
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

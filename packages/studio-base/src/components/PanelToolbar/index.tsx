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

import { ContextualMenu, IContextualMenuItem, makeStyles } from "@fluentui/react";
import AlertIcon from "@mdi/svg/svg/alert.svg";
import CogIcon from "@mdi/svg/svg/cog.svg";
import DragIcon from "@mdi/svg/svg/drag.svg";
import HelpCircleOutlineIcon from "@mdi/svg/svg/help-circle-outline.svg";
import cx from "classnames";
import { useContext, useState, useCallback, useMemo, useRef } from "react";
import { MosaicContext, MosaicNode, MosaicWindowContext } from "react-mosaic-component";
import { useResizeDetector } from "react-resize-detector";

import Icon from "@foxglove/studio-base/components/Icon";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import PanelList, { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import { getPanelTypeFromMosaic } from "@foxglove/studio-base/components/PanelToolbar/utils";
import {
  useCurrentLayoutActions,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  children?: React.ReactNode;
  floating?: boolean;
  helpContent?: React.ReactNode;
  additionalIcons?: React.ReactNode;
  hideToolbars?: boolean;
  isUnknownPanel?: boolean;
  backgroundColor?: string;
};

export const PANEL_TOOLBAR_HEIGHT = 26;
export const PANEL_TOOLBAR_SPACING = 4;

const useStyles = makeStyles((theme) => ({
  iconContainer: {
    paddingTop: PANEL_TOOLBAR_SPACING,
    display: "flex",
    flex: "0 0 auto",
    alignItems: "center",
    marginLeft: PANEL_TOOLBAR_SPACING,
    flexDirection: "row",
    minHeight: PANEL_TOOLBAR_HEIGHT - PANEL_TOOLBAR_SPACING,
    padding: "2px 2px 2px 6px",

    svg: {
      fontSize: 14,
    },
  },
  panelName: {
    fontSize: 10,
    opacity: 0.5,
    marginRight: 4,
  },
  panelToolbarContainer: {
    transition: "transform 80ms ease-in-out, opacity 80ms ease-in-out",
    display: "flex",
    flex: "0 0 auto",
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: theme.palette.neutralLighterAlt,
    padding: PANEL_TOOLBAR_SPACING,

    "&.floating": {
      position: "absolute",
      right: 0,
      // leave some room for possible scrollbar
      paddingRight: 8,
      top: 0,
      width: "100%",
      zIndex: 5000,
      backgroundColor: "transparent",
      pointerEvents: "none",

      "*": {
        pointerEvents: "auto",
      },
      "&.hasChildren": {
        left: 0,
        backgroundColor: theme.palette.neutralLighterAlt,
      },
      "&:not(.hasChildren) > *": {
        backgroundColor: theme.palette.neutralLighterAlt,
        borderRadius: theme.effects.roundedCorner2,
        boxShadow: theme.effects.elevation16,
      },
    },
    "&:not(.floating)": {
      minHeight: PANEL_TOOLBAR_HEIGHT + PANEL_TOOLBAR_SPACING,
    },
  },
  icon: {
    fontSize: 14,
    margin: "0 0.2em",
  },
  dragIcon: {
    cursor: "move",
  },
}));

function PanelActionsDropdown({
  isOpen,
  setIsOpen,
  isUnknownPanel,
}: {
  isOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setIsOpen: (_: boolean) => void;
  isUnknownPanel: boolean;
}) {
  const styles = useStyles();
  const panelContext = useContext(PanelContext);
  const tabId = panelContext?.tabId;
  const { mosaicActions } = useContext(MosaicContext);
  const { mosaicWindowActions } = useContext(MosaicWindowContext);
  const {
    getCurrentLayoutState: getCurrentLayout,
    closePanel,
    splitPanel,
    swapPanel,
  } = useCurrentLayoutActions();
  const { setSelectedPanelIds } = useSelectedPanels();

  const getPanelType = useCallback(
    () => getPanelTypeFromMosaic(mosaicWindowActions, mosaicActions),
    [mosaicActions, mosaicWindowActions],
  );

  const close = useCallback(() => {
    closePanel({
      tabId,
      root: mosaicActions.getRoot() as MosaicNode<string>,
      path: mosaicWindowActions.getPath(),
    });
  }, [closePanel, mosaicActions, mosaicWindowActions, tabId]);

  const split = useCallback(
    (id: string | undefined, direction: "row" | "column") => {
      const type = getPanelType();
      if (id == undefined || type == undefined) {
        throw new Error("Trying to split unknown panel!");
      }

      const config = getCurrentLayout().selectedLayout?.data?.configById[id] ?? {};
      splitPanel({
        id,
        tabId,
        direction,
        root: mosaicActions.getRoot() as MosaicNode<string>,
        path: mosaicWindowActions.getPath(),
        config,
      });
    },
    [getCurrentLayout, getPanelType, mosaicActions, mosaicWindowActions, splitPanel, tabId],
  );

  const swap = useCallback(
    (id?: string) =>
      ({ type, config, relatedConfigs }: PanelSelection) => {
        swapPanel({
          tabId,
          originalId: id ?? "",
          type,
          root: mosaicActions.getRoot() as MosaicNode<string>,
          path: mosaicWindowActions.getPath(),
          config: config ?? {},
          relatedConfigs,
        });
      },
    [mosaicActions, mosaicWindowActions, swapPanel, tabId],
  );

  const { openPanelSettings } = useWorkspace();
  const openSettings = useCallback(() => {
    if (panelContext?.id != undefined) {
      setSelectedPanelIds([panelContext.id]);
      openPanelSettings();
    }
  }, [setSelectedPanelIds, openPanelSettings, panelContext?.id]);

  const menuItems: IContextualMenuItem[] = useMemo(() => {
    const items: IContextualMenuItem[] = [
      {
        key: "settings",
        text: "Panel settings",
        onClick: openSettings,
        iconProps: { iconName: "SingleColumnEdit" },
        disabled: !(panelContext?.hasSettings ?? false),
      },
      {
        key: "change-panel",
        text: "Change panel",
        onClick: openSettings,
        iconProps: {
          iconName: "ShapeSubtract",
          styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
        },
        subMenuProps: {
          items: [{ key: "dummy" }],
          onRenderMenuList: () => (
            <PanelList
              selectedPanelTitle={panelContext?.title}
              onPanelSelect={swap(panelContext?.id)}
            />
          ),
        },
      },
    ];
    if (!isUnknownPanel) {
      items.push(
        {
          key: "fullscreen",
          text: "Fullscreen",
          onClick: panelContext?.enterFullscreen,
          iconProps: {
            iconName: "FullScreenMaximize",
            styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
          },
        },
        {
          key: "hsplit",
          text: "Split horizontal",
          onClick: () => split(panelContext?.id, "column"),
          iconProps: {
            iconName: "SplitHorizontal",
            styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
          },
        },
        {
          key: "vsplit",
          text: "Split vertical",
          onClick: () => split(panelContext?.id, "row"),
          iconProps: {
            iconName: "SplitVertical",
            styles: { root: { height: 24, marginLeft: 2, marginRight: 6 } },
          },
        },
      );
    }
    items.push({
      key: "remove",
      text: "Remove panel",
      onClick: close,
      iconProps: { iconName: "Delete" },
      "data-test": "panel-settings-remove",
    });
    return items;
  }, [
    close,
    isUnknownPanel,
    openSettings,
    panelContext?.enterFullscreen,
    panelContext?.hasSettings,
    panelContext?.id,
    panelContext?.title,
    split,
    swap,
  ]);

  const buttonRef = useRef<HTMLDivElement>(ReactNull);

  const type = getPanelType();
  if (type == undefined) {
    return ReactNull;
  }

  return (
    <div ref={buttonRef}>
      <ContextualMenu
        hidden={!isOpen}
        items={menuItems}
        target={buttonRef}
        onDismiss={() => setIsOpen(false)}
      />
      <Icon
        fade
        tooltip="Panel settings"
        dataTest="panel-settings"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CogIcon className={styles.icon} />
      </Icon>
    </div>
  );
}

type PanelToolbarControlsProps = Pick<Props, "additionalIcons" | "floating"> & {
  menuOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setMenuOpen: (_: boolean) => void;
  showControls?: boolean;
  showPanelName?: boolean;
  isUnknownPanel: boolean;
};

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
const PanelToolbarControls = React.memo(function PanelToolbarControls({
  menuOpen,
  setMenuOpen,
  additionalIcons,
  showControls = false,
  floating = false,
  isUnknownPanel,
  showPanelName = false,
}: PanelToolbarControlsProps) {
  const panelContext = useContext(PanelContext);
  const styles = useStyles();

  return (
    <div
      style={showControls ? { display: "flex" } : {}}
      className={cx(styles.iconContainer, {
        panelToolbarHovered: !floating,
      })}
    >
      {showPanelName && panelContext && (
        <div className={styles.panelName}>{panelContext.title}</div>
      )}
      {additionalIcons}
      <PanelActionsDropdown
        isOpen={menuOpen}
        setIsOpen={setMenuOpen}
        isUnknownPanel={isUnknownPanel}
      />
      {!isUnknownPanel && (
        <span ref={panelContext?.connectToolbarDragHandle} data-test="mosaic-drag-handle">
          <Icon fade tooltip="Move panel (shortcut: ` or ~)">
            <DragIcon className={cx(styles.icon, styles.dragIcon)} />
          </Icon>
        </span>
      )}
    </div>
  );
});

// Panel toolbar should be added to any panel that's part of the
// react-mosaic layout.  It adds a drag handle, remove/replace controls
// and has a place to add custom controls via it's children property
export default React.memo<Props>(function PanelToolbar({
  additionalIcons,
  children,
  floating = false,
  helpContent,
  hideToolbars = false,
  isUnknownPanel = false,
  backgroundColor,
}: Props) {
  const styles = useStyles();
  const { supportsStrictMode = true } = useContext(PanelContext) ?? {};
  const [menuOpen, setMenuOpen] = useState(false);

  const panelContext = useContext(PanelContext);
  const { setPanelDocToDisplay } = useSelectedPanels();
  const { openHelp } = useWorkspace();

  // Help-shown state must be hoisted outside the controls container so the modal can remain visible
  // when the panel is no longer hovered.
  const additionalIconsWithHelp = useMemo(() => {
    return (
      <>
        {additionalIcons}
        {!supportsStrictMode && process.env.NODE_ENV !== "production" && (
          <Icon
            clickable={false}
            style={{ color: colors.YELLOW }}
            tooltip="[DEV MODE ONLY] React Strict Mode is not enabled for this panel. Please remove supportsStrictMode=false from the panel component and manually test this panel for regressions!"
          >
            <AlertIcon />
          </Icon>
        )}
        {Boolean(helpContent) && (
          <Icon
            tooltip="Help"
            fade
            onClick={() => {
              if (panelContext?.type != undefined) {
                setPanelDocToDisplay(panelContext.type);
                openHelp();
              }
            }}
          >
            <HelpCircleOutlineIcon className={styles.icon} />
          </Icon>
        )}
      </>
    );
  }, [
    additionalIcons,
    helpContent,
    openHelp,
    setPanelDocToDisplay,
    panelContext?.type,
    styles.icon,
    supportsStrictMode,
  ]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

  if (hideToolbars) {
    return ReactNull;
  }

  // floating toolbars only show when hovered - but hovering over a context menu would hide the toolbar
  // showToolbar is used to force-show elements even if not hovered
  const showToolbar = menuOpen || !!isUnknownPanel;

  return (
    <div ref={sizeRef}>
      <div
        className={cx(styles.panelToolbarContainer, {
          panelToolbarHovered: floating,
          floating,
          hasChildren: Boolean(children),
        })}
        style={showToolbar ? { display: "flex", backgroundColor } : { backgroundColor }}
      >
        {children}
        <PanelToolbarControls
          showControls={showToolbar}
          floating={floating}
          showPanelName={(width ?? 0) > 360}
          additionalIcons={additionalIconsWithHelp}
          isUnknownPanel={!!isUnknownPanel}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      </div>
    </div>
  );
});

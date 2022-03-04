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
import { makeStyles } from "@fluentui/react";
import FullscreenExitIcon from "@mdi/svg/svg/fullscreen-exit.svg";
import FullscreenIcon from "@mdi/svg/svg/fullscreen.svg";
import HelpCircleOutlineIcon from "@mdi/svg/svg/help-circle-outline.svg";
import cx from "classnames";
import { useContext, useState, useMemo, useRef } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import { useHelpInfo } from "@foxglove/studio-base/context/HelpInfoContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";

import { PanelToolbarControls } from "./PanelToolbarControls";

type Props = {
  additionalIcons?: React.ReactNode;
  alwaysVisible?: boolean;
  backgroundColor?: string;
  children?: React.ReactNode;
  floating?: boolean;
  helpContent?: React.ReactNode;
  hideToolbars?: boolean;
  isUnknownPanel?: boolean;
};

const PANEL_TOOLBAR_HEIGHT = 26;
const PANEL_TOOLBAR_SPACING = 4;

const useStyles = makeStyles((theme) => ({
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
}));

// Panel toolbar should be added to any panel that's part of the
// react-mosaic layout.  It adds a drag handle, remove/replace controls
// and has a place to add custom controls via it's children property
export default React.memo<Props>(function PanelToolbar({
  additionalIcons,
  alwaysVisible = false,
  backgroundColor,
  children,
  floating = false,
  helpContent,
  hideToolbars = false,
  isUnknownPanel = false,
}: Props) {
  const styles = useStyles();
  const { isFullscreen, enterFullscreen, exitFullscreen } = useContext(PanelContext) ?? {};
  const [menuOpen, setMenuOpen] = useState(false);

  const panelContext = useContext(PanelContext);
  const { openHelp } = useWorkspace();

  const { setHelpInfo } = useHelpInfo();

  // Help-shown state must be hoisted outside the controls container so the modal can remain visible
  // when the panel is no longer hovered.
  const additionalIconsWithHelp = useMemo(() => {
    return (
      <>
        {additionalIcons}
        {Boolean(helpContent) && (
          <Icon
            tooltip="Help"
            fade
            onClick={() => {
              if (panelContext?.title != undefined) {
                setHelpInfo({ title: panelContext.title, content: helpContent });
                openHelp();
              }
            }}
          >
            <HelpCircleOutlineIcon className={styles.icon} />
          </Icon>
        )}
        {isFullscreen === false && (
          <Icon
            fade
            tooltip="Fullscreen"
            dataTest="panel-toolbar-fullscreen"
            onClick={enterFullscreen}
          >
            <FullscreenIcon />
          </Icon>
        )}
        {isFullscreen === true && (
          <Icon fade tooltip="Exit fullscreen" onClick={exitFullscreen}>
            <FullscreenExitIcon />
          </Icon>
        )}
      </>
    );
  }, [
    additionalIcons,
    openHelp,
    setHelpInfo,
    panelContext?.title,
    helpContent,
    styles.icon,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
  ]);

  // floating toolbars only show when hovered - but hovering over a context menu would hide the toolbar
  // showToolbar is used to force-show elements even if not hovered
  const showToolbar = menuOpen || !!isUnknownPanel;

  const containerRef = useRef<HTMLDivElement>(ReactNull);

  const mousePresent = usePanelMousePresence(containerRef);
  const shouldShow = alwaysVisible || (floating ? showToolbar || mousePresent : true);

  if (hideToolbars) {
    return ReactNull;
  }

  return (
    <div
      ref={containerRef}
      className={cx(styles.panelToolbarContainer, {
        floating,
        hasChildren: Boolean(children),
      })}
      style={{ backgroundColor, display: shouldShow ? "flex" : "none" }}
    >
      {children}
      <PanelToolbarControls
        showControls={showToolbar || alwaysVisible}
        mousePresent={mousePresent}
        floating={floating}
        additionalIcons={additionalIconsWithHelp}
        isUnknownPanel={!!isUnknownPanel}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
    </div>
  );
});

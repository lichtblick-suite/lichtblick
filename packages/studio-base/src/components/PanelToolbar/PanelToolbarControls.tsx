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
import DragIcon from "@mdi/svg/svg/drag.svg";
import cx from "classnames";
import { useContext } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import PanelContext from "@foxglove/studio-base/components/PanelContext";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

const PANEL_TOOLBAR_HEIGHT = 26;
const PANEL_TOOLBAR_SPACING = 4;

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  floating?: boolean;
  isUnknownPanel: boolean;
  menuOpen: boolean;
  mousePresent?: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setMenuOpen: (_: boolean) => void;
  showControls?: boolean;
  showPanelName?: boolean;
};

const useStyles = makeStyles({
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
  icon: {
    fontSize: 14,
    margin: "0 0.2em",
  },
  dragIcon: {
    cursor: "move",
  },
});

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
export const PanelToolbarControls = React.memo(function PanelToolbarControls({
  additionalIcons,
  floating = false,
  isUnknownPanel,
  menuOpen,
  mousePresent = false,
  setMenuOpen,
  showControls = false,
  showPanelName = false,
}: PanelToolbarControlsProps) {
  const panelContext = useContext(PanelContext);
  const styles = useStyles();

  const shouldShow = showControls ? true : floating ? true : mousePresent;

  return (
    <div style={{ display: shouldShow ? "flex" : "none" }} className={cx(styles.iconContainer)}>
      {showPanelName && panelContext && (
        <div className={styles.panelName}>{panelContext.title}</div>
      )}
      {additionalIcons}
      <PanelActionsDropdown
        isOpen={menuOpen}
        setIsOpen={setMenuOpen}
        isUnknownPanel={isUnknownPanel}
      />
      {!isUnknownPanel && panelContext?.connectToolbarDragHandle && (
        <span ref={panelContext?.connectToolbarDragHandle} data-test="mosaic-drag-handle">
          <Icon fade tooltip="Move panel (shortcut: ` or ~)">
            <DragIcon className={cx(styles.icon, styles.dragIcon)} />
          </Icon>
        </span>
      )}
    </div>
  );
});

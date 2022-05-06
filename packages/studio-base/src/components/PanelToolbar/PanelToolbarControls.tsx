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

import DragIcon from "@mdi/svg/svg/drag.svg";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { useContext } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import PanelContext from "@foxglove/studio-base/components/PanelContext";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  floating?: boolean;
  isUnknownPanel: boolean;
  menuOpen: boolean;
  mousePresent?: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setMenuOpen: (_: boolean) => void;
  showControls?: boolean;
};

const useStyles = makeStyles((theme: Theme) => ({
  iconContainer: ({ shouldShow }: { shouldShow: boolean }) => ({
    paddingTop: theme.spacing(0.5),
    display: "flex",
    visibility: shouldShow ? "visible" : "hidden",
    flex: "0 0 auto",
    alignItems: "center",
    marginLeft: theme.spacing(0.5),
    flexDirection: "row",
    padding: theme.spacing(0.25, 0.25, 0.25, 0.75),

    "& .icon": {
      fontSize: 14,
    },
  }),
  icon: {
    fontSize: 14,
    margin: "0 0.2em",
  },
  dragIcon: {
    cursor: "move",
  },
}));

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
}: PanelToolbarControlsProps) {
  const shouldShow = showControls ? true : floating ? true : mousePresent;
  const panelContext = useContext(PanelContext);
  const styles = useStyles({ shouldShow });

  return (
    <div className={styles.iconContainer}>
      {additionalIcons}
      <PanelActionsDropdown
        isOpen={menuOpen}
        setIsOpen={setMenuOpen}
        isUnknownPanel={isUnknownPanel}
      />
      {!isUnknownPanel && panelContext?.connectToolbarDragHandle && (
        <span ref={panelContext.connectToolbarDragHandle} data-test="mosaic-drag-handle">
          <Icon fade tooltip="Move panel (shortcut: ` or ~)">
            <DragIcon className={cx(styles.icon, styles.dragIcon)} />
          </Icon>
        </span>
      )}
    </div>
  );
});

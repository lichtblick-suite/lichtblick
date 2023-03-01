// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SlideAdd24Regular } from "@fluentui/react-icons";
import { Menu, IconButton, IconButtonProps, MenuProps } from "@mui/material";
import { forwardRef } from "react";

import PanelList from "@foxglove/studio-base/components/PanelList";
import useAddPanel from "@foxglove/studio-base/hooks/useAddPanel";

export const AddPanelIconButton = forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  return (
    <IconButton {...props} ref={ref} id="add-panel-button">
      <SlideAdd24Regular />
    </IconButton>
  );
});

AddPanelIconButton.displayName = "AddPanelIconButton";

export function AddPanelMenu(
  props: {
    handleClose: () => void;
  } & MenuProps,
): JSX.Element {
  const { anchorEl, handleClose, open, ...menuProps } = props;
  const addPanel = useAddPanel();

  return (
    <Menu
      {...menuProps}
      id="add-panel-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        disablePadding: true,
        "aria-labelledby": "add-panel-button",
      }}
      anchorOrigin={{
        horizontal: "left",
        vertical: "bottom",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
    >
      <PanelList
        // Close when a drag starts so the modal menu doesn't block the drop targets
        onDragStart={handleClose}
        onPanelSelect={addPanel}
      />
    </Menu>
  );
}

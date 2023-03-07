// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu, PopoverPosition, PopoverReference } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import PanelList from "@foxglove/studio-base/components/PanelList";
import useAddPanel from "@foxglove/studio-base/hooks/useAddPanel";

const useStyles = makeStyles()({
  menuList: {
    minWidth: 270,
  },
});

type AddPanelProps = {
  anchorEl?: HTMLElement;
  anchorPosition?: PopoverPosition;
  anchorReference?: PopoverReference;
  disablePortal?: boolean;
  handleClose: () => void;
  open: boolean;
};

export function AddPanelMenu(props: AddPanelProps): JSX.Element {
  const { classes } = useStyles();
  const { anchorEl, anchorPosition, anchorReference, disablePortal, handleClose, open } = props;
  const addPanel = useAddPanel();

  return (
    <Menu
      id="add-panel-menu"
      anchorEl={anchorEl}
      anchorPosition={anchorPosition}
      anchorReference={anchorReference}
      disablePortal={disablePortal}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        disablePadding: true,
        "aria-labelledby": "add-panel-button",
        className: classes.menuList,
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
        onPanelSelect={(selection) => {
          addPanel(selection);
          handleClose();
        }}
      />
    </Menu>
  );
}

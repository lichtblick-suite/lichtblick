// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu, PaperProps, PopoverPosition, PopoverReference } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { PanelCatalog } from "@lichtblick/suite-base/components/PanelCatalog";
import useAddPanel from "@lichtblick/suite-base/hooks/useAddPanel";

const useStyles = makeStyles()((theme) => ({
  menuList: {
    minWidth: 270,
    paddingBottom: theme.spacing(1),
  },
}));

type AddPanelProps = {
  anchorEl?: HTMLElement;
  anchorPosition?: PopoverPosition;
  anchorReference?: PopoverReference;
  disablePortal?: boolean;
  handleClose: () => void;
  open: boolean;
};

export function AddPanelMenu(props: AddPanelProps): React.JSX.Element {
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
      slotProps={{
        list: {
          dense: true,
          disablePadding: true,
          "aria-labelledby": "add-panel-button",
          className: classes.menuList,
        },
        paper: {
          "data-tourid": "add-panel-menu",
        } as Partial<PaperProps & { "data-tourid"?: string }>,
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
      <PanelCatalog
        isMenu
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

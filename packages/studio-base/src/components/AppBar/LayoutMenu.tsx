// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu } from "@mui/material";

import LayoutBrowser from "@foxglove/studio-base/components/LayoutBrowser";

type LayoutMenuProps = {
  anchorEl?: HTMLElement;
  handleClose: () => void;
  open: boolean;
};

export function LayoutMenu(props: LayoutMenuProps): JSX.Element {
  const { anchorEl, handleClose, open } = props;
  return (
    <Menu
      id="layout-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        disablePadding: true,
        "aria-labelledby": "layout-button",
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
      <LayoutBrowser menuClose={handleClose} />
    </Menu>
  );
}

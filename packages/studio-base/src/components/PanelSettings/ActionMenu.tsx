// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { IconButton, Menu, MenuItem } from "@mui/material";

export function ActionMenu({
  allowShare,
  onReset,
  onShare,
}: {
  allowShare: boolean;
  onReset: () => void;
  onShare: () => void;
}): JSX.Element {
  const [anchorEl, setAnchorEl] = React.useState<undefined | HTMLElement>();
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <div>
      <IconButton
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          disabled={!allowShare}
          onClick={() => {
            onShare();
            handleClose();
          }}
        >
          Import/export settings...
        </MenuItem>
        <MenuItem
          onClick={() => {
            onReset();
            handleClose();
          }}
        >
          Reset to defaults
        </MenuItem>
      </Menu>
    </div>
  );
}

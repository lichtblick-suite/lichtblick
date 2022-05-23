// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { ListItemIcon, ListItemText } from "@mui/material";
import IconButton from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";

import icons from "./icons";
import { SettingsTreeNodeAction } from "./types";

export function NodeActionsMenu({
  actions,
  onSelectAction,
}: {
  actions: readonly SettingsTreeNodeAction[];
  onSelectAction: (actionId: string) => void;
}): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLButtonElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (id: string) => {
    onSelectAction(id);
    setAnchorEl(undefined);
  };

  return (
    <>
      <IconButton
        id="node-actions-button"
        aria-controls={open ? "noce-actions-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        size="small"
        style={{ minWidth: "auto" }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "node-actions-button",
        }}
      >
        {actions.map((action) => {
          const Icon = action.icon ? icons[action.icon] : undefined;
          return (
            <MenuItem key={action.id} onClick={() => handleClose(action.id)}>
              {Icon && (
                <ListItemIcon>
                  <Icon fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

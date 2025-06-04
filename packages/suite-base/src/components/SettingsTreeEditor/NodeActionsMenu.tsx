// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Menu, MenuItem, IconButton, ListItemIcon, ListItemText, Divider } from "@mui/material";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";

import { NodeActionsMenuProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";

import { icons } from "./icons";

export function NodeActionsMenu({
  actions,
  onSelectAction,
}: NodeActionsMenuProps): React.JSX.Element {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLButtonElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(
    (id: string) => {
      onSelectAction(id);
      setAnchorEl(undefined);
    },
    [onSelectAction],
  );

  const anyItemHasIcon = useMemo(
    () => actions.some((action): boolean => action.type === "action" && action.icon != undefined),
    [actions],
  );

  const actionsWithUniqueIds = useMemo(() => {
    return actions.map((action) => ({
      ...action,
      uniqueId: action.type === "divider" ? nanoid() : undefined,
    }));
  }, [actions]);

  return (
    <>
      <IconButton
        title="More actions"
        aria-controls={open ? "node-actions-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        data-testid="node-actions-menu-button"
        size="small"
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => {
          setAnchorEl(undefined);
        }}
        slotProps={{
          list: {
            "aria-label": "node actions button",
            dense: true,
          },
        }}
      >
        {actionsWithUniqueIds.map((action) => {
          if (action.type === "divider") {
            return (
              <Divider
                data-testid="node-actions-menu-divider"
                variant={anyItemHasIcon ? "inset" : "fullWidth"}
                key={`${action.uniqueId}`}
              />
            );
          }
          const Icon = action.icon ? icons[action.icon] : undefined;
          return (
            <MenuItem
              data-testid={`node-actions-menu-item-${action.id}`}
              key={action.id}
              onClick={() => {
                handleClose(action.id);
              }}
            >
              {Icon && (
                <ListItemIcon data-testid={`node-actions-menu-item-icon-${action.id}`}>
                  <Icon fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={!Icon && anyItemHasIcon} disableTypography>
                {action.label}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

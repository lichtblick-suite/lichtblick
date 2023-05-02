// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChevronRight12Regular } from "@fluentui/react-icons";
import { Divider, Menu, MenuItem, MenuItemProps } from "@mui/material";
import { PropsWithChildren, ReactNode, useState } from "react";
import { makeStyles } from "tss-react/mui";

export type MenuItem =
  | {
      type: "item";
      label: ReactNode;
      key: string;
      disabled?: boolean;
      shortcut?: string;
      onClick?: MenuItemProps["onClick"];
      external?: boolean;
    }
  | { type: "divider" };

const useStyles = makeStyles<void, "endIcon">()((theme, _params, classes) => ({
  menu: {
    pointerEvents: "none",
  },
  paper: {
    pointerEvents: "auto",
    marginTop: theme.spacing(-1),
  },
  menuItem: {
    justifyContent: "space-between",
    cursor: "pointer",
    gap: theme.spacing(2),

    "&.Mui-selected, &.Mui-selected:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    [`:not(:hover, :focus) .${classes.endIcon}`]: {
      opacity: 0.6,
    },
    kbd: {
      font: "inherit",
      color: theme.palette.text.disabled,
    },
  },
  menuList: {
    minWidth: 180,
    maxWidth: 220,
  },
  endIcon: {
    marginRight: theme.spacing(-0.75),
  },
}));

export function NestedMenuItem(
  props: PropsWithChildren<{
    id?: string;
    items: MenuItem[];
    open: boolean;
    onPointerEnter: (itemId: string) => void;
  }>,
): JSX.Element {
  const { classes } = useStyles();
  const { children, items, open, onPointerEnter, id } = props;
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLLIElement>(undefined);

  const handlePointerEnter = () => {
    if (id) {
      onPointerEnter(id);
    }
  };

  return (
    <>
      <MenuItem
        id={id}
        ref={(element) => setAnchorEl(element ?? undefined)}
        selected={open}
        className={classes.menuItem}
        onPointerEnter={handlePointerEnter}
        data-testid={id}
      >
        {children}
        <ChevronRight12Regular className={classes.endIcon} />
      </MenuItem>
      <Menu
        classes={{
          root: classes.menu,
          paper: classes.paper,
        }}
        open={open}
        disablePortal
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(undefined)}
        onMouseLeave={() => {
          setAnchorEl(undefined);
        }}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        MenuListProps={{ dense: true, className: classes.menuList }}
        autoFocus={false}
        disableAutoFocus
        disableEnforceFocus
        hideBackdrop
      >
        {items.map((item, idx) =>
          item.type !== "divider" ? (
            <MenuItem
              className={classes.menuItem}
              key={item.key}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.label}
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : undefined}
            </MenuItem>
          ) : (
            <Divider key={`${idx}-divider`} variant="middle" />
          ),
        )}
      </Menu>
    </>
  );
}

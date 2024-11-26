// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Cloud24Regular } from "@fluentui/react-icons";
import {
  ListItemText,
  Menu,
  MenuItem,
  PopoverOrigin,
  PopoverPosition,
  PopoverReference,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentUserType } from "@lichtblick/suite-base/context/CurrentUserContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 280,
  },
  icon: {
    color: theme.palette.primary.main,
    flex: "none",
  },
  menuItem: {
    gap: theme.spacing(1),
  },
  menuText: {
    whiteSpace: "normal",
    flex: "0 1 auto",
  },
}));

type HelpMenuProps = {
  anchorEl?: HTMLElement;
  anchorOrigin?: PopoverOrigin;
  anchorPosition?: PopoverPosition;
  anchorReference?: PopoverReference;
  disablePortal?: boolean;
  handleClose: () => void;
  open: boolean;
  transformOrigin?: PopoverOrigin;
};

export function HelpMenu(props: HelpMenuProps): React.JSX.Element {
  const {
    anchorEl,
    anchorOrigin,
    anchorPosition,
    anchorReference,
    disablePortal,
    handleClose,
    open,
    transformOrigin,
  } = props;
  const { classes } = useStyles();
  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();

  return (
    <Menu
      classes={{ paper: classes.paper }}
      id="help-menu"
      anchorEl={anchorEl}
      anchorOrigin={anchorOrigin}
      anchorReference={anchorReference}
      anchorPosition={anchorPosition}
      disablePortal={disablePortal}
      open={open}
      onClose={handleClose}
      transformOrigin={transformOrigin}
      MenuListProps={{
        "aria-labelledby": "help-button",
      }}
    >
      <MenuItem
        href="https://foxglove.dev/docs/data-platform"
        className={classes.menuItem}
        component="a"
        target="_blank"
        onClick={() => {
          void analytics.logEvent(AppEvent.HELP_MENU_CLICK_CTA, {
            user: currentUserType,
            cta: "docs-data-platform",
          });
          handleClose();
        }}
      >
        <Cloud24Regular className={classes.icon} />
        <ListItemText
          primary="Data Platform"
          secondary="Scalable data management platform"
          secondaryTypographyProps={{ className: classes.menuText }}
        />
      </MenuItem>
    </Menu>
  );
}

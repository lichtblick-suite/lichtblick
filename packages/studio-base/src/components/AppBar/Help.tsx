// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChatHelp24Regular } from "@fluentui/react-icons";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Divider,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  IconButton,
  IconButtonProps,
  MenuProps,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useCurrentUserType } from "@foxglove/studio-base/context/CurrentUserContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

const useStyles = makeStyles()((theme) => ({
  subheader: {
    bgcolor: "transparent",
    border: "none",
  },
  paper: {
    width: 280,
  },
  menuItem: {
    gap: theme.spacing(1),
  },
  menuText: {
    whiteSpace: "normal",
  },
}));

export function HelpIconButton(props: IconButtonProps): JSX.Element {
  return (
    <IconButton {...props}>
      <ChatHelp24Regular />
    </IconButton>
  );
}

export function HelpMenu(
  props: {
    handleClose: () => void;
  } & MenuProps,
): JSX.Element {
  const { anchorEl, handleClose, open, ...menuProps } = props;
  const { classes } = useStyles();
  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();

  return (
    <Menu
      {...menuProps}
      classes={{ paper: classes.paper }}
      id="help-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        "aria-labelledby": "help-button",
      }}
      anchorOrigin={{
        horizontal: "right",
        vertical: "bottom",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
    >
      <ListSubheader className={classes.subheader} tabIndex={-1}>
        Documentation
      </ListSubheader>
      <MenuItem
        href="https://foxglove.dev/docs/studio"
        className={classes.menuItem}
        component="a"
        target="_blank"
        onClick={() => {
          void analytics.logEvent(AppEvent.HELP_MENU_CLICK_CTA, {
            user: currentUserType,
            cta: "docs-studio",
          });
          handleClose();
        }}
      >
        <VisibilityOutlinedIcon color="primary" />
        <ListItemText
          primary="Studio"
          secondary="Open source robotics visualization and debugging."
          secondaryTypographyProps={{ className: classes.menuText }}
        />
      </MenuItem>
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
        <CloudOutlinedIcon color="primary" />
        <ListItemText
          primary="Data Platform"
          secondary="Scalable data management platform"
          secondaryTypographyProps={{ className: classes.menuText }}
        />
      </MenuItem>
      <Divider />
      <ListSubheader className={classes.subheader} tabIndex={-1}>
        Community
      </ListSubheader>
      <MenuItem
        href="https://foxglove.dev/slack"
        className={classes.menuItem}
        component="a"
        target="_blank"
        onClick={() => {
          void analytics.logEvent(AppEvent.HELP_MENU_CLICK_CTA, {
            user: currentUserType,
            cta: "join-slack",
          });
          handleClose();
        }}
      >
        <ForumOutlinedIcon color="primary" />
        <ListItemText
          primary="Join us on Slack"
          secondary="Give us feedback, ask questions, and collaborate with other users."
          secondaryTypographyProps={{ className: classes.menuText }}
        />
      </MenuItem>
    </Menu>
  );
}

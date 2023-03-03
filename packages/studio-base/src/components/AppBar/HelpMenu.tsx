// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ChatBubblesQuestion24Regular,
  Cloud24Regular,
  SlideLayout24Regular,
} from "@fluentui/react-icons";
import { Divider, ListItemText, ListSubheader, Menu, MenuItem, MenuProps } from "@mui/material";
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
  anchorOrigin?: MenuProps["anchorOrigin"];
  handleClose: () => void;
  open: boolean;
  transformOrigin?: MenuProps["transformOrigin"];
};

export function HelpMenu(props: HelpMenuProps): JSX.Element {
  const { anchorEl, anchorOrigin, handleClose, open, transformOrigin } = props;
  const { classes } = useStyles();
  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();

  return (
    <Menu
      classes={{ paper: classes.paper }}
      id="help-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        "aria-labelledby": "help-button",
      }}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
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
        <SlideLayout24Regular className={classes.icon} />
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
        <Cloud24Regular className={classes.icon} />
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
        <ChatBubblesQuestion24Regular className={classes.icon} />
        <ListItemText
          primary="Join us on Slack"
          secondary="Give us feedback, ask questions, and collaborate with other users."
          secondaryTypographyProps={{ className: classes.menuText }}
        />
      </MenuItem>
    </Menu>
  );
}

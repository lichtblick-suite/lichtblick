// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Document20Regular, Flow20Regular, FolderOpen20Regular } from "@fluentui/react-icons";
import {
  Divider,
  ListSubheader,
  Menu,
  MenuItem,
  PopoverPosition,
  PopoverReference,
  Typography,
} from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import { useCurrentUserType } from "@foxglove/studio-base/context/CurrentUserContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { formatKeyboardShortcut } from "@foxglove/studio-base/util/formatKeyboardShortcut";

const useStyles = makeStyles()((theme) => ({
  menuItem: {
    gap: theme.spacing(1),

    svg: {
      color: theme.palette.primary.main,
      flex: "none",
    },
    kbd: {
      font: "inherit",
      color: theme.palette.text.disabled,
    },
  },
  menuText: {
    display: "flex",
    flex: "auto",
    overflow: "hidden",
    maxWidth: "100%",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  paper: {
    minWidth: 240,
    maxWidth: 280,
  },
}));

export type BetaAppMenuProps = {
  handleClose: () => void;
  anchorEl?: HTMLElement;
  anchorReference?: PopoverReference;
  anchorPosition?: PopoverPosition;
  disablePortal?: boolean;
  disableAutoFocus?: boolean;
  disableAutoFocusItem?: boolean;
  open: boolean;
};

export function BetaAppMenu(props: BetaAppMenuProps): JSX.Element {
  const { handleClose } = props;
  const { classes } = useStyles();
  const { appBarMenuItems } = useAppContext();
  const { recentSources, selectRecent } = usePlayerSelection();
  const { t } = useTranslation("appBar");
  const { dialogActions } = useWorkspaceActions();
  const analytics = useAnalytics();
  const user = useCurrentUserType();

  const handleAnalytics = useCallback(
    (cta: string) => void analytics.logEvent(AppEvent.APP_MENU_CLICK, { user, cta }),
    [analytics, user],
  );

  return (
    <Menu
      {...props}
      onClose={handleClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      slotProps={{ paper: { className: classes.paper } }}
      MenuListProps={{
        dense: true,
      }}
    >
      <ListSubheader disableSticky>
        <Typography variant="overline">{t("viewData")}</Typography>
      </ListSubheader>
      <MenuItem
        className={classes.menuItem}
        onClick={() => {
          handleAnalytics("open-file");
          dialogActions.openFile.open().catch(console.error);
          handleClose();
        }}
      >
        <div className={classes.menuText}>
          <FolderOpen20Regular />
          {t("openLocalFile")}
        </div>
        <kbd>{formatKeyboardShortcut("O", ["Meta"])}</kbd>
      </MenuItem>
      <MenuItem
        className={classes.menuItem}
        onClick={() => {
          dialogActions.dataSource.open("connection");
          handleAnalytics("open-connection");
          handleClose();
        }}
      >
        <div className={classes.menuText}>
          <Flow20Regular />
          {t("openConnection")}
        </div>
        <kbd>{formatKeyboardShortcut("O", ["Shift", "Meta"])}</kbd>
      </MenuItem>
      {recentSources.length > 0 && <Divider variant="middle" />}
      {recentSources.length > 0 && (
        <ListSubheader disableSticky>
          <Typography variant="overline">{t("recentlyViewed")}</Typography>
        </ListSubheader>
      )}
      {recentSources.slice(0, 5).map((source) => (
        <MenuItem
          key={source.id}
          className={classes.menuItem}
          onClick={() => {
            handleAnalytics("open-recent");
            selectRecent(source.id);
            handleClose();
          }}
        >
          <div className={classes.menuText}>
            <Document20Regular style={{ flex: "none" }} />
            <TextMiddleTruncate text={source.title} />
          </div>
        </MenuItem>
      ))}
      {appBarMenuItems && <Divider variant="middle" />}
      {(appBarMenuItems ?? []).map((item, idx) => {
        switch (item.type) {
          case "item":
            return (
              <MenuItem
                onClick={(event) => {
                  item.onClick?.(event);
                  handleClose();
                }}
                key={item.key}
                className={classes.menuItem}
              >
                {item.icon}
                {item.label}
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </MenuItem>
            );
          case "divider":
            return <Divider variant="middle" key={`divider${idx}`} />;
          case "subheader":
            return (
              <ListSubheader key={item.key} disableSticky>
                <Typography variant="overline">{item.label}</Typography>
              </ListSubheader>
            );
        }
      })}
    </Menu>
  );
}

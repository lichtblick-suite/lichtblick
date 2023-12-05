// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Divider,
  Menu,
  MenuItem,
  PaperProps,
  PopoverPosition,
  PopoverReference,
} from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import { AppSettingsTab } from "@foxglove/studio-base/components/AppSettingsDialog/AppSettingsDialog";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";

const useStyles = makeStyles()({
  menuList: {
    minWidth: 200,
  },
});

type SettingsMenuProps = {
  handleClose: () => void;
  anchorEl?: HTMLElement;
  anchorReference?: PopoverReference;
  anchorPosition?: PopoverPosition;
  disablePortal?: boolean;
  open: boolean;
};

export function SettingsMenu({
  anchorEl,
  anchorReference,
  anchorPosition,
  disablePortal,
  handleClose,
  open,
}: SettingsMenuProps): JSX.Element {
  const { classes } = useStyles();
  const { t } = useTranslation("appBar");

  const { extensionSettings } = useAppContext();
  const { dialogActions } = useWorkspaceActions();

  const onSettingsClick = useCallback(
    (tab?: AppSettingsTab) => {
      dialogActions.preferences.open(tab);
    },
    [dialogActions.preferences],
  );

  const onDocsClick = useCallback(() => {
    window.open("https://docs.foxglove.dev/docs", "_blank");
  }, []);

  const onSlackClick = useCallback(() => {
    window.open("https://foxglove.dev/slack", "_blank");
  }, []);

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        anchorReference={anchorReference}
        anchorPosition={anchorPosition}
        disablePortal={disablePortal}
        id="user-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        MenuListProps={{ className: classes.menuList, dense: true }}
        PaperProps={
          {
            "data-tourid": "user-menu",
          } as Partial<PaperProps & { "data-tourid"?: string }>
        }
      >
        <MenuItem
          onClick={() => {
            onSettingsClick();
          }}
        >
          {t("settings")}
        </MenuItem>
        {extensionSettings && (
          <MenuItem
            onClick={() => {
              onSettingsClick("extensions");
            }}
          >
            {t("extensions")}
          </MenuItem>
        )}
        <Divider variant="middle" />
        <MenuItem onClick={onDocsClick}>{t("documentation")}</MenuItem>
        <MenuItem onClick={onSlackClick}>{t("joinSlackCommunity")}</MenuItem>
      </Menu>
    </>
  );
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu, MenuItem, PaperProps, PopoverPosition, PopoverReference } from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import { AppSettingsTab } from "@lichtblick/suite-base/components/AppSettingsDialog/types";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

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
}: SettingsMenuProps): React.JSX.Element {
  const { classes } = useStyles();
  const { t } = useTranslation("appBar");

  const { dialogActions } = useWorkspaceActions();

  const onSettingsClick = useCallback(
    (tab?: AppSettingsTab) => {
      dialogActions.preferences.open(tab);
    },
    [dialogActions.preferences],
  );
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
        slotProps={{
          list: {
            className: classes.menuList,
            dense: true,
          },
          paper: {
            "data-tourid": "user-menu",
          } as Partial<PaperProps & { "data-tourid"?: string }>,
        }}
      >
        <MenuItem
          onClick={() => {
            onSettingsClick();
          }}
        >
          {t("settings")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSettingsClick("extensions");
          }}
        >
          {t("extensions")}
        </MenuItem>
      </Menu>
    </>
  );
}

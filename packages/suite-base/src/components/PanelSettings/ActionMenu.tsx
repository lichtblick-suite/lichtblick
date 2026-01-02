// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { IconButton, Menu, MenuItem } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useStyles } from "@lichtblick/suite-base/components/PanelSettings/ActionMenu.style";
import { ActionMenuProps } from "@lichtblick/suite-base/components/PanelSettings/types";

export function ActionMenu({
  allowShare,
  onReset,
  onShare,
  fontSize = "medium",
}: ActionMenuProps): React.JSX.Element {
  const { classes, cx } = useStyles();
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>();
  const { t } = useTranslation("panelSettings");
  const [isMenuOpen, setMenuOpen] = useState(false);

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(undefined);
    setMenuOpen(false);
  }, []);

  const handleShare = useCallback(() => {
    onShare();
    handleClose();
  }, [onShare, handleClose]);

  const handleReset = useCallback(() => {
    onReset();
    handleClose();
  }, [onReset, handleClose]);

  return (
    <div>
      <IconButton
        className={cx({ [classes.iconButtonSmall]: fontSize === "small" })}
        data-testid="basic-button"
        id="basic-button"
        aria-controls={isMenuOpen ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={isMenuOpen ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreVertIcon fontSize={fontSize} />
      </IconButton>
      <Menu
        data-testid="basic-menu"
        id="basic-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleClose}
        slotProps={{
          list: {
            "aria-labelledby": "basic-button",
          },
        }}
      >
        <MenuItem disabled={!allowShare} aria-disabled={!allowShare} onClick={handleShare}>
          {t("importOrExportSettingsWithEllipsis")}
        </MenuItem>
        <MenuItem onClick={handleReset}>{t("resetToDefaults")}</MenuItem>
      </Menu>
    </div>
  );
}

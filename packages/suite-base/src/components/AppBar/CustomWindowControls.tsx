// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseIcon from "@mui/icons-material/Close";
import FilterNoneIcon from "@mui/icons-material/FilterNone";
import MinimizeIcon from "@mui/icons-material/Minimize";
import { IconButton } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import Stack from "@lichtblick/suite-base/components/Stack";

export type CustomWindowControlsProps = {
  showCustomWindowControls?: boolean;
  isMaximized?: boolean;
  // The initial zoom factor is set when the window is created/refreshed. This sets the baseline
  // for the AppBar's counter-zoom behavior, so the AppBar can appear the same size while the rest
  // of the browserWindow zooms in/out.
  initialZoomFactor?: number;
  onMinimizeWindow?: () => void;
  onMaximizeWindow?: () => void;
  onUnmaximizeWindow?: () => void;
  onCloseWindow?: () => void;
};

const useStyles = makeStyles()((theme) => ({
  closeButton: {
    ":hover": {
      backgroundColor: theme.palette.error.main,
    },
  },
}));

export function CustomWindowControls({
  isMaximized = false,
  onMinimizeWindow,
  onMaximizeWindow,
  onUnmaximizeWindow,
  onCloseWindow,
}: Omit<CustomWindowControlsProps, "showCustomWindowControls">): React.JSX.Element {
  const { classes } = useStyles();
  return (
    <Stack direction="row" gap={1} paddingX={1}>
      <IconButton
        size="small"
        color="inherit"
        onClick={onMinimizeWindow}
        data-testid="win-minimize"
      >
        <MinimizeIcon fontSize="inherit" color="inherit" />
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        onClick={isMaximized ? onUnmaximizeWindow : onMaximizeWindow}
        data-testid="win-maximize"
      >
        {isMaximized ? (
          <FilterNoneIcon fontSize="inherit" color="inherit" />
        ) : (
          <CheckBoxOutlineBlankIcon fontSize="inherit" color="inherit" />
        )}
      </IconButton>

      <IconButton
        className={classes.closeButton}
        size="small"
        color="inherit"
        onClick={onCloseWindow}
        data-testid="win-close"
      >
        <CloseIcon fontSize="inherit" color="inherit" />
      </IconButton>
    </Stack>
  );
}

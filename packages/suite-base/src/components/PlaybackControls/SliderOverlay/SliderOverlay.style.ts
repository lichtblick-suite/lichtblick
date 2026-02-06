// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  container: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 100,
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
  },
  slider: {
    width: "100%",
    height: 32,
    "& .MuiSlider-thumb": {
      width: 12,
      height: 12,
    },
    "& .MuiSlider-track": {
      backgroundColor: theme.palette.primary.main,
      // TO DO For some reason this is getting inherited to the time slider in the scrubber, where it causes issues. Need to fix
      opacity: 0.3,
      border: 0,
      height: 22,
    },
    "& .MuiSlider-rail": {
      opacity: 0,
    },
  },
}));

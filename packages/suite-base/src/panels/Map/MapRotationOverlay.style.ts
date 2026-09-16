// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { alpha } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { COMPASS_SIZE } from "@lichtblick/suite-base/panels/Map/constants";

export const useStyles = makeStyles()((theme) => ({
  compass: {
    position: "absolute",
    top: 8,
    right: 8,
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: "50%",
    // Slightly translucent so the tiles underneath stay readable, while still separating
    // the compass from whatever happens to be beneath it.
    background: alpha(theme.palette.background.paper, 0.85),
    boxShadow: `0 0 2px ${alpha(theme.palette.common.black, 0.5)}`,
    pointerEvents: "none",
    // Leaflet's own controls sit at 1000; the compass belongs with them, above the tiles.
    zIndex: 1000,
    // The map container is turned by -heading, so north ends up at the same angle on screen.
    transform: "rotate(calc(-1 * var(--map-heading, 0deg)))",
  },
}));

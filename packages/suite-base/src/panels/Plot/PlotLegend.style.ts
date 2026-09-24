// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { PANEL_TOOLBAR_MIN_HEIGHT } from "@lichtblick/suite-base/components/PanelToolbar/constants";

import { ROW_HEIGHT } from "./PlotLegendRow";

export const useStyles = makeStyles<
  { floatingToolbar: boolean },
  "grid" | "toggleButton" | "toggleButtonFloating"
>()(({ palette, shadows, shape, spacing }, { floatingToolbar }, classes) => ({
  root: {
    display: "flex",
    overflow: "hidden",
  },
  rootFloating: {
    pointerEvents: "none",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    position: "absolute",
    inset: "0 0 0 0",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    zIndex: 1000,
    gap: spacing(0.75),
    // Extra top clearance (beyond the usual padding) so the legend doesn't render underneath
    // the panel's floating title - only needed when the toolbar actually floats; otherwise the
    // toolbar already reserves its own space above the legend.
    padding: floatingToolbar
      ? `calc(${spacing(1.5)} + ${PANEL_TOOLBAR_MIN_HEIGHT}px) ${spacing(3.75)} ${spacing(4)} ${spacing(4.5)}`
      : spacing(1.5, 3.75, 4, 4.5),

    [`.${classes.grid}`]: {
      pointerEvents: "auto",
      flex: "0 1 auto",
      width: "max-content",
      maxHeight: "100%",
      borderRadius: shape.borderRadius,
      gridTemplateColumns: "auto repeat(2, minmax(max-content, auto)) auto",
      backgroundImage: `linear-gradient(${[
        "0deg",
        tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
      ].join(" ,")})`,
      backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
      backdropFilter: "blur(3px)",
      boxShadow: shadows[3],
    },
  },
  rootLeft: {
    alignItems: "flex-start",
    maxWidth: "80%",
    // Clear the panel's floating title, which otherwise renders on top of the legend. Not
    // needed when the toolbar reserves its own space instead of floating.
    paddingTop: floatingToolbar ? PANEL_TOOLBAR_MIN_HEIGHT : 0,

    [`.${classes.toggleButton}`]: {
      padding: spacing(0.25),
      height: "100%",
      borderRadius: 0,
      borderTop: "none",
      borderBottom: "none",
    },
    [`.${classes.grid}`]: {
      overflow: "auto",
      height: "100%",
      alignContent: "flex-start",
    },
  },
  rootTop: {
    flexDirection: "column",
    maxHeight: "80%",
    // Clear the panel's floating title, which otherwise renders on top of the legend. Not
    // needed when the toolbar reserves its own space instead of floating.
    paddingTop: floatingToolbar ? PANEL_TOOLBAR_MIN_HEIGHT : 0,

    [`.${classes.toggleButton}`]: {
      padding: spacing(0.25),
      borderRadius: 0,
      borderRight: "none",
      borderLeft: "none",
    },
  },
  grid: {
    alignItems: "center",
    display: "grid",
    gridTemplateColumns: "auto repeat(2, minmax(max-content, 1fr)) auto",
    gridAutoRows: ROW_HEIGHT,
    width: "100%",
    columnGap: 1,
    overflow: "auto",
    justifyItems: "flex-start",
  },
  dragHandle: {
    userSelect: "none",
    border: `0px solid ${palette.action.hover}`,

    "&:hover": {
      borderColor: palette.action.selected,
    },
  },
  toggleButton: {},
  toggleButtonFloating: {
    backdropFilter: "blur(3px)",
    pointerEvents: "auto",
    backgroundImage: `linear-gradient(${[
      "0deg",
      tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
      tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
    ].join(" ,")})`,
    backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
    boxShadow: shadows[3],

    "&:hover": {
      backgroundColor: palette.background.paper,
      backgroundImage: `linear-gradient(0deg, ${palette.action.hover}, ${palette.action.hover})`,
    },
  },
}));

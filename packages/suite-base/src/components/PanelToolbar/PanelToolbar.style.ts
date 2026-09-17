// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { alpha } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { PANEL_TOOLBAR_MIN_HEIGHT } from "@lichtblick/suite-base/components/PanelToolbar/constants";

export const useStyles = makeStyles()((theme) => ({
  root: {
    transition: "transform 80ms ease-in-out, opacity 80ms ease-in-out",
    cursor: "auto",
    flex: "0 0 auto",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: theme.spacing(0.25, 0.75),
    display: "flex",
    minHeight: PANEL_TOOLBAR_MIN_HEIGHT,
    backgroundColor: theme.palette.background.paper,
    width: "100%",
    left: 0,
    zIndex: theme.zIndex.appBar,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    position: "relative !important" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    top: "auto !important" as any,
  },
  // Toolbar no longer reserves layout space: it floats on top of the panel content instead of
  // pushing it down. Only the title (see `floatingTitle`) stays always visible; the rest of the
  // toolbar (see `floatingControls`) is transparent until hovered, so it doesn't visually cover
  // the content underneath when not in use.
  floatingRoot: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    position: "absolute !important" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    top: "0 !important" as any,
    backgroundColor: "transparent",
    pointerEvents: "none",
    // Keep the title pinned to the start and the controls pinned to the end without either one
    // growing to fill the row, so each one's background only wraps its own content.
    justifyContent: "space-between",
  },
  floatingTitle: {
    pointerEvents: "none",
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.25, 0.75),
  },
  floatingControls: {
    opacity: 0,
    pointerEvents: "auto",
    transition: "opacity 80ms ease-in-out",
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
    borderRadius: theme.shape.borderRadius,

    // Keyboard users tab through the (invisible until hovered) controls same as anyone else; if
    // a control receives focus it must be shown, or a sighted keyboard user could focus and
    // invoke a control they can't see.
    "&:focus-within": {
      opacity: 1,
    },
    "&:hover": {
      opacity: 1,
    },
  },
  // Applied in addition to `floatingControls` while the mouse is anywhere within the panel, so
  // the controls aren't only revealed when hovering their own small area.
  floatingControlsVisible: {
    opacity: 1,
  },
}));

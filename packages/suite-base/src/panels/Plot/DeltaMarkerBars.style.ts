// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useDeltaMarkerBarsStyles = makeStyles()((theme) => ({
  markerBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    display: "none",
    pointerEvents: "none",
    borderLeft: "2px dashed",
  },
  horizontalMarkerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    display: "none",
    pointerEvents: "none",
    borderTop: "2px dashed",
  },
  markerPoint: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    marginTop: -4,
    marginLeft: -4,
    display: "none",
    pointerEvents: "none",
    borderRadius: 1,
  },
  markerLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    display: "none",
    pointerEvents: "none",
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.borderRadius,
    whiteSpace: "nowrap",
  },
  overlayWrapper: {
    position: "absolute",
    // Top-right (not top-left like the Foxglove reference): the floating series legend also
    // renders top-left in this app, so top-left would guarantee a collision here.
    top: 0,
    right: 0,
    margin: theme.spacing(1),
    zIndex: 2,
  },
}));

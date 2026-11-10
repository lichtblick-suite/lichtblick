// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStateTransitionsStyles = makeStyles()((theme) => ({
  chartWrapper: {
    position: "relative",
    marginTop: theme.spacing(0.5),
    height: "100%",
  },
  deltaOverlayWrapper: {
    position: "absolute",
    // Top-right (not top-left like Plot/the Foxglove reference): PathLegend's topic rows span the
    // full width from the left edge here, so the top-left corner is already occupied.
    top: 0,
    right: 0,
    margin: theme.spacing(1),
    pointerEvents: "auto",
    zIndex: 2,
  },
}));

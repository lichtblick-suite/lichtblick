// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()(() => ({
  root: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    justifyContent: "space-around",
    overflow: "hidden",
    padding: 8,
    width: "100%",
  },
  gaugeContainer: {
    overflow: "hidden",
    width: "100%",
  },
  gaugeWrapper: {
    aspectRatio: "1 / 1",
    margin: "0 auto",
    maxHeight: "100%",
    maxWidth: "100%",
    position: "relative",
    transform: "scale(1)", // Work around a Safari bug: https://bugs.webkit.org/show_bug.cgi?id=231849
  },
  conicGradient: {
    clipPath: "none",
    height: "100%",
    opacity: 0.5,
    width: "100%",
  },
  needle: {
    backgroundColor: "white",
    border: "2px solid black",
    borderRadius: 4,
    bottom: 0,
    display: "none",
    left: "50%",
    margin: "0 auto",
    position: "absolute",
    transformOrigin: "bottom left",
  },
}));

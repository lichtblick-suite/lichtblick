// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useLayoutSectionStyles = makeStyles()((theme) => ({
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    justifyContent: "flex-start",
    gap: theme.spacing(0.5),
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  arrow: {
    fontSize: "1.25rem",
    color: theme.palette.text.secondary,
    transition: theme.transitions.create("transform", {
      duration: theme.transitions.duration.shortest,
    }),
  },
  arrowCollapsed: {
    transform: "rotate(-90deg)",
  },
}));

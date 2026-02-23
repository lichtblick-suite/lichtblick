// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStyles = makeStyles()((theme) => ({
  root: {
    position: "fixed",
    zIndex: theme.zIndex.tooltip,
    maxWidth: 620,
    maxHeight: 480,
    overflow: "auto",
    padding: theme.spacing(1, 1.5),
    transition: "opacity 0.15s ease",
    scrollbarColor: `${theme.palette.action.disabled} ${theme.palette.action.hover}`,
    "&::-webkit-scrollbar": {
      width: 16,
      height: 16,
    },
    "&::-webkit-scrollbar-track": {
      background: theme.palette.action.hover,
      borderRadius: theme.shape.borderRadius,
    },
    "&::-webkit-scrollbar-thumb": {
      background: theme.palette.action.disabled,
      borderRadius: theme.shape.borderRadius,
      border: `2px solid ${theme.palette.background.paper}`,
      "&:hover": {
        background: theme.palette.action.active,
      },
    },
  },
  entitySection: {
    marginBottom: theme.spacing(0.75),
    "&:last-child": {
      marginBottom: 0,
    },
  },
  entityId: {
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.info.main,
    fontSize: "0.75rem",
    display: "block",
  },
  topicLine: {
    color: theme.palette.text.secondary,
    fontSize: "0.7rem",
    marginBottom: theme.spacing(0.25),
    display: "block",
  },
  divider: {
    margin: theme.spacing(0.75, 0),
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: theme.spacing(0.25),
  },
  tableRow: {
    "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  keyCell: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    paddingRight: theme.spacing(2),
    paddingTop: 1,
    paddingBottom: 1,
    verticalAlign: "top",
  },
  valueCell: {
    fontSize: "0.75rem",
    fontFamily: customTypography.fontMonospace,
    textAlign: "right",
    wordBreak: "break-all",
    paddingTop: 1,
    paddingBottom: 1,
  },
  pinHint: {
    fontSize: "0.65rem",
    color: theme.palette.text.disabled,
    textAlign: "center",
    marginTop: theme.spacing(0.75),
    fontStyle: "italic",
    display: "block",
  },
}));

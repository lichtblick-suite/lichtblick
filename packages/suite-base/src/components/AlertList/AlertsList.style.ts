// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { accordionSummaryClasses } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStyles = makeStyles()((theme) => ({
  accordion: {
    background: "none",
    boxShadow: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,

    "&:before": {
      display: "none",
    },
    "&.Mui-expanded": {
      margin: 0,
    },
  },
  accordionDetails: {
    display: "flex",
    flexDirection: "column",
    fontFamily: customTypography.fontMonospace,
    fontSize: "0.6875rem",
    padding: theme.spacing(1.125),
    gap: theme.spacing(1),
  },
  accordionSummary: {
    height: 30,
    minHeight: "auto",
    flex: "1 1 auto",
    minWidth: 0,
    padding: theme.spacing(0, 0.5, 0, 0.75),
    fontWeight: 500,

    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&.Mui-expanded": {
      minHeight: "auto",
    },
    [`& .${accordionSummaryClasses.content}`]: {
      gap: theme.spacing(0.5),
      overflow: "hidden",
      alignItems: "center",
      margin: "0 !important",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}`]: {
      transform: "rotate(-90deg)",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}.Mui-expanded`]: {
      transform: "rotate(0deg)",
    },
  },
  detailsText: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    maxHeight: "30vh",
    overflow: "auto",
    flex: 1,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(1),
  },
  icon: {
    flex: "none",
  },
  rowHeader: {
    display: "flex",
    alignItems: "center",
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    flex: "none",
    paddingRight: theme.spacing(0.5),
  },
  countBadge: {
    flex: "none",
    backgroundColor: theme.palette.action.selected,
    borderRadius: 8,
    padding: theme.spacing(0, 0.75),
    lineHeight: 1.6,
    marginLeft: theme.spacing(0.5),
  },
}));

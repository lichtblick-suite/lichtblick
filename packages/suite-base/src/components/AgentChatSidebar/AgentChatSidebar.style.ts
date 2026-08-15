// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    backgroundColor: theme.palette.background.paper,
  },
  header: {
    flex: "none",
    minHeight: theme.spacing(4.5),
    padding: theme.spacing(0.75, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  profileSelect: {
    maxWidth: 180,
    minWidth: 112,
    height: theme.spacing(3.5),
    fontSize: theme.typography.caption.fontSize,
  },
  conversationPopover: {
    width: 320,
    maxWidth: "calc(100vw - 32px)",
  },
  conversationList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    maxHeight: 420,
    padding: theme.spacing(1),
    overflowY: "auto",
  },
  conversationListStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    minHeight: theme.spacing(8),
    padding: theme.spacing(1),
    textAlign: "center",
  },
  conversationListAlert: {
    flex: "none",
  },
  messages: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: theme.spacing(1.5),
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  showEarlierButton: {
    alignSelf: "center",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(0.5),
    minHeight: "100%",
    padding: theme.spacing(3),
    textAlign: "center",
  },
  message: {
    maxWidth: "92%",
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.shape.borderRadius,
    overflowWrap: "anywhere",
  },
  userMessage: {
    alignSelf: "flex-end",
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
  },
  roleLabel: {
    display: "block",
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  userRoleLabel: {
    color: theme.palette.primary.contrastText,
  },
  toolCard: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
  },
  toolToggleButton: {
    flex: "none",
    padding: theme.spacing(0.25),
  },
  toolName: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    fontFamily: customTypography.fontMonospace,
    fontWeight: 500,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  toolStatusChip: {
    flex: "none",
  },
  toolCardBody: {
    marginTop: theme.spacing(0.75),
  },
  toolSummary: {
    marginTop: theme.spacing(0.75),
  },
  toolError: {
    marginTop: theme.spacing(0.75),
  },
  toolResult: {
    marginTop: theme.spacing(0.75),
    marginBottom: 0,
    maxHeight: 240,
    overflow: "auto",
    padding: theme.spacing(0.75),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    fontFamily: customTypography.fontMonospace,
    fontSize: "0.75rem",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  progress: {
    marginTop: theme.spacing(1),
  },
  cardActions: {
    marginTop: theme.spacing(1),
  },
  proposalCard: {
    alignSelf: "stretch",
    padding: theme.spacing(1.25),
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.background.paper,
  },
  proposalName: {
    margin: theme.spacing(0.25, 0, 0.75),
  },
  proposalPending: {
    marginTop: theme.spacing(0.75),
  },
  error: {
    flex: "none",
    borderRadius: 0,
  },
  liveRegion: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  composer: {
    flex: "none",
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
}));

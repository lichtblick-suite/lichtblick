// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { AgentChatState, useAgentChat } from "@lichtblick/suite-base/context/AgentChatContext";

import { useStyles } from "./AgentChatSidebar.style";

const selectConversations = (state: AgentChatState) => state.conversations;
const selectActiveConversationId = (state: AgentChatState) => state.activeConversationId;
const selectConversationsLoading = (state: AgentChatState) => state.conversationsLoading;
const selectConversationsOffline = (state: AgentChatState) => state.conversationsOffline;
const selectActions = (state: AgentChatState) => state.actions;

function formatRelativeTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(deltaSeconds) < 60) {
    return formatter.format(deltaSeconds, "second");
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, "minute");
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, "hour");
  }
  return formatter.format(Math.round(deltaHours / 24), "day");
}

export function ConversationList({
  onConversationSelected,
}: {
  onConversationSelected?: () => void;
}): React.JSX.Element {
  const { classes } = useStyles();
  const { i18n, t } = useTranslation("agentChat");
  const conversations = useAgentChat(selectConversations);
  const activeConversationId = useAgentChat(selectActiveConversationId);
  const loading = useAgentChat(selectConversationsLoading);
  const offline = useAgentChat(selectConversationsOffline);
  const actions = useAgentChat(selectActions);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className={classes.conversationList} data-testid="agent-chat-conversation-list">
      <Button
        fullWidth
        startIcon={<AddCommentOutlinedIcon />}
        onClick={() => {
          actions.startNewConversation();
          onConversationSelected?.();
        }}
      >
        {t("conversationList.newConversation")}
      </Button>

      {loading && conversations.length === 0 && (
        <div className={classes.conversationListStatus}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">
            {t("conversationList.loading")}
          </Typography>
        </div>
      )}

      {offline && (
        <Alert severity="warning" className={classes.conversationListAlert}>
          {t("conversationList.offline")}
        </Alert>
      )}

      {!loading && !offline && conversations.length === 0 && (
        <Typography
          className={classes.conversationListStatus}
          color="text.secondary"
          variant="body2"
        >
          {t("conversationList.empty")}
        </Typography>
      )}

      {conversations.length > 0 && (
        <List dense disablePadding>
          {conversations.map((conversation) => (
            <ListItem
              disablePadding
              key={conversation.conversationId}
              secondaryAction={
                <IconButton
                  aria-label={t("conversationList.delete", {
                    title: conversation.title,
                  })}
                  edge="end"
                  size="small"
                  onClick={() => {
                    void actions.deleteConversation(conversation.conversationId);
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={conversation.conversationId === activeConversationId}
                onClick={() => {
                  void actions.switchConversation(conversation.conversationId);
                  onConversationSelected?.();
                }}
              >
                <ListItemText
                  primary={conversation.title || t("conversationList.untitled")}
                  secondary={t(
                    conversation.profileName == undefined
                      ? "conversationList.metadata"
                      : "conversationList.profileMetadata",
                    {
                      count: conversation.messageCount,
                      profileName: conversation.profileName,
                      time: formatRelativeTime(conversation.updatedAt, locale),
                    },
                  )}
                  slotProps={{
                    primary: { noWrap: true },
                    secondary: { noWrap: true },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
}

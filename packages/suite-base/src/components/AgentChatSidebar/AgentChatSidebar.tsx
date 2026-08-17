// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Button,
  Chip,
  ChipProps,
  CircularProgress,
  IconButton,
  MenuItem,
  Popover,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Stack from "@lichtblick/suite-base/components/Stack";
import {
  AgentChatState,
  AgentChatStatus,
  useAgentChat,
} from "@lichtblick/suite-base/context/AgentChatContext";

import { useStyles } from "./AgentChatSidebar.style";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";

const AUTO_SCROLL_THRESHOLD_PX = 80;

const STATUS_LABEL_KEYS = {
  idle: "status.idle",
  connecting: "status.connecting",
  streaming: "status.streaming",
  "waiting-for-catalog": "status.waitingForCatalog",
  error: "status.error",
} as const satisfies Record<AgentChatStatus, string>;

const STATUS_COLORS: Record<AgentChatStatus, ChipProps["color"]> = {
  idle: "default",
  connecting: "info",
  streaming: "primary",
  "waiting-for-catalog": "warning",
  error: "error",
};

const selectMessages = (state: AgentChatState) => state.messages;
const selectStatus = (state: AgentChatState) => state.status;
const selectPendingProposal = (state: AgentChatState) => state.pendingProposal;
const selectPendingProposalMessageId = (state: AgentChatState) => state.pendingProposalMessageId;
const selectPendingProposalRequestId = (state: AgentChatState) => state.pendingProposalRequestId;
const selectError = (state: AgentChatState) => state.error;
const selectActions = (state: AgentChatState) => state.actions;
const selectProfileOptions = (state: AgentChatState) => state.profileOptions;
const selectSelectedProfileId = (state: AgentChatState) => state.selectedProfileId;
const selectProfile = (state: AgentChatState) => state.selectProfile;

export function AgentChatSidebar(): React.JSX.Element {
  const { classes } = useStyles();
  const { t } = useTranslation("agentChat");
  const messages = useAgentChat(selectMessages);
  const status = useAgentChat(selectStatus);
  const pendingProposal = useAgentChat(selectPendingProposal);
  const pendingProposalMessageId = useAgentChat(selectPendingProposalMessageId);
  const pendingProposalRequestId = useAgentChat(selectPendingProposalRequestId);
  const error = useAgentChat(selectError);
  const actions = useAgentChat(selectActions);
  const profileOptions = useAgentChat(selectProfileOptions) ?? [];
  const selectedProfileId = useAgentChat(selectSelectedProfileId);
  const onSelectProfile = useAgentChat(selectProfile);

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [conversationListAnchor, setConversationListAnchor] = useState<HTMLElement>();
  const bottomRef = useRef<HTMLDivElement>(ReactNull);
  const messagesRef = useRef<HTMLDivElement>(ReactNull);
  const scrollFrameRef = useRef<number>();
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const element = messagesRef.current;
    if (element == undefined) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > AUTO_SCROLL_THRESHOLD_PX || scrollFrameRef.current != undefined) {
      return;
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = undefined;
      const currentElement = messagesRef.current;
      if (currentElement == undefined) {
        return;
      }
      const currentDistanceFromBottom =
        currentElement.scrollHeight - currentElement.scrollTop - currentElement.clientHeight;
      if (currentDistanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX) {
        bottomRef.current?.scrollIntoView({ block: "end" });
      }
    });
  }, [messages, pendingProposal]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current != undefined) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const isBusy =
    submitting ||
    status === "connecting" ||
    status === "streaming" ||
    status === "waiting-for-catalog";

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (text === "" || isBusy || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setDraft("");
    setSubmitting(true);
    try {
      await actions.sendMessage(text);
    } catch {
      if (mountedRef.current) {
        setDraft(text);
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [actions, draft, isBusy]);

  const showBusyIndicator = status !== "idle" && status !== "error";
  const statusLabel = t(STATUS_LABEL_KEYS[status]);
  const latestMessage = messages.at(-1);
  const latestCompletedMessage =
    status === "idle" && latestMessage?.role === "assistant" ? latestMessage.content : undefined;

  return (
    <div
      aria-label={t("title")}
      className={classes.root}
      data-testid="agent-chat-sidebar"
      role="region"
    >
      <Stack
        className={classes.header}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography component="h2" variant="subtitle2">
            {t("title")}
          </Typography>
          {profileOptions.length > 0 &&
            selectedProfileId != undefined &&
            onSelectProfile != undefined && (
              <Select
                className={classes.profileSelect}
                disabled={isBusy}
                inputProps={{ "aria-label": t("profileSelector.label") }}
                size="small"
                title={
                  messages.length > 0 ? t("profileSelector.appliesToFutureMessages") : undefined
                }
                value={selectedProfileId}
                onChange={(event) => {
                  onSelectProfile(event.target.value);
                }}
              >
                {profileOptions.map((profile) => (
                  <MenuItem key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.isActive ? " ★" : ""}
                  </MenuItem>
                ))}
              </Select>
            )}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          {showBusyIndicator && <CircularProgress aria-label={statusLabel} size={14} />}
          <IconButton
            aria-label={t("conversationList.history")}
            data-testid="agent-chat-conversation-history"
            size="small"
            title={t("conversationList.history")}
            onClick={(event) => {
              setConversationListAnchor(event.currentTarget);
              void actions.refreshConversations();
            }}
          >
            <HistoryOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton
            aria-label={t("newConversation")}
            data-testid="agent-chat-new-conversation"
            disabled={messages.length === 0 && status === "idle"}
            size="small"
            title={t("newConversation")}
            onClick={() => {
              actions.startNewConversation();
            }}
          >
            <AddCommentOutlinedIcon fontSize="small" />
          </IconButton>
          <Chip
            size="small"
            color={STATUS_COLORS[status]}
            label={statusLabel}
            data-testid="agent-chat-status"
          />
          {status === "waiting-for-catalog" && (
            <Button
              size="small"
              onClick={() => {
                actions.cancelWaiting();
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </Stack>
      </Stack>
      <Popover
        anchorEl={conversationListAnchor}
        open={conversationListAnchor != undefined}
        slotProps={{ paper: { className: classes.conversationPopover } }}
        onClose={() => {
          setConversationListAnchor(undefined);
        }}
      >
        <ConversationList
          onConversationSelected={() => {
            setConversationListAnchor(undefined);
          }}
        />
      </Popover>

      <div
        aria-busy={
          status === "connecting" || status === "streaming" || status === "waiting-for-catalog"
        }
        aria-label={t("title")}
        aria-live="off"
        className={classes.messages}
        ref={messagesRef}
        role="log"
      >
        <MessageList
          messages={messages}
          pendingProposal={pendingProposal}
          pendingProposalMessageId={pendingProposalMessageId}
          pendingProposalRequestId={pendingProposalRequestId}
          status={status}
        />
        <div ref={bottomRef} data-testid="agent-chat-bottom" />
      </div>
      <div aria-atomic="true" aria-live="polite" className={classes.liveRegion}>
        {latestCompletedMessage}
      </div>

      {error != undefined && (
        <Alert
          className={classes.error}
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                actions.reset();
              }}
            >
              {t("reset")}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Stack className={classes.composer} direction="row" alignItems="flex-end" gap={1}>
        <TextField
          fullWidth
          multiline
          maxRows={6}
          size="small"
          value={draft}
          disabled={isBusy}
          placeholder={t("inputPlaceholder")}
          slotProps={{
            htmlInput: {
              "aria-label": t("inputLabel"),
            },
          }}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <IconButton
          color="primary"
          disabled={draft.trim() === "" || isBusy}
          aria-label={t("send")}
          title={t("send")}
          onClick={() => {
            void handleSend();
          }}
        >
          {submitting ? <CircularProgress aria-label={t("send")} size={20} /> : <SendIcon />}
        </IconButton>
      </Stack>
    </div>
  );
}

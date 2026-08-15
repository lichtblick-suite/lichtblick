// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { type StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@lichtblick/hooks";
import type { ConversationSummary } from "@lichtblick/suite-base/services/agent/memory/AgentConversationStore";
import type {
  ChatMessage,
  LayoutProposal,
  LayoutProposalMode,
  ToolConfirmationOptions,
} from "@lichtblick/suite-base/services/agent/types";

export type AgentChatStatus = "idle" | "connecting" | "streaming" | "waiting-for-catalog" | "error";

export type AgentChatProfileOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AgentChatState = {
  sessionId?: string;
  messages: ChatMessage[];
  conversations: ConversationSummary[];
  activeConversationId?: string;
  conversationsLoading: boolean;
  conversationsOffline: boolean;
  status: AgentChatStatus;
  profileOptions?: readonly AgentChatProfileOption[];
  selectedProfileId?: string;
  selectProfile?: (profileId: string) => void;
  waitingRequest?: {
    requestId: string;
    urls: readonly string[];
  };
  pendingProposal?: LayoutProposal;
  pendingProposalMessageId?: string;
  pendingProposalRequestId?: string;
  /** Display mode for the pending proposal card, computed when the proposal is enqueued. */
  pendingProposalMode?: LayoutProposalMode;
  error?: string;
  actions: {
    sendMessage: (text: string) => Promise<void>;
    confirmToolRun: (
      toolRunId: string,
      options: ToolConfirmationOptions,
    ) => Promise<void>;
    applyProposal: () => Promise<void>;
    dismissProposal: () => void;
    notifyCatalogReady: (requestId: string) => void;
    cancelWaiting: () => void;
    reset: () => void;
    /** Compatibility alias for startNewConversation. */
    newConversation: () => void;
    /** Leaves the current conversation in history and starts a fresh one. */
    startNewConversation: () => void;
    switchConversation: (conversationId: string) => Promise<void>;
    deleteConversation: (conversationId: string) => Promise<void>;
    refreshConversations: () => Promise<void>;
  };
};

export const AgentChatContext = createContext<StoreApi<AgentChatState> | undefined>(undefined);
AgentChatContext.displayName = "AgentChatContext";

export function useAgentChat<T>(selector: (state: AgentChatState) => T): T {
  const context = useGuaranteedContext(AgentChatContext, "AgentChatContext");
  return useStore(context, selector);
}

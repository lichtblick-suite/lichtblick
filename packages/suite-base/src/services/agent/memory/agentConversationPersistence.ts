// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { AgentMessage } from "@earendil-works/pi-agent-core";

import { KEY_WORKSPACE_PREFIX } from "@lichtblick/suite-base/constants/browserStorageKeys";

import type {
  ConversationListPage,
  StoredConversation,
} from "./AgentConversationStore";

export const AGENT_CONVERSATION_ID_KEY = `${KEY_WORKSPACE_PREFIX}studio.agent.conversation-id`;
export const PI_LLM_HISTORY_FORMAT = "pi/v1" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

function isPiAgentMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value) || !Number.isFinite(value.timestamp)) {
    return false;
  }
  switch (value.role) {
    case "user":
      return typeof value.content === "string" || Array.isArray(value.content);
    case "assistant":
      return (
        Array.isArray(value.content) &&
        typeof value.api === "string" &&
        typeof value.provider === "string" &&
        typeof value.model === "string" &&
        isRecord(value.usage) &&
        typeof value.stopReason === "string"
      );
    case "toolResult":
      return (
        typeof value.toolCallId === "string" &&
        typeof value.toolName === "string" &&
        Array.isArray(value.content) &&
        typeof value.isError === "boolean"
      );
    default:
      return false;
  }
}

function clonePiHistory(history: readonly unknown[]): AgentMessage[] {
  try {
    const serialized = JSON.stringify(history);
    if (serialized == undefined) {
      return [];
    }
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.every(isPiAgentMessage) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reads the active conversation id, minting and persisting one on first use.
 *
 * Kept in localStorage under the workspace prefix so parallel dev workspaces do not share a
 * transcript. Storage failures fall back to an in-memory id: the conversation then simply will not
 * survive a reload, which is better than refusing to start.
 */
export function getOrCreateConversationId(makeId: () => string): string {
  try {
    // A missing or blocked localStorage throws here and is handled by the catch below.
    const existing = globalThis.localStorage.getItem(AGENT_CONVERSATION_ID_KEY);
    if (existing != undefined && existing.length > 0) {
      return existing;
    }
    const created = makeId();
    globalThis.localStorage.setItem(AGENT_CONVERSATION_ID_KEY, created);
    return created;
  } catch {
    return makeId();
  }
}

function rememberConversationId(conversationId: string): void {
  try {
    globalThis.localStorage.setItem(AGENT_CONVERSATION_ID_KEY, conversationId);
  } catch {
    // Without storage the new conversation simply will not survive a reload.
  }
}

/**
 * Coordinates persistence of the two halves of a conversation.
 *
 * The UI transcript is owned by the chat provider and the LLM transcript by the orchestrator, but
 * restoring one without the other would show the user messages the model cannot recall. This holds
 * both and writes them as one record.
 */
export type AgentConversationPersistence = {
  getActiveConversationId: () => string;
  /** Restores only versioned pi context; legacy transcripts deliberately start a fresh context. */
  restorePiLlmHistory: () => Promise<AgentMessage[]>;
  restoreUiMessages: () => Promise<unknown[]>;
  /** Persists the pi Agent state with an explicit format marker. */
  onPiLlmHistoryChanged: (history: readonly AgentMessage[]) => void;
  onUiMessagesChanged: (messages: readonly unknown[]) => void;
  /** Records the profile used for the next message; later sends overwrite the prior stamp. */
  setProfileName: (profileName: string | undefined) => void;
  /**
   * Leaves the current conversation in storage and starts a new one.
   *
   * Rotating the id rather than only clearing state matters: the orchestrator re-reads the stored
   * transcript whenever it creates a session, so a "new conversation" that left the old record in
   * place would silently pull the old history back into the model's context.
   */
  startNewConversation: () => string;
  switchConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  listConversations: (
    page?: number,
    pageSize?: number,
  ) => Promise<ConversationListPage & { offline: boolean }>;
  clear: () => void;
};

type ConversationStore = {
  load: (conversationId: string) => Promise<StoredConversation | undefined>;
  save: (conversation: StoredConversation) => Promise<void>;
  delete: (conversationId: string) => Promise<void>;
  list?: (page: number, pageSize: number) => Promise<ConversationListPage>;
};

export function createAgentConversationPersistence({
  conversationId: initialConversationId,
  makeId,
  now = () => new Date(),
  store,
}: {
  conversationId: string;
  /** Mints the id for a new conversation. */
  makeId: () => string;
  now?: () => Date;
  store: ConversationStore;
}): AgentConversationPersistence {
  let conversationId = initialConversationId;
  let loaded: Promise<StoredConversation | undefined> | undefined;
  let llmHistory: unknown[] = [];
  let llmHistoryFormat: StoredConversation["llmHistoryFormat"];
  let profileName: string | undefined;
  let uiMessages: unknown[] = [];
  // Serializes writes so two rapid changes cannot interleave into a torn record.
  let writeQueue: Promise<void> = Promise.resolve();

  const load = async (): Promise<StoredConversation | undefined> => {
    loaded ??= store.load(conversationId);
    const record = await loaded;
    llmHistory = record?.llmHistory ?? [];
    llmHistoryFormat = record?.llmHistoryFormat;
    profileName = record?.profileName;
    uiMessages = record?.uiMessages ?? [];
    return record;
  };

  const flush = () => {
    const snapshot: StoredConversation = {
      conversationId,
      updatedAt: now().toISOString(),
      llmHistory: [...llmHistory],
      ...(llmHistoryFormat == undefined ? {} : { llmHistoryFormat }),
      ...(profileName == undefined ? {} : { profileName }),
      uiMessages: [...uiMessages],
    };
    writeQueue = writeQueue.then(async () => {
      await store.save(snapshot);
    });
  };

  return {
    getActiveConversationId: () => conversationId,
    restorePiLlmHistory: async () => {
      await load();
      // The pi/v1 format marker guards against misreading legacy unversioned transcripts.
      return llmHistoryFormat === PI_LLM_HISTORY_FORMAT ? clonePiHistory(llmHistory) : [];
    },
    restoreUiMessages: async () => {
      await load();
      return [...uiMessages];
    },
    onPiLlmHistoryChanged: (history) => {
      llmHistory = clonePiHistory(history);
      llmHistoryFormat = PI_LLM_HISTORY_FORMAT;
      flush();
    },
    onUiMessagesChanged: (messages) => {
      uiMessages = [...messages];
      flush();
    },
    setProfileName: (nextProfileName) => {
      profileName = nextProfileName;
    },
    startNewConversation: () => {
      conversationId = makeId();
      rememberConversationId(conversationId);
      llmHistory = [];
      llmHistoryFormat = undefined;
      profileName = undefined;
      uiMessages = [];
      loaded = Promise.resolve(undefined);
      return conversationId;
    },
    switchConversation: async (nextConversationId) => {
      if (nextConversationId === conversationId) {
        return;
      }
      await writeQueue;
      conversationId = nextConversationId;
      loaded = undefined;
      llmHistory = [];
      llmHistoryFormat = undefined;
      profileName = undefined;
      uiMessages = [];
      await load();
      rememberConversationId(conversationId);
    },
    deleteConversation: async (deletedConversationId) => {
      await writeQueue;
      await store.delete(deletedConversationId);
      if (deletedConversationId !== conversationId) {
        return false;
      }
      conversationId = makeId();
      rememberConversationId(conversationId);
      llmHistory = [];
      llmHistoryFormat = undefined;
      profileName = undefined;
      uiMessages = [];
      loaded = Promise.resolve(undefined);
      return true;
    },
    listConversations: async (page = 1, pageSize = 50) => {
      if (store.list == undefined) {
        return { items: [], total: 0, offline: false };
      }
      try {
        const result = await store.list(page, pageSize);
        return { ...result, offline: false };
      } catch {
        return { items: [], total: 0, offline: true };
      }
    },
    clear: () => {
      llmHistory = [];
      llmHistoryFormat = undefined;
      profileName = undefined;
      uiMessages = [];
      loaded = Promise.resolve(undefined);
      writeQueue = writeQueue.then(async () => {
        await store.delete(conversationId);
      });
    },
  };
}

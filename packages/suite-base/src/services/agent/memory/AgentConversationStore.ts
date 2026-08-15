// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as IDB from "idb/with-async-ittr";

import Log from "@lichtblick/log";
import { KEY_WORKSPACE_PREFIX } from "@lichtblick/suite-base/constants/browserStorageKeys";

const log = Log.getLogger(__filename);

const DATABASE_NAME = `${KEY_WORKSPACE_PREFIX}lichtblick-agent-conversations`;
const OBJECT_STORE_NAME = "conversations";

/**
 * One persisted conversation.
 *
 * The UI transcript and the LLM transcript are different shapes owned by different layers, but they
 * must be restored together or the user sees messages the model has no memory of. Keeping them in
 * a single record makes that atomic.
 */
export type StoredConversation = {
  conversationId: string;
  updatedAt: string;
  uiMessages: unknown[];
  llmHistory: unknown[];
  llmHistoryFormat?: "pi/v1";
  profileName?: string;
};

/**
 * One row of the local conversation list. Shared between the local persistence layer and the chat
 * UI; the list is built from local records only.
 */
export type ConversationSummary = {
  conversationId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  profileName?: string;
};

export type ConversationListPage = {
  items: ConversationSummary[];
  total: number;
};

interface ConversationsDB extends IDB.DBSchema {
  conversations: {
    key: string;
    value: StoredConversation;
  };
}

/** Title truncation bound for the conversation list. */
export const CONVERSATION_TITLE_MAX_CHARS = 120;

const LIST_DEFAULT_PAGE = 1;
const LIST_DEFAULT_PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

/** Extracts the human-readable text of one UI message. */
function messageText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!isRecord(value)) {
    return "";
  }
  const content = value.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter(
      (block): block is { type: "text"; text: string } =>
        isRecord(block) && block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join(" ")
    .trim();
}

/**
 * Builds one summary row from a stored record. Corrupt per-record shapes (missing uiMessages,
 * garbage entries) are tolerated field by field and never fail the whole list.
 */
function summarizeConversation(record: StoredConversation): ConversationSummary | undefined {
  const messages = Array.isArray(record.uiMessages) ? record.uiMessages : [];
  let messageCount = 0;
  let title = "";
  for (const message of messages) {
    if (!isRecord(message)) {
      continue;
    }
    const role = message.role;
    if (role === "user" || role === "assistant") {
      messageCount++;
    }
    if (title === "" && role === "user") {
      const text = messageText(message).trim();
      if (text.length > 0) {
        title = text;
      }
    }
  }
  // Conversations without any valid user/assistant message are not listed.
  if (messageCount === 0) {
    return undefined;
  }
  const truncatedTitle =
    title.length > CONVERSATION_TITLE_MAX_CHARS
      ? `${title.slice(0, CONVERSATION_TITLE_MAX_CHARS)}…`
      : title;
  return {
    conversationId: record.conversationId,
    title: truncatedTitle,
    updatedAt: record.updatedAt,
    messageCount,
    ...(typeof record.profileName === "string" && record.profileName !== ""
      ? { profileName: record.profileName }
      : {}),
  };
}

/**
 * Persists agent conversations in IndexedDB.
 *
 * IndexedDB rather than app configuration because a transcript can reach the orchestrator's
 * multi-megabyte history budget, and the desktop configuration backend rewrites its entire
 * settings file on every write.
 */
export class AgentConversationStore {
  #db = IDB.openDB<ConversationsDB>(DATABASE_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "conversationId" });
    },
  });

  public async load(conversationId: string): Promise<StoredConversation | undefined> {
    try {
      return await (await this.#db).get(OBJECT_STORE_NAME, conversationId);
    } catch (error) {
      // A conversation that cannot be restored must not stop a new one from starting.
      log.error(error, "Failed to load the stored agent conversation");
      return undefined;
    }
  }

  public async save(conversation: StoredConversation): Promise<void> {
    try {
      await (await this.#db).put(OBJECT_STORE_NAME, conversation);
    } catch (error) {
      log.error(error, "Failed to persist the agent conversation");
    }
  }

  public async delete(conversationId: string): Promise<void> {
    try {
      await (await this.#db).delete(OBJECT_STORE_NAME, conversationId);
    } catch (error) {
      log.error(error, "Failed to delete the stored agent conversation");
    }
  }

  /**
   * Lists stored conversations, newest first.
   *
   * Contract: title is the first non-empty user message (truncated); messageCount counts valid
   * user/assistant UI messages; conversations without any countable message are omitted; order is
   * updatedAt desc with conversationId as a stable tiebreak; `total` is the count before
   * pagination; invalid pagination parameters fall back to defaults; a corrupt single record is
   * skipped without failing the list.
   */
  public async list(
    page = LIST_DEFAULT_PAGE,
    pageSize = LIST_DEFAULT_PAGE_SIZE,
  ): Promise<ConversationListPage> {
    const normalizedPage =
      Number.isSafeInteger(page) && page >= 1 ? page : LIST_DEFAULT_PAGE;
    const normalizedPageSize =
      Number.isSafeInteger(pageSize) && pageSize >= 1
        ? pageSize
        : LIST_DEFAULT_PAGE_SIZE;
    try {
      const db = await this.#db;
      const transaction = db.transaction(OBJECT_STORE_NAME, "readonly");
      const records = await transaction
        .objectStore(OBJECT_STORE_NAME)
        .getAll();
      await transaction.done;
      const summaries: ConversationSummary[] = [];
      for (const record of records) {
        try {
          const summary = summarizeConversation(record);
          if (summary != undefined) {
            summaries.push(summary);
          }
        } catch {
          // A single corrupt record is skipped; the rest of the list stays usable.
        }
      }
      summaries.sort((left, right) => {
        const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);
        return updatedAtOrder !== 0
          ? updatedAtOrder
          : left.conversationId.localeCompare(right.conversationId);
      });
      const total = summaries.length;
      const start = (normalizedPage - 1) * normalizedPageSize;
      return {
        items: summaries.slice(start, start + normalizedPageSize),
        total,
      };
    } catch (error) {
      log.error(error, "Failed to list the stored agent conversations");
      return { items: [], total: 0 };
    }
  }
}

/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { AgentMessage } from "@earendil-works/pi-agent-core";

import { AgentConversationStore } from "./AgentConversationStore";
import {
  AGENT_CONVERSATION_ID_KEY,
  createAgentConversationPersistence,
  getOrCreateConversationId,
} from "./agentConversationPersistence";

const piHistory: AgentMessage[] = [
  {
    role: "user",
    content: [{ type: "text", text: "find SN001" }],
    timestamp: Date.parse("2026-08-04T09:30:00.000Z"),
  },
];

function piUserMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.parse("2026-08-04T09:30:00.000Z"),
  };
}

describe("getOrCreateConversationId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mints an id once and reuses it across reloads", () => {
    const first = getOrCreateConversationId(() => "generated-1");
    expect(first).toBe("generated-1");
    expect(localStorage.getItem(AGENT_CONVERSATION_ID_KEY)).toBe("generated-1");

    expect(getOrCreateConversationId(() => "generated-2")).toBe("generated-1");
  });

  it("still returns an id when storage is unavailable", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getOrCreateConversationId(() => "fallback")).toBe("fallback");
    getItem.mockRestore();
  });
});

describe("createAgentConversationPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips pi history with its format marker and the UI transcript", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({
      conversationId: "pi-conversation",
      makeId: () => "next",
      store,
    });
    await persistence.restorePiLlmHistory();

    persistence.onPiLlmHistoryChanged(piHistory);
    persistence.onUiMessagesChanged([{ id: "ui-message", content: "find SN001" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await store.load("pi-conversation")).toMatchObject({
      llmHistory: piHistory,
      llmHistoryFormat: "pi/v1",
      uiMessages: [{ id: "ui-message", content: "find SN001" }],
    });
    const restored = createAgentConversationPersistence({
      conversationId: "pi-conversation",
      makeId: () => "next",
      store,
    });
    await expect(restored.restorePiLlmHistory()).resolves.toEqual(piHistory);
    await expect(restored.restoreUiMessages()).resolves.toEqual([
      { id: "ui-message", content: "find SN001" },
    ]);
  });

  it("round-trips the last profile used by a conversation", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({
      conversationId: "profile-conversation",
      makeId: () => "next",
      store,
    });
    await persistence.restoreUiMessages();

    persistence.setProfileName("Diagnostics");
    persistence.onUiMessagesChanged([{ id: "message-1" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await store.load("profile-conversation")).toMatchObject({
      profileName: "Diagnostics",
    });

    const restored = createAgentConversationPersistence({
      conversationId: "profile-conversation",
      makeId: () => "next",
      store,
    });
    await restored.restoreUiMessages();
    restored.onUiMessagesChanged([{ id: "message-2" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await store.load("profile-conversation")).toMatchObject({
      profileName: "Diagnostics",
    });

    restored.setProfileName("Planning");
    restored.onUiMessagesChanged([{ id: "message-3" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await store.load("profile-conversation")).toMatchObject({
      profileName: "Planning",
    });
  });

  it("discards unversioned LLM history for pi without losing UI messages", async () => {
    const store = new AgentConversationStore();
    await store.save({
      conversationId: "legacy-conversation",
      updatedAt: "2026-08-04T09:30:00.000Z",
      // A legacy unversioned record: the pi format marker is missing, so the transcript must be
      // treated as unreadable rather than misparsed.
      llmHistory: piHistory,
      uiMessages: [{ id: "legacy-ui-message", content: "still visible" }],
    });
    const persistence = createAgentConversationPersistence({
      conversationId: "legacy-conversation",
      makeId: () => "next",
      store,
    });

    await expect(persistence.restorePiLlmHistory()).resolves.toEqual([]);
    await expect(persistence.restoreUiMessages()).resolves.toEqual([
      { id: "legacy-ui-message", content: "still visible" },
    ]);
  });

  it("returns empty transcripts for an unknown conversation", async () => {
    const persistence = createAgentConversationPersistence({
      conversationId: "missing",
      makeId: () => "next",
      store: new AgentConversationStore(),
    });
    await expect(persistence.restorePiLlmHistory()).resolves.toEqual([]);
    await expect(persistence.restoreUiMessages()).resolves.toEqual([]);
  });

  it("keeps both halves in the same record when only one changes", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({ conversationId: "c2", makeId: () => "next", store });
    await persistence.restorePiLlmHistory();

    persistence.onPiLlmHistoryChanged(piHistory);
    persistence.onUiMessagesChanged([{ id: "u1" }]);
    // Writes are queued; let the queue drain.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = await store.load("c2");
    expect(stored?.llmHistory).toEqual(piHistory);
    expect(stored?.llmHistoryFormat).toBe("pi/v1");
    expect(stored?.uiMessages).toEqual([{ id: "u1" }]);
  });

  it("snapshots each change so a later mutation cannot rewrite a queued record", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({ conversationId: "c3", makeId: () => "next", store });
    await persistence.restorePiLlmHistory();

    const mutable: AgentMessage[] = [piUserMessage("first")];
    persistence.onPiLlmHistoryChanged(mutable);
    mutable.push(piUserMessage("second"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((await store.load("c3"))?.llmHistory).toHaveLength(1);
  });

  it("starts a new conversation by rotating the id and retaining the old record", async () => {
    const store = new AgentConversationStore();
    localStorage.setItem(AGENT_CONVERSATION_ID_KEY, "c5");
    const persistence = createAgentConversationPersistence({
      conversationId: "c5",
      makeId: () => "c6",
      store,
    });
    persistence.onPiLlmHistoryChanged(piHistory);
    persistence.onUiMessagesChanged([{ id: "u1" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await store.load("c5")).toBeDefined();

    persistence.startNewConversation();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await store.load("c5")).toBeDefined();
    await expect(persistence.restorePiLlmHistory()).resolves.toEqual([]);
    await expect(persistence.restoreUiMessages()).resolves.toEqual([]);
    // The new id has to survive a reload, otherwise the next launch resumes the discarded one.
    expect(localStorage.getItem(AGENT_CONVERSATION_ID_KEY)).toBe("c6");
  });

  it("writes subsequent changes under the new conversation id", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({
      conversationId: "c7",
      makeId: () => "c8",
      store,
    });
    persistence.startNewConversation();
    persistence.onPiLlmHistoryChanged(piHistory);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((await store.load("c8"))?.llmHistory).toEqual(piHistory);
    expect(await store.load("c7")).toBeUndefined();
  });

  it("flushes the old conversation and restores both halves when switching", async () => {
    const store = new AgentConversationStore();
    await store.save({
      conversationId: "target",
      updatedAt: "2026-07-29T00:00:00Z",
      llmHistory: [piUserMessage("target history")],
      llmHistoryFormat: "pi/v1",
      uiMessages: [{ id: "target-message" }],
    });
    const persistence = createAgentConversationPersistence({
      conversationId: "source",
      makeId: () => "new",
      store,
    });
    persistence.onPiLlmHistoryChanged(piHistory);
    persistence.onUiMessagesChanged([{ id: "source-message" }]);

    await persistence.switchConversation("target");

    expect((await store.load("source"))?.uiMessages).toEqual([{ id: "source-message" }]);
    await expect(persistence.restorePiLlmHistory()).resolves.toEqual([
      piUserMessage("target history"),
    ]);
    await expect(persistence.restoreUiMessages()).resolves.toEqual([
      { id: "target-message" },
    ]);
    expect(localStorage.getItem(AGENT_CONVERSATION_ID_KEY)).toBe("target");
  });

  it("clears the stored conversation", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({ conversationId: "c4", makeId: () => "next", store });
    persistence.onPiLlmHistoryChanged(piHistory);
    await new Promise((resolve) => setTimeout(resolve, 0));

    persistence.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await store.load("c4")).toBeUndefined();
    await expect(persistence.restorePiLlmHistory()).resolves.toEqual([]);
  });

  it("forwards the local conversation list and marks offline failures", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({
      conversationId: "c5",
      makeId: () => "next",
      store,
    });
    persistence.onPiLlmHistoryChanged(piHistory);
    persistence.onUiMessagesChanged([{ role: "user", content: "listed" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const page = await persistence.listConversations();
    expect(page.offline).toBe(false);
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: "c5",
          messageCount: 1,
          title: "listed",
        }),
      ]),
    );
    expect(page.total).toBeGreaterThanOrEqual(1);

    await store.delete("c5");
  });

  it("reports offline when the conversation store list fails", async () => {
    const store = new AgentConversationStore();
    const persistence = createAgentConversationPersistence({
      conversationId: "c6",
      makeId: () => "next",
      store,
    });
    jest.spyOn(store, "list").mockRejectedValueOnce(new Error("db unavailable"));

    await expect(persistence.listConversations()).resolves.toEqual({
      items: [],
      total: 0,
      offline: true,
    });
  });
});

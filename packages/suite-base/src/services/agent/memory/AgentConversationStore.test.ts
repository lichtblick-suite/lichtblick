/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  AgentConversationStore,
  CONVERSATION_TITLE_MAX_CHARS,
  type StoredConversation,
} from "./AgentConversationStore";

function record(
  conversationId: string,
  updatedAt: string,
  uiMessages: unknown[],
): StoredConversation {
  return {
    conversationId,
    updatedAt,
    uiMessages,
    llmHistory: [],
  };
}

function userMessage(text: string): { role: string; content: string } {
  return { role: "user", content: text };
}

function assistantMessage(text: string): { role: string; content: string } {
  return { role: "assistant", content: text };
}

describe("AgentConversationStore.list", () => {
  let store: AgentConversationStore;
  // The store uses one fixed database name; records written by previous tests in this file (or
  // by parallel workers in other suites) stay visible. Clean up only the ids this file created so
  // assertions stay deterministic without fighting IndexedDB's delete-database blocking rules.
  const createdIds = new Set<string>();

  async function save(conversation: StoredConversation): Promise<void> {
    createdIds.add(conversation.conversationId);
    await store.save(conversation);
  }

  beforeEach(async () => {
    store = new AgentConversationStore();
    for (const conversationId of createdIds) {
      await store.delete(conversationId);
    }
    createdIds.clear();
  });

  it("derives the title from the first non-empty user message and truncates long titles", async () => {
    const longTitle = "x".repeat(CONVERSATION_TITLE_MAX_CHARS + 10);
    await save(
      record("c-long", "2026-08-04T00:00:00.000Z", [
        userMessage("  "),
        userMessage(longTitle),
        assistantMessage("answer"),
      ]),
    );

    const page = await store.list();
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      conversationId: "c-long",
      title: `${"x".repeat(CONVERSATION_TITLE_MAX_CHARS)}…`,
      messageCount: 3,
    });
  });

  it("supports block-content UI messages for the title", async () => {
    await save(
      record("c-blocks", "2026-08-04T00:00:00.000Z", [
        {
          role: "user",
          content: [
            { type: "text", text: "hello" },
            { type: "text", text: "world" },
          ],
        },
      ]),
    );

    const page = await store.list();
    expect(page.items[0]?.title).toBe("hello world");
  });

  it("counts only valid user/assistant messages and omits empty conversations", async () => {
    await save(record("c-empty", "2026-08-04T00:00:00.000Z", []));
    await save(
      record("c-mixed", "2026-08-04T00:00:00.000Z", [
        userMessage("first"),
        assistantMessage("second"),
        { role: "system", content: "not counted" },
        "garbage",
      ]),
    );

    const page = await store.list();
    expect(page.total).toBe(1);
    expect(page.items[0]?.conversationId).toBe("c-mixed");
    expect(page.items[0]?.messageCount).toBe(2);
  });

  it("sorts by updatedAt desc with conversationId as a stable tiebreak", async () => {
    await save(record("c-b", "2026-08-04T00:00:00.000Z", [userMessage("b")]));
    await save(record("c-a", "2026-08-04T00:00:00.000Z", [userMessage("a")]));
    await save(record("c-newest", "2026-08-05T00:00:00.000Z", [userMessage("newest")]));
    await save(record("c-oldest", "2026-08-03T00:00:00.000Z", [userMessage("oldest")]));

    const page = await store.list();
    expect(page.items.map((item) => item.conversationId)).toEqual([
      "c-newest",
      "c-a",
      "c-b",
      "c-oldest",
    ]);
  });

  it("reports the pre-pagination total and slices the requested page", async () => {
    for (let index = 0; index < 5; index++) {
      await save(
        record(`c-${index}`, `2026-08-04T0${index}:00:00.000Z`, [userMessage(`message ${index}`)]),
      );
    }

    const secondPage = await store.list(2, 2);
    expect(secondPage.total).toBe(5);
    expect(secondPage.items.map((item) => item.conversationId)).toEqual(["c-2", "c-1"]);

    const beyondEnd = await store.list(3, 2);
    expect(beyondEnd.total).toBe(5);
    expect(beyondEnd.items).toHaveLength(1);
  });

  it("falls back to default pagination for invalid parameters", async () => {
    await save(record("c-1", "2026-08-04T00:00:00.000Z", [userMessage("one")]));

    for (const page of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = await store.list(page, 50);
      expect(result.items.map((item) => item.conversationId)).toEqual(["c-1"]);
    }
    for (const pageSize of [0, -1, 2.5, Number.NaN]) {
      const result = await store.list(1, pageSize);
      expect(result.items.map((item) => item.conversationId)).toEqual(["c-1"]);
    }
  });

  it("skips a single corrupt conversation without failing the whole list", async () => {
    await save(record("c-good", "2026-08-04T00:00:00.000Z", [userMessage("good")]));
    await save({
      conversationId: "c-corrupt",
      updatedAt: "2026-08-05T00:00:00.000Z",
      // A torn record whose uiMessages is not an array: the row must be skipped, not throw.
      uiMessages: "not-an-array" as unknown as unknown[],
      llmHistory: [],
    });

    const page = await store.list();
    expect(page.total).toBe(1);
    expect(page.items[0]?.conversationId).toBe("c-good");
  });

  it("reflects create/switch/delete/reload through the persistence-facing contract", async () => {
    await save(record("c-keep", "2026-08-04T00:00:00.000Z", [userMessage("keep")]));

    // New conversation appears.
    await save(record("c-new", "2026-08-05T00:00:00.000Z", [userMessage("new")]));
    expect((await store.list()).items.map((item) => item.conversationId)).toEqual([
      "c-new",
      "c-keep",
    ]);

    // Reload (a fresh store instance over the same database) sees the same records.
    const reloaded = new AgentConversationStore();
    expect((await reloaded.list()).total).toBe(2);

    // Delete removes the record from the list.
    await store.delete("c-new");
    const afterDelete = await store.list();
    expect(afterDelete.total).toBe(1);
    expect(afterDelete.items[0]?.conversationId).toBe("c-keep");
  });
});

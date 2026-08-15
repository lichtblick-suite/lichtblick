/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, render, renderHook, waitFor } from "@testing-library/react";
import { useCallback } from "react";
import {
  type PropsWithChildren,
  StrictMode,
  Suspense,
  startTransition,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

import { type AgentChatState, useAgentChat } from "@lichtblick/suite-base/context/AgentChatContext";
import { collectLayoutBaseline } from "@lichtblick/suite-base/services/agent/layoutDiff";
import { useLocalAgentClient } from "@lichtblick/suite-base/services/agent/localAgentClient";
import type { AgentConversationPersistence } from "@lichtblick/suite-base/services/agent/memory/agentConversationPersistence";
import {
  AgentStreamProtocolError,
  type AgentEvent,
  type IAgentClient,
  type LayoutProposal,
  type SubscribeEventsOptions,
  type ToolRunStatus,
} from "@lichtblick/suite-base/services/agent/types";

import AgentChatProvider from "./AgentChatProvider";

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error: Error) => void;
  resolve: (value: T) => void;
};

type SubscriptionCall = {
  deferred: Deferred<void>;
  listener: (event: AgentEvent) => void;
  options?: SubscribeEventsOptions;
  signal?: AbortSignal;
};

type ClientHarness = {
  client: jest.Mocked<IAgentClient>;
  emit: (event: AgentEvent, subscriptionIndex?: number) => void;
  fail: (error: Error, subscriptionIndex?: number) => void;
  subscriptions: SubscriptionCall[];
};

function deferred<T>(): Deferred<T> {
  let rejectPromise: (error: Error) => void = () => {};
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

function createMockClient(): jest.Mocked<IAgentClient> {
  return {
    createSession: jest.fn().mockResolvedValue({ sessionId: "session-1" }),
    notifyCatalogReady: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    subscribeEvents: jest.fn().mockResolvedValue(undefined),
  };
}

function createClientHarness(): ClientHarness {
  const client = createMockClient();
  const subscriptions: SubscriptionCall[] = [];
  client.subscribeEvents.mockImplementation(
    async (_sessionId, listener, signal, options): Promise<void> => {
      const pending = deferred<void>();
      const call = { deferred: pending, listener, options, signal };
      subscriptions.push(call);
      if (signal?.aborted === true) {
        pending.resolve();
      } else {
        signal?.addEventListener(
          "abort",
          () => {
            pending.resolve();
          },
          { once: true },
        );
      }
      await pending.promise;
    },
  );

  function getSubscription(index?: number): SubscriptionCall {
    const call = subscriptions[index ?? subscriptions.length - 1];
    if (call == undefined) {
      throw new Error("Event subscription has not started");
    }
    return call;
  }

  return {
    client,
    emit: (event, index) => {
      getSubscription(index).listener(event);
    },
    fail: (error, index) => {
      getSubscription(index).deferred.reject(error);
    },
    subscriptions,
  };
}

function validProposal(name = "Diagnostics"): LayoutProposal {
  return {
    name,
    summary: `Summary for ${name}`,
    data: {
      configById: {
        "Plot!agent": {},
      },
      globalVariables: {},
      layout: "Plot!agent",
      playbackConfig: { speed: 1 },
      userNodes: {},
    },
  };
}

const selectState = (state: AgentChatState) => state;

type MockOrchestrator = {
  createSession: jest.Mock;
  dispose: jest.Mock;
  emit: (event: AgentEvent) => void;
  notifyCatalogReady: jest.Mock;
  sendMessage: jest.Mock;
  subscribeEvents: jest.Mock;
};

const mockOrchestratorInstances: MockOrchestrator[] = [];

jest.mock("@lichtblick/suite-base/services/agent/pi/PiAgentOrchestrator", () => ({
  PiAgentOrchestrator: function OrchestratorMock() {
    const subscriptions: Array<{
      listener: (event: AgentEvent) => void;
      signal?: AbortSignal;
    }> = [];
    const instance: MockOrchestrator = {
      createSession: jest.fn().mockResolvedValue({ sessionId: "session-1" }),
      dispose: jest.fn(),
      emit(event: AgentEvent) {
        for (const subscription of subscriptions) {
          subscription.listener(event);
        }
      },
      notifyCatalogReady: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      subscribeEvents: jest.fn().mockImplementation(
        async (_sessionId: string, listener: (event: AgentEvent) => void, signal?: AbortSignal) => {
          const pending = new Promise<void>((resolve) => {
            if (signal?.aborted === true) {
              resolve();
            } else {
              signal?.addEventListener(
                "abort",
                () => {
                  resolve();
                },
                { once: true },
              );
            }
          });
          subscriptions.push({ listener, signal });
          await pending;
        },
      ),
    };
    mockOrchestratorInstances.push(instance);
    return instance;
  },
}));

function RebindHarness({
  getPromptCustomization,
  storeRef,
}: {
  getPromptCustomization: () => string;
  storeRef: { current?: AgentChatState };
}): React.JSX.Element {
  // Stable per render: the reference only changes when the prop changes (the rebind trigger),
  // never on every render — an inline arrow would rebuild the client in a loop.
  const stableCustomization = useCallback(
    () => ({
      customSkills: [],
      instructions: getPromptCustomization(),
      skillOverrides: {},
    }),
    [getPromptCustomization],
  );
  const client = useLocalAgentClient(
    {
      apiKey: "test-key",
      baseUrl: "http://localhost:8080",
      desktop: false,
      model: "test-model",
      provider: "anthropic",
    },
    {
      enabled: true,
      getCatalog: () => ({ topics: [], datatypes: new Map() }),
      getPromptCustomization: stableCustomization,
    },
  );
  return (
    <AgentChatProvider client={client}>
      <StateProbe storeRef={storeRef} />
    </AgentChatProvider>
  );
}

function StateProbe({ storeRef }: { storeRef: { current?: AgentChatState } }): ReactNull {
  const state = useAgentChat((chatState) => chatState);
  storeRef.current = state;
  return null;
}

/** Produces a conversation through a given orchestrator instance and returns the messages. */
async function populateMessagesThroughOrchestrator(
  client: MockOrchestrator,
  storeRef: { current?: AgentChatState },
): Promise<void> {
  let send!: Promise<void>;
  act(() => {
    send = storeRef.current!.actions.sendMessage("hello");
  });
  await waitFor(() => {
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
  });
  const requestId = client.sendMessage.mock.calls[0]![2] as string;
  act(() => {
    client.emit({ type: "message-start", messageId: "assistant-1", requestId, seq: 1 });
    client.emit({ type: "token", messageId: "assistant-1", requestId, delta: "hi", seq: 2 });
    client.emit({ type: "message-end", messageId: "assistant-1", requestId, seq: 3 });
    client.emit({ type: "done", requestId, seq: 4 });
  });
  await act(async () => {
    await send;
  });
}

function makeWrapper(
  client: IAgentClient,
  options: {
    onApplyProposal?: (proposal: LayoutProposal, signal: AbortSignal) => Promise<void>;
    onOpenDataSource?: (urls: string[]) => void;
    getCurrentLayoutState?: () => { id?: string; data?: unknown } | undefined;
    getCatalog?: () => { topics: readonly unknown[]; datatypes: ReadonlyMap<string, unknown> };
    getInstalledPanelTypes?: () => ReadonlySet<string>;
    subscribeToLayoutChanges?: (listener: () => void) => () => void;
    subscribeToCatalogChanges?: (listener: () => void) => () => void;
    enabled?: boolean;
    persistence?: AgentConversationPersistence;
    profileName?: string;
    strict?: boolean;
  } = {},
): React.ComponentType<PropsWithChildren> {
  return function Wrapper({ children }: PropsWithChildren) {
    const provider = (
      <AgentChatProvider
        client={client}
        enabled={options.enabled}
        getCatalog={options.getCatalog}
        getCurrentLayoutState={options.getCurrentLayoutState}
        getInstalledPanelTypes={options.getInstalledPanelTypes}
        onApplyProposal={options.onApplyProposal}
        onOpenDataSource={options.onOpenDataSource}
        persistence={options.persistence}
        selectedProfileName={options.profileName}
        subscribeToCatalogChanges={options.subscribeToCatalogChanges}
        subscribeToLayoutChanges={options.subscribeToLayoutChanges}
      >
        {children}
      </AgentChatProvider>
    );
    return options.strict === true ? <StrictMode>{provider}</StrictMode> : provider;
  };
}

/**
 * Wrapper whose client is read from a mutable ref, so a test can re-bind the provider to a new
 * client object (or to undefined) mid-flight.
 */
function makeRebindableWrapper(
  clientRef: { current?: IAgentClient },
  persistenceRef: { current?: AgentConversationPersistence },
  options: { enabled?: boolean } = {},
): React.ComponentType<PropsWithChildren> {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <AgentChatProvider
        client={clientRef.current}
        enabled={options.enabled}
        persistence={persistenceRef.current}
      >
        {children}
      </AgentChatProvider>
    );
  };
}

/** Produces a conversation with a user and an assistant message in the store. */
async function populateMessages(
  harness: ClientHarness,
  result: { current: AgentChatState },
): Promise<void> {
  let send!: Promise<void>;
  act(() => {
    send = result.current.actions.sendMessage("hello");
  });
  await waitFor(() => {
    expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
  });
  const requestId = requestIdAt(harness.client, 0);
  act(() => {
    harness.emit({ type: "message-start", messageId: "assistant-1", requestId, seq: 1 });
    harness.emit({ type: "token", messageId: "assistant-1", requestId, delta: "hi", seq: 2 });
    harness.emit({ type: "message-end", messageId: "assistant-1", requestId, seq: 3 });
    harness.emit({ type: "done", requestId, seq: 4 });
  });
  await act(async () => {
    await send;
  });
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve();
  }
}

function requestIdAt(client: jest.Mocked<IAgentClient>, index: number): string {
  const requestId = client.sendMessage.mock.calls[index]?.[2];
  if (requestId == undefined) {
    throw new Error(`sendMessage call ${index} has not started`);
  }
  return requestId;
}

describe("AgentChatProvider", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("aborts the old lifecycle, restores the selected transcript, and creates a new session", async () => {
    const harness = createClientHarness();
    harness.client.createSession
      .mockResolvedValueOnce({ sessionId: "session-1" })
      .mockResolvedValueOnce({ sessionId: "session-2" });
    const transcripts = new Map<string, unknown[]>([
      [
        "conversation-1",
        [
          {
            id: "old-message",
            role: "assistant",
            content: "old transcript",
            createdAt: "2026-07-29T00:00:00.000Z",
          },
        ],
      ],
      [
        "conversation-2",
        [
          {
            id: "target-message",
            role: "assistant",
            content: "target transcript",
            createdAt: "2026-07-29T00:01:00.000Z",
          },
        ],
      ],
    ]);
    let activeConversationId = "conversation-1";
    const persistence: AgentConversationPersistence = {
      clear: jest.fn(),
      deleteConversation: jest.fn().mockResolvedValue(false),
      getActiveConversationId: () => activeConversationId,
      listConversations: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        offline: false,
      }),
      onPiLlmHistoryChanged: jest.fn(),
      onUiMessagesChanged: jest.fn(),
      restorePiLlmHistory: jest.fn().mockResolvedValue([]),
      restoreUiMessages: jest.fn(async () => transcripts.get(activeConversationId) ?? []),
      setProfileName: jest.fn(),
      startNewConversation: jest.fn(() => {
        activeConversationId = "conversation-3";
        return activeConversationId;
      }),
      switchConversation: jest.fn(async (conversationId: string) => {
        activeConversationId = conversationId;
      }),
    };
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { persistence, profileName: "Diagnostics" }),
    });
    await waitFor(() => {
      expect(result.current.messages[0]?.id).toBe("old-message");
    });

    let firstSend!: Promise<void>;
    act(() => {
      firstSend = result.current.actions.sendMessage("old request");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
      expect(harness.subscriptions).toHaveLength(1);
    });
    expect(persistence.setProfileName).toHaveBeenCalledWith("Diagnostics");
    const oldSubscriptionSignal = harness.subscriptions[0]?.signal;

    await act(async () => {
      await result.current.actions.switchConversation("conversation-2");
      await firstSend;
    });

    expect(oldSubscriptionSignal?.aborted).toBe(true);
    expect(result.current.activeConversationId).toBe("conversation-2");
    expect(result.current.messages.map((message) => message.id)).toEqual(["target-message"]);

    let secondSend!: Promise<void>;
    act(() => {
      secondSend = result.current.actions.sendMessage("target request");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
      expect(harness.subscriptions).toHaveLength(2);
    });
    expect(harness.client.sendMessage.mock.calls[1]?.[0]).toBe("session-2");
    const secondRequestId = requestIdAt(harness.client, 1);
    act(() => {
      harness.emit(
        {
          type: "done",
          requestId: secondRequestId,
          seq: 1,
        },
        1,
      );
    });
    await act(async () => {
      await secondSend;
    });
  });

  it("keeps children mounted but rejects actions without creating a session when disabled", async () => {
    const harness = createClientHarness();
    let childMounts = 0;
    let childUnmounts = 0;
    const { result } = renderHook(
      () => {
        useEffect(() => {
          childMounts++;
          return () => {
            childUnmounts++;
          };
        }, []);
        return useAgentChat(selectState);
      },
      { wrapper: makeWrapper(harness.client, { enabled: false }) },
    );

    expect(childMounts).toBe(1);
    expect(childUnmounts).toBe(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.sessionId).toBeUndefined();
    await act(async () => {
      await expect(result.current.actions.sendMessage("disabled")).rejects.toThrow(
        "Agent chat is disabled",
      );
      await expect(result.current.actions.applyProposal()).rejects.toThrow(
        "Agent chat is disabled",
      );
    });
    act(() => {
      expect(() => {
        result.current.actions.notifyCatalogReady("request-disabled");
      }).toThrow("Agent chat is disabled");
    });
    expect(result.current.status).toBe("idle");
    expect(harness.client.createSession).not.toHaveBeenCalled();
    expect(harness.client.sendMessage).not.toHaveBeenCalled();
    expect(harness.client.subscribeEvents).not.toHaveBeenCalled();
  });

  it("aborts and clears on disable, then initializes normally when re-enabled", async () => {
    const harness = createClientHarness();
    let enabled = true;
    let childMounts = 0;
    let childUnmounts = 0;
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <AgentChatProvider client={harness.client} enabled={enabled}>
          {children}
        </AgentChatProvider>
      );
    }
    const { result, rerender } = renderHook(
      () => {
        useEffect(() => {
          childMounts++;
          return () => {
            childUnmounts++;
          };
        }, []);
        return useAgentChat(selectState);
      },
      { wrapper: Wrapper },
    );

    let firstSend!: Promise<void>;
    act(() => {
      firstSend = result.current.actions.sendMessage("before disable");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
      expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(1);
    });
    const firstSubscriptionSignal = harness.subscriptions[0]?.signal;
    const firstPostSignal = harness.client.sendMessage.mock.calls[0]?.[3];

    enabled = false;
    rerender();
    await act(async () => {
      await firstSend;
    });
    expect(firstSubscriptionSignal?.aborted).toBe(true);
    expect(firstPostSignal?.aborted).toBe(true);
    expect(result.current).toMatchObject({
      messages: [],
      sessionId: undefined,
      status: "idle",
    });
    expect(childMounts).toBe(1);
    expect(childUnmounts).toBe(0);
    await act(async () => {
      await expect(result.current.actions.sendMessage("while disabled")).rejects.toThrow(
        "Agent chat is disabled",
      );
    });

    enabled = true;
    rerender();
    let secondSend!: Promise<void>;
    act(() => {
      secondSend = result.current.actions.sendMessage("after enable");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
      expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(2);
    });
    const requestId = requestIdAt(harness.client, 1);
    act(() => {
      harness.emit({ type: "done", requestId, seq: 1 });
    });
    await act(async () => {
      await secondSend;
    });
    expect(result.current.status).toBe("idle");
    expect(harness.client.createSession).toHaveBeenCalledTimes(2);
    expect(childMounts).toBe(1);
    expect(childUnmounts).toBe(0);
  });

  it("settles concurrent sends by requestId even when rounds complete in reverse order", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });

    let firstResolved = false;
    let secondResolved = false;
    let firstSend!: Promise<void>;
    let secondSend!: Promise<void>;
    act(() => {
      firstSend = result.current.actions.sendMessage("first");
      secondSend = result.current.actions.sendMessage("second");
      void firstSend.then(() => {
        firstResolved = true;
      });
      void secondSend.then(() => {
        secondResolved = true;
      });
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
      expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(1);
    });
    const firstRequestId = requestIdAt(harness.client, 0);
    const secondRequestId = requestIdAt(harness.client, 1);

    act(() => {
      harness.emit({
        type: "message-start",
        messageId: "assistant-second",
        requestId: secondRequestId,
        seq: 1,
      });
      harness.emit({
        type: "message-end",
        messageId: "assistant-second",
        requestId: secondRequestId,
        seq: 2,
      });
      harness.emit({ type: "done", requestId: secondRequestId, seq: 3 });
    });
    await waitFor(() => {
      expect(secondResolved).toBe(true);
    });
    expect(firstResolved).toBe(false);

    act(() => {
      harness.emit({
        type: "message-start",
        messageId: "assistant-first",
        requestId: firstRequestId,
        seq: 4,
      });
      harness.emit({
        type: "message-end",
        messageId: "assistant-first",
        requestId: firstRequestId,
        seq: 5,
      });
      harness.emit({ type: "done", requestId: firstRequestId, seq: 6 });
    });
    await act(async () => {
      await Promise.all([firstSend, secondSend]);
    });
    expect(result.current.status).toBe("idle");
  });

  it("rejects only the addressed waiter and rejects every waiter for a session error", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });

    let firstSend!: Promise<void>;
    let secondSend!: Promise<void>;
    act(() => {
      firstSend = result.current.actions.sendMessage("first");
      secondSend = result.current.actions.sendMessage("second");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
    });
    const firstRequestId = requestIdAt(harness.client, 0);

    act(() => {
      harness.emit({ type: "error", error: "first failed", requestId: firstRequestId, seq: 1 });
    });
    await act(async () => {
      await expect(firstSend).rejects.toThrow("first failed");
    });

    let thirdSend!: Promise<void>;
    act(() => {
      thirdSend = result.current.actions.sendMessage("third");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(3);
    });
    act(() => {
      harness.emit({ type: "error", error: "session failed", seq: 2 });
    });
    await act(async () => {
      await expect(Promise.all([secondSend, thirdSend])).rejects.toThrow("session failed");
    });
    expect(harness.subscriptions[0]?.signal?.aborted).toBe(true);
  });

  it("uses seq for exact replay deduplication while preserving identical token deltas", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("tokens");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const secondToken: AgentEvent = {
      type: "token",
      delta: "same",
      messageId: "assistant-1",
      requestId,
      seq: 2,
    };

    act(() => {
      harness.emit({
        type: "token",
        delta: "same",
        messageId: "assistant-1",
        requestId,
        seq: 1,
      });
      harness.emit(secondToken);
      harness.emit(secondToken);
      harness.emit({
        type: "token",
        delta: "old",
        messageId: "assistant-1",
        requestId,
        seq: 1,
      });
      harness.emit({ type: "done", requestId, seq: 3 });
    });
    await act(async () => {
      await send;
    });
    expect(result.current.messages.find((message) => message.id === "assistant-1")?.content).toBe(
      "samesame",
    );
  });

  it("drops every late event for a request after its terminal event", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("terminal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "token",
        delta: "accepted",
        messageId: "assistant-1",
        requestId,
        seq: 1,
      });
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });

    act(() => {
      harness.emit({
        type: "token",
        delta: "late",
        messageId: "assistant-1",
        requestId,
        seq: 3,
      });
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 4,
        urls: ["https://example.test/late"],
      });
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-1",
        proposal: validProposal("Late"),
        requestId,
        seq: 5,
      });
      harness.emit({ type: "error", error: "late failure", requestId, seq: 6 });
    });
    expect(result.current.messages.find((message) => message.id === "assistant-1")?.content).toBe(
      "accepted",
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.waitingRequest).toBeUndefined();
    expect(result.current.pendingProposal).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("keeps tool updates seq-monotonic and applies centralized terminal transitions", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("tools");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const tool = (id: string, status: ToolRunStatus, seq: number, summary?: string) => {
      harness.emit({
        type: "tool-update",
        messageId: "assistant-1",
        requestId,
        seq,
        toolRun: { id, name: "search", status, summary },
      });
    };

    act(() => {
      tool("tool-failed", "queued", 1);
      tool("tool-failed", "running", 2);
      tool("tool-failed", "running", 4);
      tool("tool-failed", "failed", 5);
      tool("tool-failed", "failed", 6, "failed details");
      tool("tool-failed", "succeeded", 7, "must be ignored");
      tool("tool-cancelled", "queued", 8);
      tool("tool-cancelled", "cancelled", 9);
      tool("tool-cancelled", "cancelled", 10, "cancelled details");
      tool("tool-cancelled", "running", 11, "must be ignored");
      tool("tool-succeeded", "succeeded", 12);
      tool("tool-succeeded", "succeeded", 13, "complete");
      tool("tool-succeeded", "failed", 14, "must be ignored");
      harness.emit({ type: "done", requestId, seq: 15 });
    });
    await act(async () => {
      await send;
    });
    expect(result.current.messages[1]?.toolRuns?.[0]).toMatchObject({
      id: "tool-failed",
      status: "failed",
      summary: "failed details",
    });
    expect(result.current.messages[1]?.toolRuns?.[1]).toMatchObject({
      id: "tool-cancelled",
      status: "cancelled",
      summary: "cancelled details",
    });
    expect(result.current.messages[1]?.toolRuns?.[2]).toMatchObject({
      id: "tool-succeeded",
      status: "succeeded",
      summary: "complete",
    });
  });

  it("fails the session on a generic subscription rejection without re-subscribing", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("generic failure");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    act(() => {
      harness.fail(new Error("connection reset"));
    });
    await act(async () => {
      await expect(send).rejects.toThrow("connection reset");
    });
    expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("connection reset");
  });

  it.each([
    new AgentStreamProtocolError("bad frame"),
  ])("treats %s as session-fatal and never reconnects", async (streamError) => {
    jest.useFakeTimers();
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("fatal");
    });
    await act(flushMicrotasks);
    act(() => {
      harness.fail(streamError);
    });
    await act(async () => {
      await expect(send).rejects.toThrow(streamError.message);
    });
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await flushMicrotasks();
    });
    expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
  });

  it("creates a new lifecycle and session when sending immediately after a fatal stream error", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let first!: Promise<void>;
    act(() => {
      first = result.current.actions.sendMessage("fatal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    act(() => {
      harness.fail(new AgentStreamProtocolError("fatal protocol"));
    });
    await act(async () => {
      await expect(first).rejects.toThrow("fatal protocol");
    });

    let second!: Promise<void>;
    act(() => {
      second = result.current.actions.sendMessage("retry");
    });
    await waitFor(() => {
      expect(harness.client.createSession).toHaveBeenCalledTimes(2);
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
      expect(harness.client.subscribeEvents).toHaveBeenCalledTimes(2);
    });
    expect(harness.subscriptions[0]?.signal?.aborted).toBe(true);
    expect(harness.subscriptions[1]?.signal?.aborted).toBe(false);
    const requestId = requestIdAt(harness.client, 1);
    act(() => {
      harness.emit({ type: "done", requestId, seq: 1 }, 1);
    });
    await act(async () => {
      await second;
    });
    expect(result.current.status).toBe("idle");
  });

  it("rejects a round after inactivity and resets its watchdog on each request event", async () => {
    jest.useFakeTimers();
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let rejected = false;
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("watchdog");
      void send.catch(() => {
        rejected = true;
      });
    });
    await act(flushMicrotasks);
    const requestId = requestIdAt(harness.client, 0);

    await act(async () => {
      jest.advanceTimersByTime(179_000);
      await flushMicrotasks();
    });
    expect(rejected).toBe(false);
    act(() => {
      harness.emit({
        type: "token",
        delta: "still active",
        messageId: "assistant-1",
        requestId,
        seq: 1,
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(179_999);
      await flushMicrotasks();
    });
    expect(rejected).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    await expect(send).rejects.toThrow("Timed out waiting for the agent response");
    expect(result.current.status).toBe("error");
  });

  it("moves ready strictly to idle, notifies the client, and still waits for done", async () => {
    const harness = createClientHarness();
    const onOpenDataSource = jest.fn();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onOpenDataSource }),
    });
    let resolved = false;
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("open");
      void send.then(() => {
        resolved = true;
      });
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);

    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/a.mcap"],
      });
    });
    expect(result.current.status).toBe("waiting-for-catalog");
    expect(result.current.waitingRequest).toEqual({
      requestId,
      urls: ["https://example.test/a.mcap"],
    });
    act(() => {
      result.current.actions.notifyCatalogReady(requestId);
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.waitingRequest).toBeUndefined();
    expect(harness.client.notifyCatalogReady).toHaveBeenCalledWith(
      "session-1",
      requestId,
      expect.any(AbortSignal),
    );
    expect(resolved).toBe(false);

    act(() => {
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
  });

  it("publishes the waiting request before invoking onOpenDataSource", async () => {
    const harness = createClientHarness();
    let notifyObservedRequest = () => {};
    const requestIdRef: { current?: string } = {};
    const onOpenDataSource = jest.fn(() => {
      notifyObservedRequest();
    });
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onOpenDataSource }),
    });
    notifyObservedRequest = () => {
      if (requestIdRef.current != undefined) {
        result.current.actions.notifyCatalogReady(requestIdRef.current);
      }
    };

    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("atomic waiting");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    requestIdRef.current = requestId;
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/atomic"],
      });
    });
    expect(onOpenDataSource).toHaveBeenCalledTimes(1);
    expect(harness.client.notifyCatalogReady).toHaveBeenCalledWith(
      "session-1",
      requestId,
      expect.any(AbortSignal),
    );
    expect(result.current.waitingRequest).toBeUndefined();
    expect(result.current.status).toBe("idle");

    act(() => {
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
  });

  it("keeps the catalog timeout active when done arrives before catalog ready", async () => {
    jest.useFakeTimers();
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("open then done");
    });
    await act(flushMicrotasks);
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/wait"],
      });
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
    expect(result.current.status).toBe("waiting-for-catalog");

    await act(async () => {
      jest.advanceTimersByTime(120_000);
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Timed out waiting for the data catalog");
  });

  it("keeps another waiting round and its timeout after a request-scoped error", async () => {
    jest.useFakeTimers();
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.actions.sendMessage("first");
      second = result.current.actions.sendMessage("second");
      void first.catch(() => {});
    });
    await act(flushMicrotasks);
    const firstRequestId = requestIdAt(harness.client, 0);
    const secondRequestId = requestIdAt(harness.client, 1);
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId: firstRequestId,
        seq: 1,
        urls: ["https://example.test/first"],
      });
      harness.emit({ type: "error", error: "second failed", requestId: secondRequestId, seq: 2 });
    });
    await act(async () => {
      await expect(second).rejects.toThrow("second failed");
    });
    expect(result.current.status).toBe("waiting-for-catalog");
    expect(result.current.waitingRequest?.requestId).toBe(firstRequestId);
    expect(result.current.error).toBe("second failed");

    await act(async () => {
      jest.advanceTimersByTime(120_000);
      await flushMicrotasks();
    });
    await expect(first).rejects.toThrow("Timed out waiting for the data catalog");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("tracks concurrent waiting rounds independently and readies only the addressed request", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.actions.sendMessage("first");
      second = result.current.actions.sendMessage("second");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
    });
    const firstRequestId = requestIdAt(harness.client, 0);
    const secondRequestId = requestIdAt(harness.client, 1);

    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId: firstRequestId,
        seq: 1,
        urls: ["https://example.test/first"],
      });
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-2",
        requestId: secondRequestId,
        seq: 2,
        urls: ["https://example.test/second"],
      });
    });
    expect(result.current.waitingRequest?.requestId).toBe(secondRequestId);

    act(() => {
      result.current.actions.notifyCatalogReady(secondRequestId);
    });
    expect(result.current.status).toBe("waiting-for-catalog");
    expect(result.current.waitingRequest?.requestId).toBe(firstRequestId);
    expect(harness.client.notifyCatalogReady).toHaveBeenLastCalledWith(
      "session-1",
      secondRequestId,
      expect.any(AbortSignal),
    );

    act(() => {
      result.current.actions.notifyCatalogReady(firstRequestId);
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.waitingRequest).toBeUndefined();

    act(() => {
      harness.emit({ type: "done", requestId: firstRequestId, seq: 3 });
      harness.emit({ type: "done", requestId: secondRequestId, seq: 4 });
    });
    await act(async () => {
      await Promise.all([first, second]);
    });
  });

  it("does not enter waiting when onOpenDataSource synchronously unmounts the provider", async () => {
    jest.useFakeTimers();
    const harness = createClientHarness();
    const unmountProvider: { current?: () => void } = {};
    const onOpenDataSource = jest.fn(() => {
      unmountProvider.current?.();
    });
    const rendered = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onOpenDataSource }),
    });
    unmountProvider.current = rendered.unmount;
    let send!: Promise<void>;
    act(() => {
      send = rendered.result.current.actions.sendMessage("open");
    });
    await act(flushMicrotasks);
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/unmount"],
      });
    });
    await act(async () => {
      await send;
    });
    expect(onOpenDataSource).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(harness.subscriptions[0]?.signal?.aborted).toBe(true);
  });

  it("gates a child layout effect until the provider lifecycle is initialized", async () => {
    const harness = createClientHarness();
    let send!: Promise<void>;
    const { result } = renderHook(
      () => {
        const state = useAgentChat(selectState);
        useLayoutEffect(() => {
          send = state.actions.sendMessage("mounted");
        }, [state.actions]);
        return state;
      },
      { wrapper: makeWrapper(harness.client) },
    );
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalled();
    });
    const lastCallIndex = harness.client.sendMessage.mock.calls.length - 1;
    const requestId = requestIdAt(harness.client, lastCallIndex);
    act(() => {
      harness.emit({ type: "done", requestId, seq: 1 });
    });
    await act(async () => {
      await send;
    });
    expect(result.current.error).toBeUndefined();
  });

  it("reinitializes safely in StrictMode", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { strict: true }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("strict");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({ type: "done", requestId, seq: 1 });
    });
    await act(async () => {
      await send;
    });
    expect(harness.subscriptions.at(-1)?.signal?.aborted).toBe(false);
  });

  it("does not let a StrictMode probe action cross into the committed lifecycle", async () => {
    const harness = createClientHarness();
    const sends: Promise<void>[] = [];
    renderHook(
      () => {
        const state = useAgentChat(selectState);
        useLayoutEffect(() => {
          sends.push(state.actions.sendMessage("strict automatic send"));
        }, [state.actions]);
        return state;
      },
      { wrapper: makeWrapper(harness.client, { strict: true }) },
    );

    await waitFor(() => {
      expect(sends).toHaveLength(2);
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({ type: "done", requestId, seq: 1 });
    });
    await act(async () => {
      await Promise.all(sends);
    });
    expect(harness.client.createSession).toHaveBeenCalledTimes(1);
  });

  it("gates a child update effect while a changed client is being mounted", async () => {
    const firstHarness = createClientHarness();
    const secondHarness = createClientHarness();
    let currentClient: IAgentClient = firstHarness.client;
    let send: Promise<void> | undefined;
    function Wrapper({ children }: PropsWithChildren) {
      return <AgentChatProvider client={currentClient}>{children}</AgentChatProvider>;
    }
    const { rerender } = renderHook(
      ({ shouldSend }: { shouldSend: boolean }) => {
        const state = useAgentChat(selectState);
        useLayoutEffect(() => {
          if (shouldSend) {
            send = state.actions.sendMessage("updated client");
          }
        }, [shouldSend, state.actions]);
        return state;
      },
      { initialProps: { shouldSend: false }, wrapper: Wrapper },
    );

    currentClient = secondHarness.client;
    rerender({ shouldSend: true });
    await waitFor(() => {
      expect(secondHarness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    expect(firstHarness.client.sendMessage).not.toHaveBeenCalled();
    const requestId = requestIdAt(secondHarness.client, 0);
    act(() => {
      secondHarness.emit({ type: "done", requestId, seq: 1 });
    });
    await act(async () => {
      await send;
    });
  });

  it("uses callback props from the render that immediately precedes an event", async () => {
    const harness = createClientHarness();
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    let currentCallback = firstCallback;
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <AgentChatProvider client={harness.client} onOpenDataSource={currentCallback}>
          {children}
        </AgentChatProvider>
      );
    }
    const { result, rerender } = renderHook(() => useAgentChat(selectState), { wrapper: Wrapper });
    currentCallback = secondCallback;
    rerender();

    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("callback");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/new"],
      });
    });
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.actions.cancelWaiting();
    });
    await act(async () => {
      await send;
    });
  });

  it("does not expose callback props from an uncommitted suspended render", async () => {
    const harness = createClientHarness();
    const committedCallback = jest.fn();
    const suspendedCallback = jest.fn();
    const neverCommits = deferred<void>();
    let currentState: AgentChatState | undefined;
    let beginSuspendedRender = () => {};
    let suspendedRenderStarted = false;

    function Consumer({ suspend }: { suspend: boolean }): React.JSX.Element | null {
      currentState = useAgentChat(selectState);
      if (suspend) {
        suspendedRenderStarted = true;
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- Suspense uses thrown promises.
        throw neverCommits.promise;
      }
      return null;
    }

    function App(): React.JSX.Element {
      const [suspend, setSuspend] = useState(false);
      beginSuspendedRender = () => {
        setSuspend(true);
      };
      return (
        <AgentChatProvider
          client={harness.client}
          onOpenDataSource={suspend ? suspendedCallback : committedCallback}
        >
          <Suspense fallback={null}>
            <Consumer suspend={suspend} />
          </Suspense>
        </AgentChatProvider>
      );
    }

    const rendered = render(<App />);
    const getState = (): AgentChatState => {
      if (currentState == undefined) {
        throw new Error("AgentChat state is not available");
      }
      return currentState;
    };
    let send!: Promise<void>;
    act(() => {
      send = getState().actions.sendMessage("committed callback");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);

    act(() => {
      startTransition(beginSuspendedRender);
    });
    await waitFor(() => {
      expect(suspendedRenderStarted).toBe(true);
    });
    act(() => {
      harness.emit({
        type: "open-data-source",
        messageId: "assistant-1",
        requestId,
        seq: 1,
        urls: ["https://example.test/committed"],
      });
    });
    expect(committedCallback).toHaveBeenCalledTimes(1);
    expect(suspendedCallback).not.toHaveBeenCalled();

    act(() => {
      getState().actions.cancelWaiting();
    });
    await act(async () => {
      await send;
    });
    rendered.unmount();
  });

  it("uses a lifecycle-linked sibling signal for POST and keeps the session subscription alive", async () => {
    const harness = createClientHarness();
    const post = deferred<void>();
    let postSignal: AbortSignal | undefined;
    harness.client.sendMessage.mockImplementation(
      async (_sessionId, _content, _requestId, signal) => {
        postSignal = signal;
        await post.promise;
      },
    );
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("post");
    });
    await waitFor(() => {
      expect(postSignal).toBeDefined();
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({ type: "error", error: "round failed", requestId, seq: 1 });
    });
    await act(async () => {
      await expect(send).rejects.toThrow("round failed");
    });
    expect(postSignal?.aborted).toBe(true);
    expect(harness.subscriptions[0]?.signal?.aborted).toBe(false);
  });

  it("computes the pending proposal display mode with the strict apply decision at enqueue time", async () => {
    const harness = createClientHarness();
    const currentLayoutData = {
      configById: { "Image!camera": {} },
      globalVariables: {},
      layout: "Image!camera",
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const catalog = { topics: [], datatypes: new Map() };
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, {
        getCurrentLayoutState: () => ({ id: "layout-1", data: currentLayoutData }),
        getCatalog: () => catalog,
      }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("propose panels");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);

    // A proposal without a baseline is a new-layout proposal.
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-new",
        proposal: validProposal("Fresh"),
        requestId,
        seq: 1,
      });
    });
    expect(result.current.pendingProposalMode).toEqual({ kind: "new" });

    // A proposal carrying a baseline that adds panels is an incremental proposal.
    const incrementalProposal: LayoutProposal = {
      ...validProposal("Panels"),
      baseLayoutId: "layout-1",
      baseFingerprint: collectLayoutBaseline(
        () => currentLayoutData,
        () => "layout-1",
        () => ({ topics: [], datatypes: new Map() }),
      ).baseFingerprint,
      data: {
        configById: {
          "Image!camera": {},
          "Plot!speed": { paths: [] },
          "Gauge!battery": { path: "/battery" },
        },
        globalVariables: {},
        layout: {
          direction: "column",
          first: "Image!camera",
          second: {
            direction: "row",
            first: "Plot!speed",
            second: "Gauge!battery",
          },
        },
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-incremental",
        proposal: incrementalProposal,
        requestId,
        seq: 2,
      });
    });
    expect(result.current.pendingProposalMode).toEqual({
      kind: "incremental",
      newPanelCount: 2,
    });

    act(() => {
      harness.emit({ type: "done", requestId, seq: 3 });
    });
    await act(async () => {
      await send;
    });
  });

  it("recomputes the pending proposal mode when the layout changes", async () => {
    const harness = createClientHarness();
    const currentLayoutData = {
      configById: { "Image!camera": {} },
      globalVariables: {},
      layout: "Image!camera",
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const catalog = { topics: [], datatypes: new Map() };
    let layoutChangeListener: (() => void) | undefined;
    let currentLayout = currentLayoutData;
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, {
        getCurrentLayoutState: () => ({ id: "layout-1", data: currentLayout }),
        getCatalog: () => catalog,
        subscribeToLayoutChanges: (listener) => {
          layoutChangeListener = listener;
          return () => {
            layoutChangeListener = undefined;
          };
        },
      }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("propose panels");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const incrementalProposal: LayoutProposal = {
      ...validProposal("Panels"),
      baseLayoutId: "layout-1",
      baseFingerprint: collectLayoutBaseline(
        () => currentLayoutData,
        () => "layout-1",
        () => ({ topics: [], datatypes: new Map() }),
      ).baseFingerprint,
      data: {
        configById: {
          "Image!camera": {},
          "Plot!speed": { paths: [] },
        },
        globalVariables: {},
        layout: { direction: "row", first: "Image!camera", second: "Plot!speed" },
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-incremental",
        proposal: incrementalProposal,
        requestId,
        seq: 1,
      });
    });
    expect(result.current.pendingProposalMode).toEqual({
      kind: "incremental",
      newPanelCount: 1,
    });

    // The user edits the layout while the proposal is pending: the label must flip to new-layout
    // because the apply would now fall back (fingerprint mismatch).
    act(() => {
      currentLayout = { ...currentLayoutData, playbackConfig: { speed: 8 } };
      layoutChangeListener?.();
    });
    expect(result.current.pendingProposalMode).toEqual({ kind: "new" });

    act(() => {
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
  });

  it("recomputes the pending proposal mode when the catalog changes", async () => {
    const harness = createClientHarness();
    const currentLayoutData = {
      configById: {
        "Plot!speed": { paths: [{ value: "/missing.topic.x", enabled: true }] },
      },
      globalVariables: {},
      layout: "Plot!speed",
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const emptyCatalog: { topics: readonly unknown[]; datatypes: ReadonlyMap<string, unknown> } = {
      topics: [],
      datatypes: new Map(),
    };
    let catalog = emptyCatalog;
    let catalogChangeListener: (() => void) | undefined;
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, {
        getCurrentLayoutState: () => ({ id: "layout-1", data: currentLayoutData }),
        getCatalog: () => catalog,
        subscribeToCatalogChanges: (listener) => {
          catalogChangeListener = listener;
          return () => {
            catalogChangeListener = undefined;
          };
        },
      }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("propose panels");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const incrementalProposal: LayoutProposal = {
      ...validProposal("Panels"),
      baseLayoutId: "layout-1",
      // Fingerprint over the sanitized layout with the EMPTY catalog (sanitize is identity).
      baseFingerprint: collectLayoutBaseline(
        () => currentLayoutData,
        () => "layout-1",
        () => ({ topics: [], datatypes: new Map() }),
      ).baseFingerprint,
      data: {
        configById: {
          "Plot!speed": { paths: [{ value: "/missing.topic.x", enabled: true }] },
          "Gauge!battery": { path: "/battery" },
        },
        globalVariables: {},
        layout: { direction: "column", first: "Plot!speed", second: "Gauge!battery" },
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-incremental",
        proposal: incrementalProposal,
        requestId,
        seq: 1,
      });
    });
    expect(result.current.pendingProposalMode).toEqual({
      kind: "incremental",
      newPanelCount: 1,
    });

    // The catalog changes while the proposal is pending: sanitization now drops the stale Plot
    // path, the fingerprint no longer matches, and applying would fall back — the label must
    // flip to new-layout.
    act(() => {
      catalog = { topics: [{ name: "/camera", schemaName: "sensor_msgs/Image" }], datatypes: new Map([["sensor_msgs/Image", { definitions: [] }]]) };
      catalogChangeListener?.();
    });
    expect(result.current.pendingProposalMode).toEqual({ kind: "new" });

    act(() => {
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
  });

  it("keeps messages when the client is re-bound to a new object (B1 regression)", async () => {
    const clientRef: { current?: IAgentClient } = {};
    const persistenceRef: { current?: AgentConversationPersistence } = {};
    const harness = createClientHarness();
    clientRef.current = harness.client;
    const { result, rerender } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeRebindableWrapper(clientRef, persistenceRef),
    });
    await populateMessages(harness, result);
    expect(result.current.messages.length).toBeGreaterThan(0);
    const before = result.current.messages;

    // Re-binding: a new client object (e.g. a configuration rebuild) must not clear the
    // conversation.
    const client2 = createMockClient();
    client2.subscribeEvents.mockImplementation(
      async (_sessionId, _listener, signal): Promise<void> => {
        await new Promise<void>((resolve) => {
          if (signal?.aborted === true) {
            resolve();
          } else {
            signal?.addEventListener(
              "abort",
              () => {
                resolve();
              },
              { once: true },
            );
          }
        });
      },
    );
    clientRef.current = client2;
    act(() => {
      rerender();
    });

    expect(result.current.messages).toEqual(before);
  });

  it("keeps messages but resets runtime state when the client is re-bound (B1)", async () => {
    const clientRef: { current?: IAgentClient } = {};
    const persistenceRef: { current?: AgentConversationPersistence } = {};
    const harness = createClientHarness();
    clientRef.current = harness.client;
    const { result, rerender } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeRebindableWrapper(clientRef, persistenceRef),
    });
    await populateMessages(harness, result);
    // Sending a message lazily creates the session.
    expect(result.current.sessionId).toBeDefined();
    expect(result.current.messages.length).toBeGreaterThan(0);

    const client2 = createMockClient();
    client2.subscribeEvents.mockImplementation(
      async (_sessionId, _listener, signal): Promise<void> => {
        await new Promise<void>((resolve) => {
          if (signal?.aborted === true) {
            resolve();
          } else {
            signal?.addEventListener(
              "abort",
              () => {
                resolve();
              },
              { once: true },
            );
          }
        });
      },
    );
    clientRef.current = client2;
    act(() => {
      rerender();
    });

    // The transcript survives the re-bind; the runtime session state (sessionId/status) belongs
    // to the new client and is reset.
    expect(result.current.messages.length).toBeGreaterThan(0);
    expect(result.current.sessionId).toBeUndefined();
    expect(result.current.status).toBe("idle");
  });

  it("keeps non-empty messages when the transcript restore rejects (B1)", async () => {
    const clientRef: { current?: IAgentClient } = {};
    const restoreUiMessages = jest
      .fn()
      .mockRejectedValue(new Error("remote unavailable"));
    // The failing persistence is present from the very first mount: its restore rejects both on
    // the initial mount (empty transcript — nothing to lose) and on the re-bind.
    const failingPersistence: AgentConversationPersistence = {
      clear: jest.fn(),
      deleteConversation: jest.fn().mockResolvedValue(false),
      getActiveConversationId: () => "conversation-1",
      listConversations: jest.fn().mockResolvedValue({ items: [], total: 0, offline: false }),
      onPiLlmHistoryChanged: jest.fn(),
      onUiMessagesChanged: jest.fn(),
      restorePiLlmHistory: jest.fn().mockResolvedValue([]),
      restoreUiMessages,
      setProfileName: jest.fn(),
      startNewConversation: jest.fn(() => "conversation-2"),
      switchConversation: jest.fn(async () => {}),
    };
    const persistenceRef: { current?: AgentConversationPersistence } = {
      current: failingPersistence,
    };
    const harness = createClientHarness();
    clientRef.current = harness.client;
    const { result, rerender } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeRebindableWrapper(clientRef, persistenceRef),
    });
    await populateMessages(harness, result);
    expect(result.current.messages.length).toBeGreaterThan(0);
    const before = result.current.messages;
    const restoreCallsBeforeRebind = restoreUiMessages.mock.calls.length;

    // Re-bind to a new client with the SAME persistence (no workspace switch): the restore runs
    // again, rejects, and must not wipe the existing conversation.
    const client2 = createMockClient();
    client2.subscribeEvents.mockImplementation(
      async (_sessionId, _listener, signal): Promise<void> => {
        await new Promise<void>((resolve) => {
          if (signal?.aborted === true) {
            resolve();
          } else {
            signal?.addEventListener(
              "abort",
              () => {
                resolve();
              },
              { once: true },
            );
          }
        });
      },
    );
    clientRef.current = client2;
    act(() => {
      rerender();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // The restore was actually invoked during the re-bind, rejected, and the transcript survived.
    expect(restoreUiMessages.mock.calls.length).toBeGreaterThan(restoreCallsBeforeRebind);
    expect(result.current.messages).toEqual(before);
  });

  it("clears the conversation when the workspace/persistence switches (B1)", async () => {
    const clientRef: { current?: IAgentClient } = {};
    const persistenceRef: { current?: AgentConversationPersistence } = {};
    const harness = createClientHarness();
    clientRef.current = harness.client;
    const { result, rerender } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeRebindableWrapper(clientRef, persistenceRef),
    });
    await populateMessages(harness, result);
    expect(result.current.messages.length).toBeGreaterThan(0);

    // A different persistence object means the workspace changed: the old session must not leak
    // into the new workspace.
    persistenceRef.current = {
      clear: jest.fn(),
      deleteConversation: jest.fn().mockResolvedValue(false),
      getActiveConversationId: () => "workspace-2-conversation",
      listConversations: jest.fn().mockResolvedValue({ items: [], total: 0, offline: false }),
      onPiLlmHistoryChanged: jest.fn(),
      onUiMessagesChanged: jest.fn(),
      restorePiLlmHistory: jest.fn().mockResolvedValue([]),
      restoreUiMessages: jest.fn().mockResolvedValue([]),
      setProfileName: jest.fn(),
      startNewConversation: jest.fn(() => "workspace-2-new"),
      switchConversation: jest.fn(async () => {}),
    };
    act(() => {
      rerender();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.activeConversationId).toBe("workspace-2-conversation");
  });

  it("clears messages only when the client becomes undefined (real disable)", async () => {
    const clientRef: { current?: IAgentClient } = {};
    const persistenceRef: { current?: AgentConversationPersistence } = {};
    const harness = createClientHarness();
    clientRef.current = harness.client;
    const { result, rerender } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeRebindableWrapper(clientRef, persistenceRef),
    });
    await populateMessages(harness, result);
    expect(result.current.messages.length).toBeGreaterThan(0);

    // Real disable (e.g. the agent switch turned off): the session is cleared and the old
    // client is no longer exposed.
    clientRef.current = undefined;
    act(() => {
      rerender();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("keeps messages across a real dependency-driven rebind through the full wrapper (B1)", async () => {
    mockOrchestratorInstances.length = 0;
    let customization: () => string = () => "v1";
    const storeRef: { current?: AgentChatState } = {};
    const { rerender } = render(
      <RebindHarness getPromptCustomization={customization} storeRef={storeRef} />,
    );
    await waitFor(() => {
      expect(mockOrchestratorInstances).toHaveLength(1);
    });
    const firstClient = mockOrchestratorInstances[0]!;

    await populateMessagesThroughOrchestrator(firstClient, storeRef);
    expect(storeRef.current!.messages.length).toBeGreaterThan(0);
    const before = storeRef.current!.messages;

    // A changing getPromptCustomization reference (a real dependency of useLocalAgentClient)
    // rebuilds the client; the full wrapper must keep the conversation messages.
    customization = () => "v2";
    rerender(<RebindHarness getPromptCustomization={customization} storeRef={storeRef} />);
    await waitFor(() => {
      expect(mockOrchestratorInstances).toHaveLength(2);
    });

    expect(storeRef.current!.messages).toEqual(before);
    expect(mockOrchestratorInstances[0]!.dispose).toHaveBeenCalled();
    expect(mockOrchestratorInstances[1]!.dispose).not.toHaveBeenCalled();
  });

  it("supersedes an unhandled proposal from the same request without leaving a queued copy", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("complete proposal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const skeleton = validProposal("Skeleton");
    const complete = validProposal("Complete");

    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-skeleton",
        proposal: skeleton,
        requestId,
        seq: 1,
      });
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-complete",
        proposal: complete,
        requestId,
        seq: 2,
      });
    });

    expect(result.current.pendingProposal).toEqual(complete);
    expect(result.current.pendingProposalMessageId).toBe("assistant-complete");
    expect(result.current.pendingProposalRequestId).toBe(requestId);

    act(() => {
      result.current.actions.dismissProposal();
    });
    expect(result.current.pendingProposal).toBeUndefined();
    expect(result.current.pendingProposalMessageId).toBeUndefined();
    expect(result.current.pendingProposalRequestId).toBeUndefined();

    act(() => {
      harness.emit({ type: "done", requestId, seq: 3 });
    });
    await act(async () => {
      await send;
    });
  });

  it("keeps proposals from different requests queued and preserves dismiss/apply promotion", async () => {
    const harness = createClientHarness();
    const onApplyProposal = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onApplyProposal }),
    });
    let firstSend!: Promise<void>;
    let secondSend!: Promise<void>;
    act(() => {
      firstSend = result.current.actions.sendMessage("first proposal");
      secondSend = result.current.actions.sendMessage("second proposal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(2);
    });
    const firstRequestId = requestIdAt(harness.client, 0);
    const secondRequestId = requestIdAt(harness.client, 1);
    const firstProposal = validProposal("First request");
    const secondProposal = validProposal("Second request");

    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-first",
        proposal: firstProposal,
        requestId: firstRequestId,
        seq: 1,
      });
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-second",
        proposal: secondProposal,
        requestId: secondRequestId,
        seq: 2,
      });
    });

    expect(result.current.pendingProposal).toEqual(firstProposal);
    expect(result.current.pendingProposalRequestId).toBe(firstRequestId);

    act(() => {
      result.current.actions.dismissProposal();
    });
    expect(result.current.pendingProposal).toEqual(secondProposal);
    expect(result.current.pendingProposalMessageId).toBe("assistant-second");
    expect(result.current.pendingProposalRequestId).toBe(secondRequestId);

    await act(async () => {
      await result.current.actions.applyProposal();
    });
    expect(onApplyProposal).toHaveBeenCalledWith(secondProposal, expect.any(AbortSignal));
    expect(result.current.pendingProposal).toBeUndefined();

    act(() => {
      harness.emit({ type: "done", requestId: firstRequestId, seq: 3 });
      harness.emit({ type: "done", requestId: secondRequestId, seq: 4 });
    });
    await act(async () => {
      await Promise.all([firstSend, secondSend]);
    });
  });

  it("carries an installed extension panel type through proposal receive and apply", async () => {
    const harness = createClientHarness();
    const onApplyProposal = jest.fn().mockResolvedValue(undefined);
    const extensionPanelType = "Acme Extension.Custom Panel";
    const extensionPanelId = `${extensionPanelType}!main`;
    const extensionProposal: LayoutProposal = {
      name: "Extension panel proposal",
      summary: "Uses an installed extension panel",
      data: {
        configById: { [extensionPanelId]: { customSetting: true } },
        globalVariables: {},
        layout: extensionPanelId,
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, {
        getInstalledPanelTypes: () => new Set([extensionPanelType]),
        onApplyProposal,
      }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("add the extension panel");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);

    // Receive path: the proposal survives validation and the card appears.
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-ext",
        proposal: extensionProposal,
        requestId,
        seq: 1,
      });
    });
    expect(result.current.pendingProposal).toEqual(extensionProposal);
    expect(result.current.pendingProposalMessageId).toBe("assistant-ext");
    expect(result.current.error).toBeUndefined();

    // Apply path: the re-validation accepts the extension panel type and the validated
    // proposal reaches the workspace landing callback.
    await act(async () => {
      await result.current.actions.applyProposal();
    });
    expect(onApplyProposal).toHaveBeenCalledTimes(1);
    expect(onApplyProposal).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Extension panel proposal" }),
      expect.any(AbortSignal),
    );
    expect(result.current.pendingProposal).toBeUndefined();

    act(() => {
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });
  });

  it("rejects an uninstalled extension panel type on receive", async () => {
    const harness = createClientHarness();
    const extensionPanelType = "Acme Extension.Custom Panel";
    const extensionPanelId = `${extensionPanelType}!main`;
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("add an unknown panel");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);

    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-unknown",
        proposal: {
          name: "Unknown extension panel",
          data: {
            configById: { [extensionPanelId]: {} },
            globalVariables: {},
            layout: extensionPanelId,
            playbackConfig: { speed: 1 },
            userNodes: {},
          },
        },
        requestId,
        seq: 1,
      });
    });

    expect(result.current.pendingProposal).toBeUndefined();
    expect(result.current.error).toMatch(/unsupported panel type/);

    // The send waiter is failed with the validation error; consume it so the rejection does not
    // surface as an unhandled promise rejection.
    await act(async () => {
      await expect(send).rejects.toThrow(/Invalid layout proposal/);
    });
  });

  it("validates proposals and single-flights apply operations", async () => {
    const harness = createClientHarness();
    const apply = deferred<void>();
    const onApplyProposal = jest.fn(async () => {
      await apply.promise;
    });
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onApplyProposal }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("proposal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    const proposal = validProposal();
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-1",
        proposal,
        requestId,
        seq: 1,
      });
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });

    let firstApply!: Promise<void>;
    let secondApply!: Promise<void>;
    act(() => {
      firstApply = result.current.actions.applyProposal();
      secondApply = result.current.actions.applyProposal();
    });
    await waitFor(() => {
      expect(onApplyProposal).toHaveBeenCalledTimes(1);
    });
    apply.resolve();
    await act(async () => {
      await Promise.all([firstApply, secondApply]);
    });
    expect(onApplyProposal).toHaveBeenCalledWith(proposal, expect.any(AbortSignal));
    expect(result.current.pendingProposal).toBeUndefined();
  });

  it("aborts an in-flight proposal callback when the lifecycle is reset", async () => {
    const harness = createClientHarness();
    const apply = deferred<void>();
    let applySignal: AbortSignal | undefined;
    const onApplyProposal = jest.fn(async (_proposal: LayoutProposal, signal: AbortSignal) => {
      applySignal = signal;
      await apply.promise;
    });
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client, { onApplyProposal }),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("proposal");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-1",
        proposal: validProposal(),
        requestId,
        seq: 1,
      });
      harness.emit({ type: "done", requestId, seq: 2 });
    });
    await act(async () => {
      await send;
    });

    let applying!: Promise<void>;
    act(() => {
      applying = result.current.actions.applyProposal();
    });
    await waitFor(() => {
      expect(applySignal).toBeInstanceOf(AbortSignal);
    });
    act(() => {
      result.current.actions.reset();
    });
    expect(applySignal?.aborted).toBe(true);
    expect(result.current.status).toBe("idle");
    expect(result.current.pendingProposal).toBeUndefined();
    apply.resolve();
    await act(async () => {
      await applying;
    });
    expect(result.current.status).toBe("idle");
  });

  it("rejects an invalid layout proposal for its request", async () => {
    const harness = createClientHarness();
    const { result } = renderHook(() => useAgentChat(selectState), {
      wrapper: makeWrapper(harness.client),
    });
    let send!: Promise<void>;
    act(() => {
      send = result.current.actions.sendMessage("invalid");
    });
    await waitFor(() => {
      expect(harness.client.sendMessage).toHaveBeenCalledTimes(1);
    });
    const requestId = requestIdAt(harness.client, 0);
    act(() => {
      harness.emit({
        type: "layout-proposal",
        messageId: "assistant-1",
        proposal: { name: "bad", data: { layout: "Unknown!panel" } },
        requestId,
        seq: 1,
      });
    });
    await act(async () => {
      await expect(send).rejects.toThrow("Invalid layout proposal");
    });
    expect(result.current.pendingProposal).toBeUndefined();
  });
});

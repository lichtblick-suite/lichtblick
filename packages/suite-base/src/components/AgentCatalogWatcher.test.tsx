/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render } from "@testing-library/react";
import { createStore, type StoreApi } from "zustand";

import Logger from "@lichtblick/log";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import {
  AgentChatContext,
  type AgentChatState,
} from "@lichtblick/suite-base/context/AgentChatContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { AgentCatalogWatcher } from "./AgentCatalogWatcher";

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: (() => {
    const logger = { warn: jest.fn() };
    return { getLogger: () => logger };
  })(),
}));
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: jest.fn(),
}));

describe("AgentCatalogWatcher", () => {
  const mockLogger = Logger.getLogger(__filename);
  const notifyCatalogReady = jest.fn<void, [requestId: string]>();
  let activeData: unknown;
  let playerId: string | undefined;
  let presence: PlayerPresence;
  let store: StoreApi<AgentChatState>;
  let urlState:
    | {
        sourceId: string;
        parameters?: Record<string, string | string[]>;
      }
    | undefined;

  function makeActions(): AgentChatState["actions"] {
    return {
      applyProposal: jest.fn(),
      cancelWaiting: jest.fn(),
      dismissProposal: jest.fn(),
      notifyCatalogReady,
      reset: jest.fn(),
      startNewConversation: jest.fn(),
      switchConversation: jest.fn(),
      deleteConversation: jest.fn(),
      refreshConversations: jest.fn(),
      sendMessage: jest.fn(),
    };
  }

  function renderWatcher() {
    return render(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    activeData = {};
    playerId = "old-player";
    presence = PlayerPresence.PRESENT;
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/old.mcap"] },
    };
    store = createStore<AgentChatState>()(() => ({
      actions: makeActions(),
      conversations: [],
      conversationsLoading: false,
      conversationsOffline: false,
      messages: [],
      sessionId: "session-1",
      status: "idle",
    }));

    (useMessagePipeline as jest.Mock).mockImplementation(
      (selector: (context: unknown) => unknown) =>
        selector({ playerState: { activeData, playerId, presence, urlState } }),
    );
  });

  it("treats a matching PRESENT player with active data as ready even with zero topics", () => {
    const root = renderWatcher();

    act(() => {
      store.setState({
        status: "waiting-for-catalog",
        waitingRequest: {
          requestId: "request-1",
          urls: ["https://example.com/new.mcap"],
        },
      });
    });
    expect(notifyCatalogReady).not.toHaveBeenCalled();

    playerId = "new-player";
    presence = PlayerPresence.INITIALIZING;
    activeData = undefined;
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/new.mcap"] },
    };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).not.toHaveBeenCalled();

    presence = PlayerPresence.PRESENT;
    activeData = { topics: [] };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).toHaveBeenCalledWith("request-1");

    activeData = { topics: [], totalBytesReceived: 0 };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).toHaveBeenCalledTimes(1);
  });

  it("does not miss a ready player committed in the same batch as waitingRequest", () => {
    renderWatcher();

    playerId = "new-player";
    presence = PlayerPresence.PRESENT;
    activeData = { topics: [] };
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/new.mcap"] },
    };
    act(() => {
      store.setState({
        status: "waiting-for-catalog",
        waitingRequest: {
          requestId: "request-1",
          urls: ["https://example.com/new.mcap"],
        },
      });
    });

    expect(notifyCatalogReady).toHaveBeenCalledTimes(1);
    expect(notifyCatalogReady).toHaveBeenCalledWith("request-1");
  });

  it("keeps overlapping waiting requests independently correlated by requestId", () => {
    const root = renderWatcher();

    act(() => {
      store.setState({
        status: "waiting-for-catalog",
        waitingRequest: {
          requestId: "request-1",
          urls: ["https://example.com/first.mcap"],
        },
      });
    });
    act(() => {
      store.setState({
        waitingRequest: {
          requestId: "request-2",
          urls: ["https://example.com/second.mcap"],
        },
      });
    });

    playerId = "first-player";
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/first.mcap"] },
    };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).toHaveBeenLastCalledWith("request-1");

    playerId = "second-player";
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/second.mcap"] },
    };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );

    expect(notifyCatalogReady.mock.calls).toEqual([["request-1"], ["request-2"]]);
  });

  it("does not treat a manual switch to a different data source as the Agent request", () => {
    const root = renderWatcher();

    act(() => {
      store.setState({
        status: "waiting-for-catalog",
        waitingRequest: {
          requestId: "request-1",
          urls: ["https://example.com/agent.mcap"],
        },
      });
    });

    playerId = "manual-player";
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/manually-opened.mcap"] },
    };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).not.toHaveBeenCalled();

    playerId = "agent-player";
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/agent.mcap"] },
    };
    root.rerender(
      <AgentChatContext.Provider value={store}>
        <AgentCatalogWatcher />
      </AgentChatContext.Provider>,
    );
    expect(notifyCatalogReady).toHaveBeenCalledWith("request-1");
  });

  it("swallows and logs a ready notification rejected by a same-batch disable", () => {
    notifyCatalogReady.mockImplementation(() => {
      throw new Error("Agent chat is disabled");
    });
    renderWatcher();

    playerId = "new-player";
    urlState = {
      sourceId: "remote-file",
      parameters: { urls: ["https://example.com/new.mcap"] },
    };
    act(() => {
      store.setState({
        status: "waiting-for-catalog",
        waitingRequest: {
          requestId: "request-1",
          urls: ["https://example.com/new.mcap"],
        },
      });
    });

    expect(notifyCatalogReady).toHaveBeenCalledWith("request-1");
    const warningCalls = (mockLogger as unknown as { warn: jest.Mock }).warn.mock.calls;
    expect(warningCalls).toContainEqual([expect.stringContaining("Agent chat is disabled")]);
  });
});

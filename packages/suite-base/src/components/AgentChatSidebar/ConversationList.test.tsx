/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { AgentChatState, useAgentChat } from "@lichtblick/suite-base/context/AgentChatContext";

import { ConversationList } from "./ConversationList";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AgentChatContext", () => ({
  useAgentChat: jest.fn(),
}));

const switchConversation = jest.fn().mockResolvedValue(undefined);
const deleteConversation = jest.fn().mockResolvedValue(undefined);
const startNewConversation = jest.fn();

const actions: AgentChatState["actions"] = {
  applyProposal: jest.fn(),
  cancelWaiting: jest.fn(),
  confirmToolRun: jest.fn(),
  deleteConversation,
  dismissProposal: jest.fn(),
  newConversation: jest.fn(),
  notifyCatalogReady: jest.fn(),
  refreshConversations: jest.fn(),
  reset: jest.fn(),
  sendMessage: jest.fn(),
  startNewConversation,
  switchConversation,
};

let state: AgentChatState;

function setState(overrides: Partial<AgentChatState> = {}): void {
  state = {
    activeConversationId: "conversation-1",
    actions,
    conversations: [
      {
        conversationId: "conversation-1",
        title: "Inspect recording",
        updatedAt: "2026-07-29T00:00:00.000Z",
        messageCount: 4,
        profileName: "Diagnostics",
      },
      {
        conversationId: "conversation-2",
        title: "Find device",
        updatedAt: "2026-07-28T00:00:00.000Z",
        messageCount: 2,
      },
    ],
    conversationsLoading: false,
    conversationsOffline: false,
    messages: [],
    status: "idle",
    ...overrides,
  };
}

describe("ConversationList", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T01:00:00.000Z"));
    setState();
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: { resolvedLanguage: "en" },
      t: (
        key: string,
        options?: { count?: number; profileName?: string; time?: string; title?: string },
      ) => {
        const translations: Record<string, string> = {
          "conversationList.newConversation": "New conversation",
          "conversationList.loading": "Loading conversations…",
          "conversationList.empty": "No conversation history",
          "conversationList.offline": "Conversation history is offline.",
          "conversationList.untitled": "Untitled conversation",
        };
        if (key === "conversationList.delete") {
          return `Delete ${options?.title ?? ""}`;
        }
        if (key === "conversationList.metadata") {
          return `${options?.time ?? ""} · ${options?.count ?? 0} messages`;
        }
        if (key === "conversationList.profileMetadata") {
          return `${options?.profileName ?? ""} · ${options?.time ?? ""} · ${
            options?.count ?? 0
          } messages`;
        }
        return translations[key] ?? key;
      },
    });
    (useAgentChat as jest.Mock).mockImplementation((selector: (value: AgentChatState) => unknown) =>
      selector(state),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("renders summaries, relative time, and the active selection", () => {
    render(<ConversationList />);

    expect(screen.getByText("Inspect recording")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics · 1 hour ago · 4 messages")).toBeInTheDocument();
    expect(screen.getByText("yesterday · 2 messages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Inspect recording/ })).toHaveClass("Mui-selected");
  });

  it("switches, deletes, and starts conversations", () => {
    render(<ConversationList />);

    fireEvent.click(screen.getByRole("button", { name: /^Find device/ }));
    expect(switchConversation).toHaveBeenCalledWith("conversation-2");

    fireEvent.click(screen.getByRole("button", { name: "Delete Find device" }));
    expect(deleteConversation).toHaveBeenCalledWith("conversation-2");

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(startNewConversation).toHaveBeenCalledTimes(1);
  });

  it("renders loading, empty, and offline states", () => {
    setState({ conversations: [], conversationsLoading: true });
    const { rerender } = render(<ConversationList />);
    expect(screen.getByText("Loading conversations…")).toBeInTheDocument();

    setState({ conversations: [], conversationsLoading: false });
    rerender(<ConversationList />);
    expect(screen.getByText("No conversation history")).toBeInTheDocument();

    setState({
      conversations: [],
      conversationsLoading: false,
      conversationsOffline: true,
    });
    rerender(<ConversationList />);
    expect(screen.getByText("Conversation history is offline.")).toBeInTheDocument();
  });
});

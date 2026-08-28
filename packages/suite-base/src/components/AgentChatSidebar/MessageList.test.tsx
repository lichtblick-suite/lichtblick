/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useAgentChat } from "@lichtblick/suite-base/context/AgentChatContext";
import { ChatMessage } from "@lichtblick/suite-base/services/agent/types";

import { MessageList } from "./MessageList";

const mockMarkdownRender = jest.fn((props: { children?: React.ReactNode }) => (
  <>{props.children}</>
));
const sendMessage = jest.fn().mockResolvedValue(undefined);

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AgentChatContext", () => ({
  useAgentChat: jest.fn(),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode }) => mockMarkdownRender(props),
}));

jest.mock("./ToolRunGroup", () => ({
  ToolRunGroup: ({ toolRuns }: { toolRuns: { id: string; name: string }[] }) => (
    <div data-testid="tool-run-group">
      {toolRuns.map((toolRun) => (
        <div key={toolRun.id} data-testid="tool-run-card">
          {toolRun.name}
        </div>
      ))}
    </div>
  ),
}));

describe("MessageList", () => {
  beforeEach(() => {
    mockMarkdownRender.mockClear();
    sendMessage.mockClear();
    (useAgentChat as jest.Mock).mockImplementation(
      (selector: (state: { actions: { sendMessage: typeof sendMessage } }) => unknown) =>
        selector({ actions: { sendMessage } }),
    );
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("rerenders only the changed streaming message", () => {
    const firstMessage: ChatMessage = {
      id: "message-1",
      role: "assistant",
      content: "Completed history",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    const streamingMessage: ChatMessage = {
      id: "message-2",
      role: "assistant",
      content: "Partial",
      createdAt: "2026-07-27T00:00:01.000Z",
    };

    const { rerender } = render(<MessageList messages={[firstMessage, streamingMessage]} />);
    expect(mockMarkdownRender).toHaveBeenCalledTimes(2);

    rerender(
      <MessageList
        messages={[
          firstMessage,
          {
            ...streamingMessage,
            content: "Partial response",
          },
        ]}
      />,
    );

    expect(mockMarkdownRender).toHaveBeenCalledTimes(3);
    expect(mockMarkdownRender.mock.calls[2]?.[0].children).toBe("Partial response");
  });

  it("anchors expanded history across appends and resets when the anchor disappears", () => {
    const messages: ChatMessage[] = Array.from({ length: 105 }, (_, index) => ({
      id: `message-${index}`,
      role: "assistant",
      content: `Message ${index}`,
      createdAt: "2026-07-27T00:00:00.000Z",
    }));

    const { rerender } = render(<MessageList messages={messages} />);

    expect(screen.getAllByRole("article")).toHaveLength(100);
    expect(screen.queryByText("Message 0")).not.toBeInTheDocument();
    expect(mockMarkdownRender).toHaveBeenCalledTimes(100);

    fireEvent.click(screen.getByRole("button", { name: "showEarlierMessages" }));

    expect(screen.getAllByRole("article")).toHaveLength(105);
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(mockMarkdownRender).toHaveBeenCalledTimes(105);

    const appendedMessage: ChatMessage = {
      id: "message-105",
      role: "assistant",
      content: "Message 105",
      createdAt: "2026-07-27T00:00:01.000Z",
    };
    rerender(<MessageList messages={[...messages, appendedMessage]} />);

    expect(screen.getAllByRole("article")).toHaveLength(106);
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "showEarlierMessages" })).not.toBeInTheDocument();

    const resetMessages: ChatMessage[] = Array.from({ length: 150 }, (_, index) => ({
      id: `reset-message-${index}`,
      role: "assistant",
      content: `Reset message ${index}`,
      createdAt: "2026-07-27T00:01:00.000Z",
    }));
    rerender(<MessageList messages={resetMessages} />);

    expect(screen.getAllByRole("article")).toHaveLength(100);
    expect(screen.queryByText("Reset message 0")).not.toBeInTheDocument();
    expect(screen.getByText("Reset message 50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "showEarlierMessages" })).toBeInTheDocument();
  });

  it("renders all tool runs for one message inside a single execution group", () => {
    const message: ChatMessage = {
      id: "message-tools",
      role: "assistant",
      content: "Used two tools",
      createdAt: "2026-08-04T00:00:00.000Z",
      toolRuns: [
        { id: "tool-skill", name: "load_skill", status: "succeeded" },
        { id: "tool-search", name: "get_data_catalog", status: "running" },
      ],
    };

    render(<MessageList messages={[message]} />);

    const group = screen.getByTestId("tool-run-group");
    expect(screen.getAllByTestId("tool-run-group")).toHaveLength(1);
    expect(within(group).getAllByTestId("tool-run-card")).toHaveLength(2);
    expect(within(group).getByText("load_skill")).toBeInTheDocument();
    expect(within(group).getByText("get_data_catalog")).toBeInTheDocument();
  });

  it("hides in-progress assistant content after a tool run starts", () => {
    const message: ChatMessage = {
      id: "message-processing",
      role: "assistant",
      content: "Fragmented intermediate response",
      createdAt: "2026-08-04T00:00:00.000Z",
      toolRuns: [{ id: "tool-running", name: "get_data_catalog", status: "running" }],
    };

    render(<MessageList messages={[message]} status="streaming" />);

    const article = screen.getByRole("article");
    const toolGroup = within(article).getByTestId("tool-run-group");
    const processing = within(article).getByTestId("agent-chat-processing");
    expect(processing).toHaveTextContent("processing");
    expect(within(article).queryByText("Fragmented intermediate response")).not.toBeInTheDocument();
    expect(toolGroup.nextElementSibling).toBe(processing);
  });

  it("keeps streaming an in-progress assistant message before any tool run starts", () => {
    const message: ChatMessage = {
      id: "message-text-stream",
      role: "assistant",
      content: "Streaming text response",
      createdAt: "2026-08-04T00:00:00.000Z",
    };

    render(<MessageList messages={[message]} status="streaming" />);

    expect(screen.getByText("Streaming text response")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-chat-processing")).not.toBeInTheDocument();
  });

  it("reveals the full assistant response when the tool-assisted turn completes", () => {
    const message: ChatMessage = {
      id: "message-complete",
      role: "assistant",
      content: "Final complete response",
      createdAt: "2026-08-04T00:00:00.000Z",
      toolRuns: [{ id: "tool-complete", name: "get_data_catalog", status: "succeeded" }],
    };

    render(<MessageList messages={[message]} status="idle" />);

    expect(screen.getByText("Final complete response")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-chat-processing")).not.toBeInTheDocument();
  });

  it("leaves historical tool-assisted messages visible during a later tool run", () => {
    const historicalMessage: ChatMessage = {
      id: "message-history",
      role: "assistant",
      content: "Historical final response",
      createdAt: "2026-08-04T00:00:00.000Z",
      toolRuns: [{ id: "tool-history", name: "get_data_catalog", status: "succeeded" }],
    };
    const activeMessage: ChatMessage = {
      id: "message-active",
      role: "assistant",
      content: "Active fragmented response",
      createdAt: "2026-08-04T00:00:01.000Z",
      toolRuns: [{ id: "tool-active", name: "get_data_catalog", status: "running" }],
    };

    render(<MessageList messages={[historicalMessage, activeMessage]} status="streaming" />);

    expect(screen.getByText("Historical final response")).toBeInTheDocument();
    expect(screen.queryByText("Active fragmented response")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("agent-chat-processing")).toHaveLength(1);
  });
});

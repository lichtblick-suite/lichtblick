/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import {
  AgentChatState,
  useAgentChat,
} from "@lichtblick/suite-base/context/AgentChatContext";
import LinkHandlerContext from "@lichtblick/suite-base/context/LinkHandlerContext";

import AgentChatSidebar from "./AgentChatSidebar";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AgentChatContext", () => ({
  useAgentChat: jest.fn(),
}));

const translations: Record<string, string> = {
  title: "Agent Chat",
  assistant: "Assistant",
  you: "You",
  emptyTitle: "How can I help?",
  emptyDescription: "Ask about your data.",
  inputPlaceholder: "Ask the agent",
  inputLabel: "Message",
  send: "Send",
  reset: "Reset",
  cancel: "Cancel",
  apply: "Apply",
  ignore: "Ignore",
  layoutProposal: "Layout proposal",
  previousProposalApplying: "Previous proposal is still applying",
  showEarlierMessages: "Show earlier messages",
  imageHasAdditionalParameters: "Includes additional parameters",
  executionExpand: "Expand execution process",
  executionCollapse: "Collapse execution process",
  executionRunning: "Running",
  "profileSelector.label": "Agent profile",
  "profileSelector.appliesToFutureMessages":
    "The new profile applies to future messages in this conversation.",
  "status.idle": "Idle",
  "status.connecting": "Connecting",
  "status.streaming": "Streaming",
  "status.waitingForCatalog": "Waiting for data",
  "status.error": "Error",
  "toolStatus.queued": "Queued",
  "toolStatus.running": "Running",
  "toolStatus.succeeded": "Succeeded",
  "toolStatus.failed": "Failed",
  "toolStatus.cancelled": "Cancelled",
};

const sendMessage = jest.fn<ReturnType<AgentChatState["actions"]["sendMessage"]>, [string]>();
const applyProposal = jest.fn<ReturnType<AgentChatState["actions"]["applyProposal"]>, []>();
const dismissProposal = jest.fn<ReturnType<AgentChatState["actions"]["dismissProposal"]>, []>();
const reset = jest.fn<ReturnType<AgentChatState["actions"]["reset"]>, []>();
const notifyCatalogReady = jest.fn();
const cancelWaiting = jest.fn();
const startNewConversation = jest.fn();
const switchConversation = jest.fn().mockResolvedValue(undefined);
const deleteConversation = jest.fn().mockResolvedValue(undefined);
const refreshConversations = jest.fn().mockResolvedValue(undefined);
const selectProfile = jest.fn();
function createDeferred(): {
  promise: Promise<void>;
  reject: (error: Error) => void;
  resolve: () => void;
} {
  let rejectPromise: ((error: Error) => void) | undefined;
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  return {
    promise,
    reject: (error) => {
      rejectPromise?.(error);
    },
    resolve: () => {
      resolvePromise?.();
    },
  };
}

let mockState: AgentChatState;

function setMockState(overrides: Partial<AgentChatState> = {}): void {
  mockState = {
    conversations: [],
    conversationsLoading: false,
    conversationsOffline: false,
    messages: [],
    status: "idle",
    actions: {
      sendMessage,
      applyProposal,
      dismissProposal,
      reset,
      notifyCatalogReady,
      cancelWaiting,
      startNewConversation,
      switchConversation,
      deleteConversation,
      refreshConversations,
    },
    ...overrides,
  };
}

describe("AgentChatSidebar", () => {
  const scrollIntoView = jest.fn();
  const animationFrames = new Map<number, FrameRequestCallback>();
  let nextAnimationFrameId = 1;

  function flushAnimationFrames(): void {
    const callbacks = [...animationFrames.values()];
    animationFrames.clear();
    act(() => {
      for (const callback of callbacks) {
        callback(performance.now());
      }
    });
  }

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        const id = nextAnimationFrameId++;
        animationFrames.set(id, callback);
        return id;
      }),
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      value: jest.fn((id: number) => {
        animationFrames.delete(id);
      }),
    });
  });

  beforeEach(() => {
    setMockState();
    sendMessage.mockResolvedValue(undefined);
    applyProposal.mockResolvedValue(undefined);
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, options?: { defaultValue?: string; name?: string }) =>
        key === "toolProgress"
          ? `Progress for ${options?.name ?? ""}`
          : (translations[key] ?? options?.defaultValue ?? key),
    });
    (useAgentChat as jest.Mock).mockImplementation(
      (selector: (state: AgentChatState) => unknown) => selector(mockState),
    );
  });

  afterEach(() => {
    animationFrames.clear();
    jest.clearAllMocks();
  });

  it("renders markdown messages and skips raw HTML", () => {
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "**Ready** <span data-testid=\"unsafe-html\">unsafe</span>",
          createdAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });

    render(<AgentChatSidebar />);

    expect(screen.getByText("Ready").tagName).toBe("STRONG");
    expect(screen.queryByTestId("unsafe-html")).not.toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("does not load a markdown image until the user approves it", () => {
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "![tracking pixel](https://attacker.example/pixel.png)",
          createdAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });

    render(<AgentChatSidebar />);

    expect(screen.queryByRole("img", { name: "tracking pixel" })).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "https://attacker.example/pixel.png: tracking pixel",
      }),
    );

    const image = screen.getByRole("img", { name: "tracking pixel" });
    expect(image).toHaveAttribute("src", "https://attacker.example/pixel.png");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("requires approval again when a markdown image source changes", () => {
    const message = {
      id: "message-1",
      role: "assistant" as const,
      content: "![chart](https://trusted.example/chart.png)",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    setMockState({ messages: [message] });
    const { rerender } = render(<AgentChatSidebar />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "https://trusted.example/chart.png: chart",
      }),
    );
    expect(screen.getByRole("img", { name: "chart" })).toHaveAttribute(
      "src",
      "https://trusted.example/chart.png",
    );

    setMockState({
      messages: [
        {
          ...message,
          content: "![chart](https://attacker.example/replacement.png?track=1)",
        },
      ],
    });
    rerender(<AgentChatSidebar />);

    expect(screen.queryByRole("img", { name: "chart" })).not.toBeInTheDocument();
    const replacementApproval = screen.getByRole("button", {
      name: "https://attacker.example/replacement.png (Includes additional parameters): chart",
    });
    expect(replacementApproval).toHaveTextContent(
      "https://attacker.example/replacement.png (Includes additional parameters)",
    );
    expect(replacementApproval).toHaveAttribute(
      "title",
      "https://attacker.example/replacement.png?track=1",
    );
  });

  it("shows an unambiguous full image origin and path", () => {
    const longPath = `/reports/${"segment/".repeat(12)}chart.png`;
    const source = `https://images.example:8443${longPath}?account=A#preview`;
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: `![report](${source})`,
          createdAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });

    render(<AgentChatSidebar />);

    const approval = screen.getByRole("button", {
      name: `https://images.example:8443${longPath} (Includes additional parameters): report`,
    });
    expect(approval).toHaveTextContent(`https://images.example:8443${longPath}`);
    expect(approval).toHaveTextContent("Includes additional parameters");
    expect(approval).toHaveAttribute("title", source);
  });

  it("opens markdown links safely through LinkHandlerContext", () => {
    const handleLink = jest.fn((event: React.MouseEvent) => {
      event.preventDefault();
    });
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "[Open documentation](https://example.com/docs)",
          createdAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });

    render(
      <LinkHandlerContext.Provider value={handleLink}>
        <AgentChatSidebar />
      </LinkHandlerContext.Provider>,
    );

    const link = screen.getByRole("link", { name: "Open documentation" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(link);
    expect(handleLink).toHaveBeenCalledWith(expect.anything(), "https://example.com/docs");
  });

  it("starts a new conversation, and offers it only once there is something to discard", () => {
    setMockState();
    const { rerender } = render(<AgentChatSidebar />);
    // Nothing to reset yet, so the control stays out of the way rather than being a no-op.
    expect(screen.getByTestId("agent-chat-new-conversation")).toBeDisabled();

    setMockState({
      messages: [
        {
          id: "m1",
          role: "user",
          content: "find SN001",
          createdAt: "2026-07-29T00:00:00.000Z",
        },
      ],
    });
    rerender(<AgentChatSidebar />);

    const button = screen.getByTestId("agent-chat-new-conversation");
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(startNewConversation).toHaveBeenCalledTimes(1);
  });

  it("renders local profiles and switches the selected profile", () => {
    setMockState({
      profileOptions: [
        {
          id: "diagnostics",
          name: "Diagnostics",
          isActive: true,
        },
        {
          id: "second",
          name: "Second profile",
          isActive: false,
        },
      ],
      selectedProfileId: "diagnostics",
      selectProfile,
    });

    render(<AgentChatSidebar />);

    const selector = screen.getByRole("combobox", { name: "Agent profile" });
    expect(selector).toHaveTextContent("Diagnostics ★");
    fireEvent.mouseDown(selector);
    expect(
      screen.getByRole("option", { name: "Second profile" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Second profile" }));
    expect(selectProfile).toHaveBeenCalledWith("second");
  });

  it("omits an unavailable profile from the selector options", () => {
    setMockState({
      profileOptions: [
        {
          id: "default",
          name: "Default",
          isActive: true,
        },
      ],
      selectedProfileId: "default",
      selectProfile,
    });

    render(<AgentChatSidebar />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));

    expect(
      screen.queryByRole("option", { name: "Second profile" }),
    ).not.toBeInTheDocument();
  });

  it("disables profile switching while the agent is generating", () => {
    setMockState({
      profileOptions: [
        {
          id: "default",
          name: "Default",
          isActive: true,
        },
      ],
      selectedProfileId: "default",
      selectProfile,
      status: "streaming",
    });

    render(<AgentChatSidebar />);

    expect(screen.getByRole("combobox", { name: "Agent profile" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("sends a trimmed message with Enter and clears the input", async () => {
    render(<AgentChatSidebar />);
    const input = screen.getByRole("textbox", { name: "Message" });

    fireEvent.change(input, { target: { value: "  inspect this data  " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("inspect this data");
    });
    expect(input).toHaveValue("");
  });

  it("keeps a newline gesture local when Shift+Enter is pressed", () => {
    render(<AgentChatSidebar />);
    const input = screen.getByRole("textbox", { name: "Message" });

    fireEvent.change(input, { target: { value: "first line" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(input).toHaveValue("first line");
  });

  it("uses a synchronous latch to prevent duplicate sends", async () => {
    const submission = createDeferred();
    sendMessage.mockReturnValue(submission.promise);
    render(<AgentChatSidebar />);
    const input = screen.getByRole("textbox", { name: "Message" });
    const sendButton = screen.getByRole("button", { name: "Send" });

    fireEvent.change(input, { target: { value: "inspect once" } });
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
      sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("inspect once");

    await act(async () => {
      submission.resolve();
      await submission.promise;
    });
  });

  it("shows tool status and determinate progress", () => {
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "Processing data.",
          createdAt: "2026-07-27T00:00:00.000Z",
          toolRuns: [
            {
              id: "tool-1",
              name: "memory_write",
              status: "running",
              progress: 42,
            },
          ],
        },
      ],
    });

    render(<AgentChatSidebar />);

    expect(screen.getByText("Running")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand execution process" }));
    const progressbar = screen.getByRole("progressbar", {
      name: "Progress for memory_write",
    });
    expect(progressbar).toHaveAttribute("aria-valuenow", "42");
  });

  it("disables both proposal actions while applying", async () => {
    const application = createDeferred();
    applyProposal.mockReturnValue(application.promise);
    setMockState({
      pendingProposal: {
        name: "Robot overview",
        summary: "3D, velocity plot, and raw messages",
        data: {},
      },
    });

    render(<AgentChatSidebar />);

    expect(screen.getByText("Robot overview")).toBeInTheDocument();
    expect(screen.getByText("3D, velocity plot, and raw messages")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applyProposal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    expect(applyProposal).toHaveBeenCalledTimes(1);
    expect(dismissProposal).not.toHaveBeenCalled();

    application.resolve();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    });
  });

  it("uses the proposal request id to distinguish replacement generations", async () => {
    const firstApplication = createDeferred();
    const secondApplication = createDeferred();
    applyProposal
      .mockReturnValueOnce(firstApplication.promise)
      .mockReturnValueOnce(secondApplication.promise);
    const sharedProposal = {
      name: "Shared proposal",
      data: { proposal: "shared" },
    };
    setMockState({
      pendingProposal: sharedProposal,
      pendingProposalMessageId: "message-shared",
      pendingProposalRequestId: "request-a",
    });
    const { rerender } = render(<AgentChatSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    setMockState({
      pendingProposal: sharedProposal,
      pendingProposalMessageId: "message-shared",
      pendingProposalRequestId: "request-b",
    });
    rerender(<AgentChatSidebar />);

    expect(screen.getByText("Previous proposal is still applying")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applyProposal).toHaveBeenCalledTimes(1);

    firstApplication.resolve();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    });
    expect(screen.queryByText("Previous proposal is still applying")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applyProposal).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    secondApplication.resolve();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    });
  });

  it("dismisses a proposal when ignore is chosen first", () => {
    setMockState({
      pendingProposal: {
        name: "Robot overview",
        data: {},
      },
    });

    render(<AgentChatSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));

    expect(dismissProposal).toHaveBeenCalledTimes(1);
    expect(applyProposal).not.toHaveBeenCalled();
  });

  it("automatically scrolls when the user remains near the bottom", () => {
    const initialMessage = {
      id: "message-1",
      role: "assistant" as const,
      content: "Initial content",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    setMockState({ messages: [initialMessage], status: "streaming" });

    const { rerender } = render(<AgentChatSidebar />);

    expect(screen.getByTestId("agent-chat-status")).toHaveTextContent("Streaming");
    flushAnimationFrames();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });

    const log = screen.getByRole("log", { name: "Agent Chat" });
    Object.defineProperties(log, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 750, writable: true },
    });
    scrollIntoView.mockClear();
    (requestAnimationFrame as jest.Mock).mockClear();

    setMockState({
      status: "streaming",
      messages: [
        initialMessage,
        { ...initialMessage, id: "message-2", content: "New content" },
      ],
    });
    rerender(<AgentChatSidebar />);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushAnimationFrames();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
  });

  it("does not pull the user down when current layout is no longer near the bottom", () => {
    const initialMessage = {
      id: "message-1",
      role: "assistant" as const,
      content: "Initial content",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    setMockState({ messages: [initialMessage], status: "streaming" });
    const { rerender } = render(<AgentChatSidebar />);
    flushAnimationFrames();
    const log = screen.getByRole("log", { name: "Agent Chat" });
    Object.defineProperties(log, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 500, writable: true },
    });
    scrollIntoView.mockClear();
    (requestAnimationFrame as jest.Mock).mockClear();

    setMockState({
      status: "streaming",
      messages: [
        initialMessage,
        { ...initialMessage, id: "message-2", content: "New content" },
      ],
    });
    rerender(<AgentChatSidebar />);

    flushAnimationFrames();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("coalesces multiple near-bottom updates into one animation frame", () => {
    const initialMessage = {
      id: "message-1",
      role: "assistant" as const,
      content: "Initial content",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    setMockState({ messages: [initialMessage], status: "streaming" });
    const { rerender } = render(<AgentChatSidebar />);
    flushAnimationFrames();
    scrollIntoView.mockClear();
    (requestAnimationFrame as jest.Mock).mockClear();

    setMockState({
      messages: [{ ...initialMessage, content: "First token" }],
      status: "streaming",
    });
    rerender(<AgentChatSidebar />);
    setMockState({
      messages: [{ ...initialMessage, content: "Second token" }],
      status: "streaming",
    });
    rerender(<AgentChatSidebar />);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushAnimationFrames();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending auto-scroll frame during unmount", () => {
    setMockState({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "Pending frame",
          createdAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });
    const { unmount } = render(<AgentChatSidebar />);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(animationFrames).toHaveProperty("size", 1);
    const pendingFrameId = [...animationFrames.keys()][0];
    (cancelAnimationFrame as jest.Mock).mockClear();
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingFrameId);
    expect(animationFrames).toHaveProperty("size", 0);
  });

  it("uses a named log and announces only the latest completed assistant message", () => {
    const message = {
      id: "message-1",
      role: "assistant" as const,
      content: "A streamed response",
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    setMockState({ messages: [message], status: "streaming" });
    const { container, rerender } = render(<AgentChatSidebar />);

    expect(screen.getByRole("region", { name: "Agent Chat" })).toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Agent Chat" });
    expect(log).toHaveAttribute("aria-busy", "true");
    expect(log).toHaveAttribute("aria-live", "off");
    const liveRegion = container.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeEmptyDOMElement();

    setMockState({ messages: [message], status: "waiting-for-catalog" });
    rerender(<AgentChatSidebar />);
    expect(liveRegion).toBeEmptyDOMElement();

    setMockState({ messages: [message], status: "error" });
    rerender(<AgentChatSidebar />);
    expect(liveRegion).toBeEmptyDOMElement();

    setMockState({ messages: [message], status: "idle" });
    rerender(<AgentChatSidebar />);
    expect(screen.getByRole("log", { name: "Agent Chat" })).toHaveAttribute("aria-busy", "false");
    expect(liveRegion).toHaveTextContent("A streamed response");
  });

  it("allows the user to cancel while waiting for the catalog", () => {
    setMockState({ status: "waiting-for-catalog" });

    render(<AgentChatSidebar />);

    expect(screen.getByRole("progressbar", { name: "Waiting for data" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancelWaiting).toHaveBeenCalledTimes(1);
  });
});

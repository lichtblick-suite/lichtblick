// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { AgentEvent as PiAgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";

import { mapPiToolExecutionEvent } from "@lichtblick/suite-base/services/agent/tools/eventMapping";
import type { AgentEvent } from "@lichtblick/suite-base/services/agent/types";

type WithoutSeq<T> = T extends unknown ? Omit<T, "seq"> : never;
export type UnsequencedAgentEvent = WithoutSeq<AgentEvent>;

export type PiAgentFailure = {
  aborted: boolean;
  message: string;
};

function getFailure(message: AgentMessage): PiAgentFailure | undefined {
  if (message.role !== "assistant") {
    return undefined;
  }
  if (message.stopReason !== "error" && message.stopReason !== "aborted") {
    return undefined;
  }
  return {
    aborted: message.stopReason === "aborted",
    message:
      message.errorMessage ??
      (message.stopReason === "aborted" ? "Agent request was cancelled" : "Agent request failed"),
  };
}

export class PiAgentEventAdapter {
  public failure?: PiAgentFailure;

  #ended = false;
  #started = false;
  #terminal = false;

  public constructor(
    private readonly requestId: string,
    private readonly messageId: string,
  ) {}

  public isTerminal(): boolean {
    return this.#terminal;
  }

  public adapt(event: PiAgentEvent): UnsequencedAgentEvent[] {
    if (this.#terminal) {
      return [];
    }

    switch (event.type) {
      case "agent_start":
      case "turn_start":
        return this.#ensureStarted();
      case "message_start":
        return event.message.role === "assistant" ? this.#ensureStarted() : [];
      case "message_update":
        if (event.assistantMessageEvent.type !== "text_delta") {
          return [];
        }
        return [
          ...this.#ensureStarted(),
          {
            type: "token",
            messageId: this.messageId,
            requestId: this.requestId,
            delta: event.assistantMessageEvent.delta,
          },
        ];
      case "turn_end": {
        const failure = getFailure(event.message);
        return failure == undefined ? [] : this.#fail(failure);
      }
      case "agent_end": {
        const failure = this.#lastFailure(event.messages);
        if (failure != undefined) {
          return this.#fail(failure);
        }
        this.#terminal = true;
        return [
          ...this.#ensureStarted(),
          ...this.#ensureEnded(),
          { type: "done", requestId: this.requestId },
        ];
      }
      case "message_end":
        return [];
      case "tool_execution_start":
      case "tool_execution_update":
      case "tool_execution_end":
        return [
          ...this.#ensureStarted(),
          {
            type: "tool-update",
            messageId: this.messageId,
            requestId: this.requestId,
            toolRun: mapPiToolExecutionEvent(event),
          },
        ];
    }
  }

  public fail(error: unknown, options: { aborted?: boolean } = {}): UnsequencedAgentEvent[] {
    const message = error instanceof Error ? error.message : String(error);
    return this.#fail({ aborted: options.aborted ?? false, message });
  }

  #ensureStarted(): UnsequencedAgentEvent[] {
    if (this.#started) {
      return [];
    }
    this.#started = true;
    return [{ type: "message-start", messageId: this.messageId, requestId: this.requestId }];
  }

  #ensureEnded(): UnsequencedAgentEvent[] {
    if (this.#ended) {
      return [];
    }
    this.#ended = true;
    return [{ type: "message-end", messageId: this.messageId, requestId: this.requestId }];
  }

  #fail(failure: PiAgentFailure): UnsequencedAgentEvent[] {
    if (this.#terminal) {
      return [];
    }
    this.failure = failure;
    this.#terminal = true;
    return [
      ...this.#ensureStarted(),
      ...this.#ensureEnded(),
      { type: "error", requestId: this.requestId, error: failure.message },
    ];
  }

  #lastFailure(messages: AgentMessage[]): PiAgentFailure | undefined {
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message != undefined) {
        const failure = getFailure(message);
        if (failure != undefined) {
          return failure;
        }
      }
    }
    return undefined;
  }
}

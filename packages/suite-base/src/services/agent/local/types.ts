// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type LlmToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type LlmStopReason =
  | "end"
  | "tool-use"
  | "max-tokens"
  | "context-exceeded"
  | "filtered"
  | "refusal"
  | "pause"
  | "truncated";

export type LlmContentFormat = "anthropic-native" | "provider-neutral";

export type LlmStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | {
      type: "done";
      stopReason: LlmStopReason;
      /**
       * Provider-native assistant content. The orchestrator stores and returns this value
       * unchanged so signed thinking/redacted-thinking blocks are not reconstructed or lost.
       */
      finalContent?: unknown[];
      finalContentFormat?: LlmContentFormat;
    };

/**
 * Provider-neutral content blocks used to preserve tool calls and results between orchestration
 * rounds. Providers also accept a plain string for simple user messages.
 */
export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      content: unknown;
      isError?: boolean;
    };

export type LlmMessage = {
  role: "user" | "assistant";
  /**
   * Assistant content may be provider-native. A provider must recognize content that it emitted
   * in `done.finalContent`; provider-neutral blocks are used for tool results and as a fallback.
   */
  content: unknown;
  contentFormat?: LlmContentFormat;
};

export type LlmStreamArgs = {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDef[];
  model?: string;
};

export interface ILlmProvider {
  stream: (
    args: LlmStreamArgs,
    onEvent: (event: LlmStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<void>;
}

export type CatalogSnapshot = {
  topics: readonly unknown[];
  datatypes: ReadonlyMap<string, unknown>;
};

export type LlmProviderName = "anthropic" | "openai-compatible";

export class LlmProviderError extends Error {
  public constructor(
    message: string,
    public readonly provider: LlmProviderName,
    public readonly retryable: boolean,
    options?: ErrorOptions & { status?: number },
  ) {
    super(message, options);
    this.name = "LlmProviderError";
    this.status = options?.status;
  }

  public readonly status: number | undefined;
}

export function isLlmContentBlock(value: unknown): value is LlmContentBlock {
  if (typeof value !== "object" || value == undefined || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "text":
      return typeof record.text === "string";
    case "tool-call":
      return (
        typeof record.id === "string" &&
        typeof record.name === "string" &&
        Object.hasOwn(record, "input")
      );
    case "tool-result":
      return (
        typeof record.toolCallId === "string" &&
        Object.hasOwn(record, "content") &&
        (typeof record.isError === "undefined" ||
          typeof record.isError === "boolean")
      );
    default:
      return false;
  }
}

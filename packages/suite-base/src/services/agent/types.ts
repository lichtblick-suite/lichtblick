// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

const MAX_CONSECUTIVE_NON_JSON_FRAMES = 3;

/**
 * Local Agent stream error surface. Kept in the shared types module so Agent stream consumers can
 * match protocol errors without depending on a remote client implementation.
 */
export class AgentStreamProtocolError extends Error {
  public constructor(
    message = `Agent event stream contained ${MAX_CONSECUTIVE_NON_JSON_FRAMES} consecutive invalid data frames`,
  ) {
    super(message);
    this.name = "AgentStreamProtocolError";
  }
}

export type ToolRunStatus =
  | "queued"
  | "running"
  | "awaiting-confirmation"
  | "succeeded"
  | "failed"
  | "cancelled";
export type ToolRun = {
  id: string;
  name: string;
  status: ToolRunStatus;
  progress?: number;
  summary?: string;
  result?: unknown;
  error?: string;
};
export type ToolConfirmationScope = "once" | "session";
export type ToolConfirmationOptions = {
  approve: boolean;
  scope?: ToolConfirmationScope;
};
export type ToolConfirmationDecision = {
  approved: boolean;
  scope: ToolConfirmationScope;
};
export type ChatRole = "user" | "assistant";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolRuns?: ToolRun[];
  createdAt: string;
};
export type LayoutProposal = {
  name: string;
  data: unknown;
  summary?: string;
  /**
   * Baseline captured when the proposal was generated: the id of the layout the agent based its
   * proposal on and a stable fingerprint of its data. Present only when a current layout existed
   * at proposal time; lets the apply path detect layout changes and apply strictly incremental
   * proposals in place.
   */
  baseLayoutId?: string;
  baseFingerprint?: string;
};
/**
 * Display mode for a layout proposal card: adding panels to the current layout vs creating a new
 * layout. The count is a display hint only; the apply-time diff is authoritative.
 */
export type LayoutProposalMode =
  | { kind: "incremental"; newPanelCount: number }
  | { kind: "new" };
export type AgentEventEnvelope = {
  /** Monotonically increasing positive safe integer within a session event stream. */
  seq: number;
  /** Non-empty when present; identifies the associated sendMessage request. */
  requestId?: string;
};
export type AgentEvent =
  | (AgentEventEnvelope & {
      type: "message-start";
      messageId: string;
      requestId: string;
    })
  | (AgentEventEnvelope & {
      type: "token";
      messageId: string;
      delta: string;
      requestId: string;
    })
  | (AgentEventEnvelope & {
      type: "message-end";
      messageId: string;
      requestId: string;
    })
  | (AgentEventEnvelope & {
      type: "tool-update";
      messageId: string;
      toolRun: ToolRun;
      requestId: string;
    })
  | (AgentEventEnvelope & {
      type: "layout-proposal";
      messageId: string;
      proposal: LayoutProposal;
      requestId: string;
    })
  | (AgentEventEnvelope & {
      type: "open-data-source";
      messageId: string;
      urls: string[];
      sessionId?: string;
      requestId: string;
    })
  | (AgentEventEnvelope & { type: "error"; error: string })
  | (AgentEventEnvelope & { type: "done"; requestId: string });
export type SubscribeEventsOptions = {
  /**
   * Maximum time without receiving any response bytes before the subscription rejects.
   * Defaults to 60 seconds.
   */
  idleTimeoutMs?: number;
  /** Non-negative safe-integer replay cursor. The server returns events above this value. */
  lastSeq?: number;
};
export type SubscribeEventsResult = {
  /**
   * EOF always means that this physical connection ended and may be reconnected. A server that
   * intends to terminate the session must send a session-level error or a dedicated control event.
   */
  reason: "eof";
};
export interface IAgentClient {
  createSession: (signal?: AbortSignal) => Promise<{ sessionId: string }>;
  sendMessage: (
    sessionId: string,
    content: string,
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  /**
   * Resolves with an EOF reason when the physical SSE connection closes. Events with
   * seq <= options.lastSeq, including replayed events, are discarded. Caller cancellation rejects
   * with the AbortSignal reason. The void union preserves compatibility with legacy client
   * implementations; current implementations always return SubscribeEventsResult.
   */
  subscribeEvents: (
    sessionId: string,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
    options?: SubscribeEventsOptions,
  ) => Promise<SubscribeEventsResult | void>;
  confirmToolRun: (
    sessionId: string,
    toolRunId: string,
    options: ToolConfirmationOptions,
    signal?: AbortSignal,
  ) => Promise<void>;
  notifyCatalogReady: (
    sessionId: string,
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<void>;
}

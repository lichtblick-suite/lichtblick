// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  Agent,
  type AfterToolCallContext,
  type AgentEvent as PiAgentEvent,
  type AgentMessage,
  type AgentTool,
  type BeforeToolCallContext,
  type StreamFn,
} from "@earendil-works/pi-agent-core";
import { v4 as uuidv4 } from "uuid";

import type { AgentConfiguration } from "@lichtblick/suite-base/services/agent/agentSettings";
import { collectLayoutBaseline } from "@lichtblick/suite-base/services/agent/layoutDiff";
import type { Skill } from "@lichtblick/suite-base/services/agent/local/skills";
import {
  buildDynamicContext,
  buildStaticSystemPrompt,
} from "@lichtblick/suite-base/services/agent/local/systemPrompt";
import {
  renderAgentMemories,
  type AgentMemoryStore,
} from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import type { PanelInventoryEntry } from "@lichtblick/suite-base/services/agent/panelInventory";
import {
  EMPTY_CUSTOMIZATION,
  resolveSkills,
  type AgentPromptCustomization,
} from "@lichtblick/suite-base/services/agent/prompts/agentPrompts";
import { buildPiTools } from "@lichtblick/suite-base/services/agent/tools/piTools";
import {
  boundedToolResult,
  type ToolRuntimeDeps,
} from "@lichtblick/suite-base/services/agent/tools/toolRuntime";
import type {
  AgentEvent,
  IAgentClient,
  SubscribeEventsOptions,
} from "@lichtblick/suite-base/services/agent/types";

import { PiAgentEventAdapter, type UnsequencedAgentEvent } from "./eventAdapter";
import { createPiModelRuntime, type PiModelRuntime } from "./models";

export const PI_AGENT_EVENT_REPLAY_LIMIT = 1000;

export type PiAgentToolRuntime = {
  deps: Pick<ToolRuntimeDeps, "dataQuery" | "getCatalog" | "memoryStore">;
};

export type PiAgentOrchestratorOptions = {
  configuration: AgentConfiguration;
  /** Complete prompt override retained for isolated engine tests. */
  getSystemPrompt?: () => string;
  getPromptCustomization?: () => AgentPromptCustomization;
  getPanelInventory?: () => readonly PanelInventoryEntry[];
  getTimezone?: () => string;
  getWorkspaceContext?: () => string | undefined;
  /** Current layout data; used to fingerprint the layout baseline of layout proposals. */
  getCurrentLayout?: () => unknown;
  /** Id of the currently selected layout; captured as the proposal baseline id. */
  getCurrentLayoutId?: () => string | undefined;
  makeId?: () => string;
  memoryStore?: AgentMemoryStore;
  now?: () => Date;
  onHistoryChanged?: (history: readonly AgentMessage[]) => void;
  restoreHistory?: () => Promise<AgentMessage[]>;
  streamFn?: StreamFn;
  toolRuntime?: PiAgentToolRuntime;
};

type ActiveRequest = {
  adapter: PiAgentEventAdapter;
  messageId: string;
  openedDataSource: boolean;
  requestId: string;
};

type SessionState = {
  active?: ActiveRequest;
  agent: Agent;
  controller: AbortController;
  dynamicContextRef: { current?: AgentMessage };
  events: AgentEvent[];
  id: string;
  catalogNotifications: Map<string, Promise<void>>;
  nextSeq: number;
  queue: Promise<void>;
  removeParentAbortListener?: () => void;
  requestIds: Set<string>;
  subscribers: Set<(event: AgentEvent) => void>;
  unsubscribeAgent: () => void;
  waitingCatalogRequestIds: Set<string>;
};

type TurnContext = {
  dynamicContext?: AgentMessage;
  staticPrompt: string;
  tools: AgentTool[];
};

function abortError(message = "Agent request was cancelled"): DOMException {
  return new DOMException(message, "AbortError");
}

function errorReason(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  if (
    typeof reason === "object" &&
    reason != undefined &&
    "message" in reason &&
    typeof reason.message === "string"
  ) {
    const error = new Error(reason.message);
    if ("name" in reason && typeof reason.name === "string") {
      error.name = reason.name;
    }
    return error;
  }
  return new Error(String(reason));
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason == undefined ? abortError() : errorReason(signal.reason);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw abortReason(signal);
  }
}

function requestsOpenDataSource(context: BeforeToolCallContext | AfterToolCallContext): boolean {
  return context.assistantMessage.content.some(
    (content) => content.type === "toolCall" && content.name === "open_data_source",
  );
}

function linkAbortSignals(signals: readonly (AbortSignal | undefined)[]): {
  cleanup: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const signal of signals) {
    if (signal == undefined) {
      continue;
    }
    if (signal.aborted) {
      controller.abort(abortReason(signal));
      break;
    }
    const onAbort = () => {
      controller.abort(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => {
      signal.removeEventListener("abort", onAbort);
    });
  }

  return {
    cleanup: () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    },
    signal: controller.signal,
  };
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal == undefined) {
    return await promise;
  }
  throwIfAborted(signal);
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(errorReason(error));
      },
    );
  });
}

export class PiAgentOrchestrator implements IAgentClient {
  readonly #getPanelInventory?: () => readonly PanelInventoryEntry[];
  readonly #getPromptCustomization?: () => AgentPromptCustomization;
  readonly #getSystemPrompt?: () => string;
  readonly #getTimezone: () => string;
  readonly #getWorkspaceContext?: () => string | undefined;
  readonly #getCurrentLayout?: () => unknown;
  readonly #getCurrentLayoutId?: () => string | undefined;
  readonly #makeId: () => string;
  readonly #memoryStore?: AgentMemoryStore;
  readonly #now: () => Date;
  readonly #onHistoryChanged?: (history: readonly AgentMessage[]) => void;
  readonly #restoreHistory?: () => Promise<AgentMessage[]>;
  readonly #runtime: PiModelRuntime;
  readonly #sessions = new Map<string, SessionState>();
  readonly #streamFn: StreamFn;
  readonly #toolRuntime?: PiAgentToolRuntime;

  public constructor(options: PiAgentOrchestratorOptions) {
    this.#runtime = createPiModelRuntime(options.configuration);
    this.#streamFn = options.streamFn ?? this.#runtime.streamFn;
    this.#getSystemPrompt = options.getSystemPrompt;
    this.#getPanelInventory = options.getPanelInventory;
    this.#getPromptCustomization = options.getPromptCustomization;
    this.#getTimezone =
      options.getTimezone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    this.#getWorkspaceContext = options.getWorkspaceContext;
    this.#getCurrentLayout = options.getCurrentLayout;
    this.#getCurrentLayoutId = options.getCurrentLayoutId;
    this.#makeId = options.makeId ?? uuidv4;
    this.#memoryStore = options.memoryStore;
    this.#now = options.now ?? (() => new Date());
    this.#onHistoryChanged = options.onHistoryChanged;
    this.#restoreHistory = options.restoreHistory;
    this.#toolRuntime = options.toolRuntime;
  }

  public async createSession(signal?: AbortSignal): Promise<{ sessionId: string }> {
    throwIfAborted(signal);
    const sessionId = this.#makeId();
    const controller = new AbortController();
    let restoredHistory: AgentMessage[] = [];
    try {
      restoredHistory = (await this.#restoreHistory?.()) ?? [];
    } catch {
      // Persistence is best-effort; a corrupt or unavailable snapshot starts a fresh context.
    }
    throwIfAborted(signal);
    const turn = this.#buildTurnContext(sessionId);
    const dynamicContextRef: { current?: AgentMessage } = {
      current: turn.dynamicContext,
    };
    const agent = new Agent({
      initialState: {
        messages: restoredHistory,
        model: this.#runtime.model,
        systemPrompt: turn.staticPrompt,
        tools: turn.tools,
      },
      sessionId,
      streamFn: this.#streamFn,
      // pi exposes one systemPrompt string rather than multiple system blocks. Its transformContext
      // hook lets us inject the changing workspace/clock ahead of the transcript without storing it
      // in history, while Anthropic can keep caching the stable system block independently.
      transformContext: async (messages) =>
        dynamicContextRef.current == undefined
          ? messages
          : [dynamicContextRef.current, ...messages],
      toolExecution: "sequential",
      beforeToolCall: async (context, toolSignal) =>
        await this.#beforeToolCall(sessionId, context, toolSignal),
      afterToolCall: async (context, toolSignal) =>
        await this.#afterToolCall(sessionId, context, toolSignal),
    });
    const session: SessionState = {
      agent,
      catalogNotifications: new Map(),
      controller,
      dynamicContextRef,
      events: [],
      id: sessionId,
      nextSeq: 1,
      queue: Promise.resolve(),
      requestIds: new Set(),
      subscribers: new Set(),
      unsubscribeAgent: () => {},
      waitingCatalogRequestIds: new Set(),
    };
    session.unsubscribeAgent = agent.subscribe((event) => {
      this.#handlePiEvent(session, event);
    });
    this.#sessions.set(sessionId, session);

    if (signal != undefined) {
      const onAbort = () => {
        this.disposeSession(sessionId, abortReason(signal));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      session.removeParentAbortListener = () => {
        signal.removeEventListener("abort", onAbort);
      };
    }

    return { sessionId };
  }

  public async sendMessage(
    sessionId: string,
    content: string,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const session = this.#requireSession(sessionId);
    if (content.trim().length === 0) {
      throw new Error("Agent message content must not be empty");
    }
    if (requestId.trim().length === 0) {
      throw new Error("Agent requestId must not be empty");
    }
    if (session.requestIds.has(requestId)) {
      throw new Error(`Agent requestId has already been used: ${requestId}`);
    }
    session.requestIds.add(requestId);

    const operation = session.queue.then(async () => {
      const linked = linkAbortSignals([session.controller.signal, signal]);
      const messageId = this.#makeId();
      const adapter = new PiAgentEventAdapter(requestId, messageId);
      try {
        throwIfAborted(linked.signal);
        // Refresh prompt, model, and enabled-skill tools for every queued user turn.
        const turn = this.#buildTurnContext(sessionId);
        session.agent.state.systemPrompt = turn.staticPrompt;
        session.agent.state.model = this.#runtime.model;
        session.agent.state.tools = turn.tools;
        session.dynamicContextRef.current = turn.dynamicContext;
        session.active = {
          adapter,
          messageId,
          openedDataSource: false,
          requestId,
        };
        const onAbort = () => {
          session.agent.abort();
        };
        linked.signal.addEventListener("abort", onAbort, { once: true });
        try {
          await session.agent.prompt(content);
        } finally {
          linked.signal.removeEventListener("abort", onAbort);
        }

        if (adapter.failure != undefined) {
          if (adapter.failure.aborted) {
            throw abortError(adapter.failure.message);
          }
          throw new Error(adapter.failure.message);
        }
        throwIfAborted(linked.signal);
        try {
          this.#onHistoryChanged?.(session.agent.state.messages);
        } catch {
          // A persistence failure must not fail the model turn that just completed.
        }
      } catch (error) {
        if (!adapter.isTerminal()) {
          const aborted = linked.signal.aborted;
          for (const event of adapter.fail(error, { aborted })) {
            this.#emit(session, event);
          }
        }
        throw error;
      } finally {
        if (session.active?.requestId === requestId) {
          session.active = undefined;
        }
        linked.cleanup();
      }
    });
    session.queue = operation.catch(() => {});
    await raceWithAbort(operation, signal);
  }

  public async subscribeEvents(
    sessionId: string,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
    options?: SubscribeEventsOptions,
  ): Promise<void> {
    const session = this.#requireSession(sessionId);
    throwIfAborted(signal);
    const lastSeq = options?.lastSeq ?? 0;
    if (!Number.isSafeInteger(lastSeq) || lastSeq < 0) {
      throw new Error("Agent event replay cursor must be a non-negative safe integer");
    }
    for (const event of session.events) {
      if (event.seq > lastSeq) {
        onEvent(event);
      }
    }

    await new Promise<void>((_resolve, reject) => {
      const cleanup = () => {
        session.subscribers.delete(onEvent);
        signal?.removeEventListener("abort", onAbort);
        session.controller.signal.removeEventListener("abort", onSessionAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(signal == undefined ? abortError() : abortReason(signal));
      };
      const onSessionAbort = () => {
        cleanup();
        reject(abortReason(session.controller.signal));
      };
      session.subscribers.add(onEvent);
      signal?.addEventListener("abort", onAbort, { once: true });
      session.controller.signal.addEventListener("abort", onSessionAbort, {
        once: true,
      });
    });
  }

  public async notifyCatalogReady(
    sessionId: string,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    throwIfAborted(signal);
    if (requestId.trim().length === 0) {
      throw new Error("Agent requestId must not be empty");
    }
    const session = this.#requireSession(sessionId);
    if (!session.waitingCatalogRequestIds.has(requestId)) {
      return;
    }
    let operation = session.catalogNotifications.get(requestId);
    if (operation == undefined) {
      operation = this.#continueWithCatalog(session, requestId);
      const ownedOperation = operation;
      session.catalogNotifications.set(requestId, operation);
      const cleanup = () => {
        if (session.catalogNotifications.get(requestId) === ownedOperation) {
          session.catalogNotifications.delete(requestId);
        }
      };
      void operation.then(cleanup, cleanup);
    }
    await raceWithAbort(operation, signal);
  }

  /** Stops the currently active pi run. The adapter reports it through the existing error event. */
  public cancel(sessionId: string): void {
    this.#requireSession(sessionId).agent.abort();
  }

  public async waitForIdle(sessionId: string): Promise<void> {
    await this.#requireSession(sessionId).agent.waitForIdle();
  }

  public disposeSession(
    sessionId: string,
    reason: unknown = abortError("Agent session disposed"),
  ): void {
    const session = this.#sessions.get(sessionId);
    if (session == undefined) {
      return;
    }
    session.agent.abort();
    session.controller.abort(reason);
    session.unsubscribeAgent();
    session.removeParentAbortListener?.();
    session.catalogNotifications.clear();
    session.subscribers.clear();
    session.waitingCatalogRequestIds.clear();
    this.#sessions.delete(sessionId);
  }

  public dispose(): void {
    for (const sessionId of [...this.#sessions.keys()]) {
      this.disposeSession(sessionId);
    }
  }

  #buildTurnContext(sessionId: string): TurnContext {
    let customization = EMPTY_CUSTOMIZATION;
    try {
      customization = this.#getPromptCustomization?.() ?? EMPTY_CUSTOMIZATION;
    } catch {
      // Corrupt customization degrades to the built-in prompt and skills.
    }
    const skills = resolveSkills(customization);
    const tools = this.#buildTools(sessionId, skills);

    if (this.#getSystemPrompt != undefined) {
      return { staticPrompt: this.#getSystemPrompt(), tools };
    }

    let memories: string | undefined;
    try {
      const entries = this.#memoryStore?.list() ?? [];
      memories = entries.length > 0 ? renderAgentMemories(entries) : undefined;
    } catch {
      memories = undefined;
    }
    let workspace: string | undefined;
    try {
      workspace = this.#getWorkspaceContext?.();
    } catch {
      workspace = undefined;
    }
    let panels: readonly PanelInventoryEntry[] | undefined;
    try {
      panels = this.#getPanelInventory?.();
    } catch {
      panels = undefined;
    }
    let timezone: string | undefined;
    try {
      timezone = this.#getTimezone();
    } catch {
      timezone = undefined;
    }
    const now = this.#now();
    const staticPrompt = buildStaticSystemPrompt({
      instructions: customization.instructions,
      memories,
      skills,
    });
    const dynamicContent = buildDynamicContext({
      now: now.toISOString(),
      panels,
      timezone,
      workspace,
    });
    return {
      staticPrompt,
      tools,
      ...(dynamicContent.length === 0
        ? {}
        : {
            dynamicContext: {
              role: "user",
              content: [{ type: "text", text: dynamicContent }],
              timestamp: now.getTime(),
            },
          }),
    };
  }

  #buildTools(sessionId: string, skills: readonly Skill[]): AgentTool[] {
    if (this.#toolRuntime == undefined) {
      return [];
    }
    const deps: ToolRuntimeDeps = {
      ...this.#toolRuntime.deps,
      skills,
      getInstalledPanelTypes: () =>
        new Set(this.#getPanelInventory?.().map((panel) => panel.type) ?? []),
      emitLayoutProposal: async (proposal, signal) => {
        throwIfAborted(signal);
        const session = this.#requireSession(sessionId);
        const active = this.#requireActiveRequest(session);
        this.#emit(session, {
          type: "layout-proposal",
          messageId: active.messageId,
          proposal: {
            ...proposal,
            // Baseline captured when the proposal is generated (over the validate+sanitize
            // pipeline output): the apply path uses it to detect layout changes since and
            // apply strictly incremental proposals in place.
            ...collectLayoutBaseline(
              this.#getCurrentLayout,
              this.#getCurrentLayoutId,
              this.#toolRuntime?.deps.getCatalog,
            ),
          },
          requestId: active.requestId,
        });
      },
      emitOpenDataSource: async (request, signal) => {
        throwIfAborted(signal);
        const session = this.#requireSession(sessionId);
        const active = this.#requireActiveRequest(session);
        active.openedDataSource = true;
        session.waitingCatalogRequestIds.add(active.requestId);
        this.#emit(session, {
          type: "open-data-source",
          messageId: active.messageId,
          requestId: active.requestId,
          urls: request.urls,
        });
      },
    };
    return buildPiTools(
      deps,
      skills.map((skill) => skill.id),
    );
  }

  async #beforeToolCall(
    sessionId: string,
    context: BeforeToolCallContext,
    signal?: AbortSignal,
  ): Promise<{ block: true; reason: string } | undefined> {
    throwIfAborted(signal);
    const active = this.#requireActiveRequest(this.#requireSession(sessionId));
    if (active.openedDataSource) {
      return {
        block: true,
        reason: "Skipped because the agent is waiting for the new data catalog",
      };
    }
    if (
      requestsOpenDataSource(context) &&
      (context.toolCall.name === "get_data_catalog" || context.toolCall.name === "propose_layout")
    ) {
      return {
        block: true,
        reason: `${context.toolCall.name} cannot run in the same tool batch as open_data_source; wait for catalog-ready`,
      };
    }
    return undefined;
  }

  async #afterToolCall(
    sessionId: string,
    context: AfterToolCallContext,
    signal?: AbortSignal,
  ): Promise<{ terminate: true } | undefined> {
    throwIfAborted(signal);
    this.#requireActiveRequest(this.#requireSession(sessionId));
    return requestsOpenDataSource(context) ? { terminate: true } : undefined;
  }

  async #continueWithCatalog(session: SessionState, requestId: string): Promise<void> {
    const getCatalog = this.#toolRuntime?.deps.getCatalog;
    if (getCatalog == undefined) {
      return;
    }
    const catalog = getCatalog();
    const normalized = boundedToolResult({
      topics: catalog.topics,
      datatypes: Object.fromEntries(catalog.datatypes),
    });
    await this.sendMessage(
      session.id,
      `The Lichtblick data catalog is ready for request ${requestId}: ${JSON.stringify(normalized)}`,
      this.#makeId(),
      session.controller.signal,
    );
    session.waitingCatalogRequestIds.delete(requestId);
  }

  #emit(session: SessionState, event: UnsequencedAgentEvent): void {
    const sequenced: AgentEvent = { ...event, seq: session.nextSeq++ };
    session.events.push(sequenced);
    if (session.events.length > PI_AGENT_EVENT_REPLAY_LIMIT) {
      session.events.shift();
    }
    for (const subscriber of session.subscribers) {
      try {
        subscriber(sequenced);
      } catch {
        // A view callback must not turn a successful model run into an Agent runtime failure.
      }
    }
  }

  #handlePiEvent(session: SessionState, event: PiAgentEvent): void {
    const active = session.active;
    if (active == undefined) {
      return;
    }
    for (const adapted of active.adapter.adapt(event)) {
      this.#emit(session, adapted);
    }
  }

  #requireActiveRequest(session: SessionState): ActiveRequest {
    if (session.active == undefined) {
      throw new Error(`Pi Agent session "${session.id}" has no active request`);
    }
    return session.active;
  }

  #requireSession(sessionId: string): SessionState {
    const session = this.#sessions.get(sessionId);
    if (session == undefined) {
      throw new Error(`Unknown Agent session: ${sessionId}`);
    }
    return session;
  }
}

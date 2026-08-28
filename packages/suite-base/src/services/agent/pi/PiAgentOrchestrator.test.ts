// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { AgentMessage, StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type Usage,
} from "@earendil-works/pi-ai";

import type { AgentConfiguration } from "@lichtblick/suite-base/services/agent/agentSettings";
import { collectLayoutBaseline } from "@lichtblick/suite-base/services/agent/layoutDiff";
import { SKILL_IDS } from "@lichtblick/suite-base/services/agent/local/skills";
import { LOCAL_AGENT_TOOL_DEFINITIONS } from "@lichtblick/suite-base/services/agent/local/toolDefinitions";
import type { AgentMemoryStore } from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import type { AgentPromptCustomization } from "@lichtblick/suite-base/services/agent/prompts/agentPrompts";
import type { AgentEvent } from "@lichtblick/suite-base/services/agent/types";

import {
  PiAgentOrchestrator,
  type PiAgentOrchestratorOptions,
  type PiAgentToolRuntime,
} from "./PiAgentOrchestrator";

const ZERO_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function configuration(): AgentConfiguration {
  return {
    apiKey: "not-used-by-mocked-stream",
    baseUrl: "",
    desktop: false,
    model: "claude-opus-4-8",
    provider: "anthropic",
  };
}

function assistant(
  model: Model<Api>,
  content: string,
  stopReason: AssistantMessage["stopReason"] = "stop",
  errorMessage?: string,
): AssistantMessage {
  return {
    role: "assistant",
    content: content.length === 0 ? [] : [{ type: "text", text: content }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: ZERO_USAGE,
    stopReason,
    errorMessage,
    timestamp: Date.now(),
  };
}

function successfulStream(chunks: readonly string[]): StreamFn {
  return (model) => {
    const stream = createAssistantMessageEventStream();
    const empty = assistant(model, "", "pending");
    stream.push({ type: "start", partial: empty });
    stream.push({
      type: "text_start",
      contentIndex: 0,
      partial: { ...empty, content: [{ type: "text", text: "" }] },
    });
    let text = "";
    for (const chunk of chunks) {
      text += chunk;
      stream.push({
        type: "text_delta",
        contentIndex: 0,
        delta: chunk,
        partial: assistant(model, text, "pending"),
      });
    }
    stream.push({
      type: "text_end",
      contentIndex: 0,
      content: text,
      partial: assistant(model, text, "pending"),
    });
    stream.push({ type: "done", reason: "stop", message: assistant(model, text) });
    return stream;
  };
}

function toolCallStream(id: string, name: string, args: Record<string, unknown>): StreamFn {
  return toolCallsStream([{ id, name, arguments: args }]);
}

function toolCallsStream(
  calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
): StreamFn {
  return (model) => {
    const stream = createAssistantMessageEventStream();
    const empty = assistant(model, "", "pending");
    const toolCalls = calls.map((call) => ({ type: "toolCall" as const, ...call }));
    const partial: AssistantMessage = { ...empty, content: toolCalls };
    stream.push({ type: "start", partial: empty });
    for (const [contentIndex, toolCall] of toolCalls.entries()) {
      stream.push({ type: "toolcall_start", contentIndex, partial: empty });
      stream.push({ type: "toolcall_end", contentIndex, toolCall, partial });
    }
    stream.push({
      type: "done",
      reason: "toolUse",
      message: { ...partial, stopReason: "toolUse" },
    });
    return stream;
  };
}

function makeToolRuntime(overrides: Partial<PiAgentToolRuntime> = {}): PiAgentToolRuntime {
  return {
    deps: {
      getCatalog: jest.fn().mockReturnValue({ topics: [], datatypes: new Map() }),
    },
    ...overrides,
  };
}

function makeIds(): () => string {
  let next = 0;
  return () => `pi-id-${++next}`;
}

async function setup(
  streamFn: StreamFn,
  options: Partial<PiAgentOrchestratorOptions> = {},
): Promise<{
  abortSubscription: () => void;
  client: PiAgentOrchestrator;
  events: AgentEvent[];
  sessionId: string;
  subscription: Promise<unknown>;
}> {
  const client = new PiAgentOrchestrator({
    configuration: configuration(),
    getSystemPrompt: () => "test system prompt",
    makeId: makeIds(),
    streamFn,
    ...options,
  });
  const { sessionId } = await client.createSession();
  const events: AgentEvent[] = [];
  const controller = new AbortController();
  const subscription = client.subscribeEvents(
    sessionId,
    (event) => {
      events.push(event);
    },
    controller.signal,
  );
  return {
    abortSubscription: () => {
      controller.abort();
    },
    client,
    events,
    sessionId,
    subscription,
  };
}

async function stopSubscription(
  abortSubscription: () => void,
  subscription: Promise<unknown>,
): Promise<void> {
  abortSubscription();
  await expect(subscription).rejects.toMatchObject({ name: "AbortError" });
}

describe("PiAgentOrchestrator", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("adapts a normal pi response and preserves text token order", async () => {
    const harness = await setup(successfulStream(["Hello", " ", "world"]));

    await harness.client.sendMessage(harness.sessionId, "hi", "request-1");

    expect(harness.events.map((event) => event.type)).toEqual([
      "message-start",
      "token",
      "token",
      "token",
      "message-end",
      "done",
    ]);
    expect(
      harness.events
        .filter((event): event is Extract<AgentEvent, { type: "token" }> => event.type === "token")
        .map((event) => event.delta),
    ).toEqual(["Hello", " ", "world"]);
    expect(harness.events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(harness.events.every((event) => event.requestId === "request-1")).toBe(true);

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("runs a catalog tool loop, publishes tool updates, and follows up with the result", async () => {
    const contexts: Context[] = [];
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      const next =
        call++ === 0
          ? toolCallStream("catalog-1", "get_data_catalog", {})
          : successfulStream(["Catalog inspected."]);
      return await next(model, context, options);
    };
    const toolRuntime = makeToolRuntime({
      deps: {
        getCatalog: jest.fn().mockReturnValue({
          topics: [{ name: "/speed", schemaName: "std_msgs/msg/Float64" }],
          datatypes: new Map([["std_msgs/msg/Float64", { definitions: [] }]]),
        }),
      },
    });
    const getCatalogSpy = jest.spyOn(toolRuntime.deps, "getCatalog");
    const harness = await setup(streamFn, { toolRuntime });

    await harness.client.sendMessage(harness.sessionId, "inspect the catalog", "request-catalog");

    expect(getCatalogSpy).toHaveBeenCalled();
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.messages.some((message) => message.role === "toolResult")).toBe(true);
    const observedToolStatuses = harness.events.flatMap((event) =>
      event.type === "tool-update" ? [event.toolRun.status] : [],
    );
    expect(observedToolStatuses).toEqual(
      expect.arrayContaining(["queued", "running", "succeeded"]),
    );
    expect(harness.events.some((event) => event.type === "token")).toBe(true);
    expect(harness.events.at(-1)?.type).toBe("done");

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("converges every turn's tools with SKILL_IDS and produces layout proposal events", async () => {
    const contexts: Context[] = [];
    let call = 0;
    const proposal = {
      name: "Registry layout",
      summary: "Built from the converged registry",
      data: {
        configById: { "Plot!speed": { paths: [{ value: "/speed" }] } },
        layout: "Plot!speed",
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    const customization: AgentPromptCustomization = {
      instructions: "",
      skillOverrides: {},
      customSkills: [
        {
          id: "team-conventions",
          name: "Team conventions",
          whenToUse: "When naming layouts.",
          body: "Prefix layouts with the squad name.",
        },
      ],
    };
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      const next =
        call++ === 0
          ? toolCallsStream([
              {
                id: "skill-convergence",
                name: "load_skill",
                arguments: { skillId: "team-conventions" },
              },
              {
                id: "layout-convergence",
                name: "propose_layout",
                arguments: proposal,
              },
            ])
          : successfulStream(["ok"]);
      return await next(model, context, options);
    };
    const harness = await setup(streamFn, {
      getPromptCustomization: () => customization,
      getSystemPrompt: undefined,
      toolRuntime: makeToolRuntime({
        deps: {
          getCatalog: jest.fn().mockReturnValue({
            topics: [{ name: "/speed", schemaName: "std_msgs/msg/Float64" }],
            datatypes: new Map([["std_msgs/msg/Float64", { definitions: [] }]]),
          }),
        },
      }),
    });

    await harness.client.sendMessage(
      harness.sessionId,
      "load the skill and propose a layout",
      "request-convergence",
    );

    // The turn's tool set is exactly the contracted allowlist (load_skill included).
    const turnTools = contexts[0]?.tools;
    expect(turnTools).toBeDefined();
    expect(turnTools?.map((tool) => tool.name).sort()).toEqual(
      LOCAL_AGENT_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
    );
    // The load_skill enum converges with SKILL_IDS plus the effective custom skill.
    const loadSkill = turnTools?.find((tool) => tool.name === "load_skill");
    expect(loadSkill).toBeDefined();
    const enumValue = (loadSkill?.parameters as { properties: { skillId: { enum: string[] } } })
      .properties.skillId.enum;
    expect(enumValue.slice().sort()).toEqual([...SKILL_IDS, "team-conventions"].sort());
    // load_skill and propose_layout both executed, and the proposal event carried the right shape.
    expect(JSON.stringify(contexts[1]?.messages)).toContain("Prefix layouts with the squad name.");
    expect(
      harness.events.some(
        (event) =>
          event.type === "layout-proposal" &&
          event.proposal.name === "Registry layout" &&
          event.requestId === "request-convergence",
      ),
    ).toBe(true);

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("bridges open-data-source and layout proposal events through catalog-ready continuation", async () => {
    const contexts: Context[] = [];
    let call = 0;
    const proposal = {
      name: "Speed layout",
      summary: "Show speed",
      data: {
        configById: { "Plot!speed": { paths: [{ value: "/speed" }] } },
        layout: "Plot!speed",
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      const next = [
        toolCallStream("open-1", "open_data_source", {
          urls: ["https://data.example/record-1.mcap"],
        }),
        toolCallStream("layout-1", "propose_layout", proposal),
        successfulStream(["The layout is ready."]),
      ][call++];
      if (next == undefined) {
        throw new Error("Unexpected extra pi provider round");
      }
      return await next(model, context, options);
    };
    const toolRuntime = makeToolRuntime({
      deps: {
        getCatalog: jest.fn().mockReturnValue({
          topics: [{ name: "/speed", schemaName: "std_msgs/msg/Float64" }],
          datatypes: new Map([["std_msgs/msg/Float64", { definitions: [] }]]),
        }),
      },
    });
    const harness = await setup(streamFn, { toolRuntime });

    await harness.client.sendMessage(harness.sessionId, "load record", "request-open");

    expect(call).toBe(1);
    expect(harness.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "open-data-source",
          requestId: "request-open",
          urls: ["https://data.example/record-1.mcap"],
        }),
      ]),
    );

    await harness.client.notifyCatalogReady(harness.sessionId, "request-open");

    expect(call).toBe(3);
    expect(JSON.stringify(contexts[1]?.messages)).toContain(
      "The Lichtblick data catalog is ready for request request-open",
    );
    expect(harness.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "layout-proposal",
          proposal: expect.objectContaining({ name: "Speed layout" }),
        }),
      ]),
    );
    await harness.client.notifyCatalogReady(harness.sessionId, "request-open");
    expect(call).toBe(3);

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("attaches the layout baseline to emitted layout proposals when a layout is selected", async () => {
    const proposal = {
      name: "Speed layout",
      data: {
        configById: { "Plot!speed": { paths: [{ value: "/speed" }] } },
        layout: "Plot!speed",
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };
    const currentLayoutData = {
      configById: { "Image!camera": { imageMode: { imageTopic: "/camera" } } },
      layout: "Image!camera",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      const next = [
        toolCallStream("layout-1", "propose_layout", proposal),
        successfulStream(["The layout is ready."]),
      ][call++];
      if (next == undefined) {
        throw new Error("Unexpected extra pi provider round");
      }
      return await next(model, context, options);
    };
    const harness = await setup(streamFn, {
      getCurrentLayout: () => currentLayoutData,
      getCurrentLayoutId: () => "layout-1",
      toolRuntime: makeToolRuntime({
        deps: {
          getCatalog: jest.fn().mockReturnValue({
            topics: [],
            datatypes: new Map(),
          }),
        },
      }),
    });

    await harness.client.sendMessage(harness.sessionId, "add panels", "request-baseline");

    const layoutEvent = harness.events.find((event) => event.type === "layout-proposal");
    expect(layoutEvent).toBeDefined();
    expect(layoutEvent).toEqual(
      expect.objectContaining({
        type: "layout-proposal",
        proposal: expect.objectContaining({
          baseLayoutId: "layout-1",
          baseFingerprint: collectLayoutBaseline(
            () => currentLayoutData,
            () => "layout-1",
            () => ({ topics: [], datatypes: new Map() }),
          ).baseFingerprint,
        }),
      }),
    );

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("omits the baseline when no layout is selected at proposal time", async () => {
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      const next = [
        toolCallStream("layout-1", "propose_layout", {
          name: "Fresh layout",
          data: {
            configById: {},
            globalVariables: {},
            playbackConfig: { speed: 1 },
            userNodes: {},
          },
        }),
        successfulStream(["Done."]),
      ][call++];
      if (next == undefined) {
        throw new Error("Unexpected extra pi provider round");
      }
      return await next(model, context, options);
    };
    const harness = await setup(streamFn, {
      getCurrentLayout: () => undefined,
      getCurrentLayoutId: () => undefined,
      toolRuntime: makeToolRuntime({
        deps: {
          getCatalog: jest.fn().mockReturnValue({
            topics: [],
            datatypes: new Map(),
          }),
        },
      }),
    });

    await harness.client.sendMessage(harness.sessionId, "create layout", "request-no-baseline");

    const layoutEvent = harness.events.find((event) => event.type === "layout-proposal");
    expect(layoutEvent).toEqual(
      expect.objectContaining({
        proposal: expect.not.objectContaining({ baseLayoutId: expect.anything() }),
      }),
    );

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("maps a pi stream error to the existing terminal error event", async () => {
    const streamFn: StreamFn = (model) => {
      const stream = createAssistantMessageEventStream();
      const failure = assistant(model, "", "error", "provider exploded");
      stream.push({ type: "error", reason: "error", error: failure });
      return stream;
    };
    const harness = await setup(streamFn);

    await expect(
      harness.client.sendMessage(harness.sessionId, "hi", "request-error"),
    ).rejects.toThrow("provider exploded");

    expect(harness.events.map((event) => event.type)).toEqual([
      "message-start",
      "message-end",
      "error",
    ]);
    expect(harness.events.at(-1)).toMatchObject({
      error: "provider exploded",
      requestId: "request-error",
      type: "error",
    });

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("keeps the session usable after a provider error", async () => {
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      if (call++ > 0) {
        return await successfulStream(["recovered"])(model, context, options);
      }
      const stream = createAssistantMessageEventStream();
      const failure = assistant(model, "", "error", "temporary provider failure");
      stream.push({ type: "error", reason: "error", error: failure });
      return stream;
    };
    const harness = await setup(streamFn);

    await expect(
      harness.client.sendMessage(harness.sessionId, "first", "request-failed"),
    ).rejects.toThrow("temporary provider failure");
    await expect(
      harness.client.sendMessage(harness.sessionId, "second", "request-recovered"),
    ).resolves.toBeUndefined();

    expect(
      harness.events.some(
        (event) => event.type === "token" && event.requestId === "request-recovered",
      ),
    ).toBe(true);
    expect(harness.events.at(-1)).toMatchObject({
      requestId: "request-recovered",
      type: "done",
    });

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("propagates caller abort to Agent.stop and reports the cancelled request", async () => {
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    let piSignal: AbortSignal | undefined;
    const streamFn: StreamFn = (model, _context, options) => {
      const stream = createAssistantMessageEventStream();
      const partial = assistant(model, "", "pending");
      stream.push({ type: "start", partial });
      piSignal = options?.signal;
      const finishAbort = () => {
        const failure = assistant(model, "", "aborted", "request cancelled by user");
        stream.push({ type: "error", reason: "aborted", error: failure });
      };
      if (options?.signal?.aborted === true) {
        finishAbort();
      } else {
        options?.signal?.addEventListener("abort", finishAbort, { once: true });
      }
      resolveStarted();
      return stream;
    };
    const harness = await setup(streamFn);
    const controller = new AbortController();

    const send = harness.client.sendMessage(
      harness.sessionId,
      "please stop",
      "request-abort",
      controller.signal,
    );
    await started;
    controller.abort();
    await expect(send).rejects.toMatchObject({ name: "AbortError" });
    await harness.client.waitForIdle(harness.sessionId);

    expect(piSignal?.aborted).toBe(true);
    expect(harness.events.map((event) => event.type)).toEqual([
      "message-start",
      "message-end",
      "error",
    ]);
    expect(harness.events.at(-1)).toMatchObject({
      error: "request cancelled by user",
      requestId: "request-abort",
      type: "error",
    });

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("retains the pi transcript and refreshes the system prompt across consecutive turns", async () => {
    const contexts: Array<{ messages: Context["messages"]; systemPrompt?: string }> = [];
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push({
        messages: context.messages.map((message) => ({ ...message })),
        systemPrompt: context.systemPrompt,
      });
      return await successfulStream([call++ === 0 ? "first answer" : "second answer"])(
        model,
        context,
        options,
      );
    };
    let promptRevision = 0;
    const client = new PiAgentOrchestrator({
      configuration: configuration(),
      getSystemPrompt: () => `system-${++promptRevision}`,
      makeId: makeIds(),
      streamFn,
    });
    const { sessionId } = await client.createSession();

    await client.sendMessage(sessionId, "first question", "request-1");
    await client.sendMessage(sessionId, "second question", "request-2");

    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.systemPrompt)).toEqual(["system-2", "system-3"]);
    expect(contexts[1]?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(contexts[1]?.messages[0]).toMatchObject({
      content: [{ text: "first question", type: "text" }],
      role: "user",
    });
    expect(contexts[1]?.messages[1]).toMatchObject({
      content: [{ text: "first answer", type: "text" }],
      role: "assistant",
    });
    expect(contexts[1]?.messages[2]).toMatchObject({
      content: [{ text: "second question", type: "text" }],
      role: "user",
    });

    client.dispose();
  });

  it("injects local prompt content before dynamic workspace and clock context", async () => {
    const contexts: Context[] = [];
    const onHistoryChanged = jest.fn();
    const memoryStore = {
      list: () => [
        {
          id: "memory-1",
          text: "Prefers concise summaries",
          createdAt: "2026-08-04T00:00:00.000Z",
        },
      ],
      add: jest.fn(),
      remove: jest.fn(),
    } satisfies AgentMemoryStore;
    const local: AgentPromptCustomization = {
      customSkills: [],
      instructions: "Answer in Chinese.",
      skillOverrides: {},
    };
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      return await successfulStream(["done"])(model, context, options);
    };
    const client = new PiAgentOrchestrator({
      configuration: configuration(),
      getPromptCustomization: () => local,
      getPanelInventory: () => [
        {
          type: "Acme.Camera",
          title: "Camera",
          description: "Shows camera images.",
          source: "extension",
          schemas: ["sensor_msgs/Image"],
        },
      ],
      getTimezone: () => "Asia/Shanghai",
      getWorkspaceContext: () => "Loaded data source with 3 topics.",
      makeId: makeIds(),
      memoryStore,
      now: () => new Date("2026-08-04T09:30:00.000Z"),
      onHistoryChanged,
      streamFn,
    });
    const { sessionId } = await client.createSession();

    await client.sendMessage(sessionId, "inspect the data", "request-prompt");

    const context = contexts[0]!;
    expect(context.systemPrompt).toContain("Answer in Chinese.");
    expect(context.systemPrompt).toContain("Prefers concise summaries");
    expect(context.systemPrompt).not.toContain("Loaded data source with 3 topics.");
    expect(context.systemPrompt).not.toContain("Current time:");
    expect(context.messages.map((message) => message.role)).toEqual(["user", "user"]);
    const dynamicContext = context.messages[0];
    expect(dynamicContext).toMatchObject({
      role: "user",
      content: [
        {
          type: "text",
          text: expect.stringContaining("Loaded data source with 3 topics."),
        },
      ],
    });
    const dynamicText =
      dynamicContext?.role === "user" && Array.isArray(dynamicContext.content)
        ? dynamicContext.content[0]?.type === "text"
          ? dynamicContext.content[0].text
          : ""
        : "";
    expect(dynamicText.endsWith("local: 2026-08-04 17:30)")).toBe(true);
    expect(dynamicText).toContain(
      "- Acme.Camera: Shows camera images. (schemas: sensor_msgs/Image)",
    );
    expect(context.messages[1]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "inspect the data" }],
    });
    expect(onHistoryChanged).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: [{ type: "text", text: "inspect the data" }],
        }),
      ]),
    );
    expect(onHistoryChanged.mock.calls[0]?.[0]).toHaveLength(2);

    client.dispose();
  });

  it("refreshes the runtime panel inventory for every turn", async () => {
    const contexts: Context[] = [];
    let panelDescription = "Initial panel description.";
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      return await successfulStream(["done"])(model, context, options);
    };
    const client = new PiAgentOrchestrator({
      configuration: configuration(),
      getPanelInventory: () => [
        {
          type: "Acme.LivePanel",
          title: "Live panel",
          description: panelDescription,
          source: "extension",
        },
      ],
      makeId: makeIds(),
      streamFn,
    });
    const { sessionId } = await client.createSession();

    await client.sendMessage(sessionId, "first", "request-first");
    panelDescription = "Updated after installation.";
    await client.sendMessage(sessionId, "second", "request-second");

    const dynamicText = (context: Context | undefined) => {
      const message = context?.messages[0];
      return message?.role === "user" && Array.isArray(message.content)
        ? message.content[0]?.type === "text"
          ? message.content[0].text
          : ""
        : "";
    };
    expect(dynamicText(contexts[0])).toContain("Initial panel description.");
    expect(dynamicText(contexts[1])).toContain("Updated after installation.");
    expect(dynamicText(contexts[1])).not.toContain("Initial panel description.");

    client.dispose();
  });

  it("applies instructions, custom skills, and built-in skill overrides to a tool turn", async () => {
    const contexts: Context[] = [];
    let call = 0;
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      return await (call++ === 0
        ? toolCallsStream([
            {
              id: "skill-custom",
              name: "load_skill",
              arguments: { skillId: "team-conventions" },
            },
            {
              id: "skill-override",
              name: "load_skill",
              arguments: { skillId: "data-query" },
            },
          ])
        : successfulStream(["ok"]))(model, context, options);
    };
    const customization: AgentPromptCustomization = {
      instructions: "Always answer in Chinese.",
      skillOverrides: { "data-query": "my replacement body" },
      customSkills: [
        {
          id: "team-conventions",
          name: "Team conventions",
          whenToUse: "When naming layouts.",
          body: "Prefix layouts with the squad name.",
        },
      ],
    };
    const harness = await setup(streamFn, {
      getPromptCustomization: () => customization,
      getSystemPrompt: undefined,
      toolRuntime: makeToolRuntime(),
    });

    await harness.client.sendMessage(harness.sessionId, "hello", "request-customization");

    expect(contexts[0]?.systemPrompt).toContain("Always answer in Chinese.");
    expect(contexts[0]?.systemPrompt).toContain("- team-conventions: When naming layouts.");
    const loadSkill = contexts[0]?.tools?.find((tool) => tool.name === "load_skill");
    expect(
      (loadSkill?.parameters as { properties: { skillId: { enum: string[] } } }).properties.skillId
        .enum,
    ).toContain("team-conventions");
    expect(JSON.stringify(contexts[1]?.messages)).toContain("Prefix layouts with the squad name.");
    expect(JSON.stringify(contexts[1]?.messages)).toContain("my replacement body");

    await stopSubscription(harness.abortSubscription, harness.subscription);
    harness.client.dispose();
  });

  it("rebuilds pi tools from the effective skills for every turn", async () => {
    const contexts: Context[] = [];
    let revision = 0;
    const skillIds = ["initial-skill", "turn-one-skill", "turn-two-skill"];
    const getPromptCustomization = (): AgentPromptCustomization => ({
      customSkills: [
        {
          id: skillIds[Math.min(revision++, skillIds.length - 1)]!,
          name: "Turn skill",
          whenToUse: "During this turn",
          body: "# Turn skill",
        },
      ],
      instructions: "",
      skillOverrides: {},
    });
    const toolRuntime: PiAgentToolRuntime = {
      deps: {
        getCatalog: jest.fn().mockReturnValue({ topics: [], datatypes: new Map() }),
      },
    };
    const streamFn: StreamFn = async (model, context, options) => {
      contexts.push(context);
      return await successfulStream(["done"])(model, context, options);
    };
    const client = new PiAgentOrchestrator({
      configuration: configuration(),
      getPromptCustomization,
      getSystemPrompt: () => "stable test prompt",
      makeId: makeIds(),
      streamFn,
      toolRuntime,
    });
    const { sessionId } = await client.createSession();

    await client.sendMessage(sessionId, "first", "request-tools-1");
    await client.sendMessage(sessionId, "second", "request-tools-2");

    const loadSkillEnums = contexts.map((context) => {
      const loadSkill = context.tools?.find((tool) => tool.name === "load_skill");
      return (loadSkill?.parameters as { properties?: { skillId?: { enum?: string[] } } })
        .properties?.skillId?.enum;
    });
    expect(loadSkillEnums[0]).toContain("turn-one-skill");
    expect(loadSkillEnums[0]).not.toContain("initial-skill");
    expect(loadSkillEnums[1]).toContain("turn-two-skill");
    expect(loadSkillEnums[1]).not.toContain("turn-one-skill");

    client.dispose();
  });

  it("restores pi messages into a new session and persists the resumed transcript", async () => {
    let savedHistory: readonly AgentMessage[] = [];
    const first = new PiAgentOrchestrator({
      configuration: configuration(),
      getSystemPrompt: () => "history test prompt",
      makeId: makeIds(),
      onHistoryChanged: (history) => {
        savedHistory = history.map((message) => ({ ...message }));
      },
      streamFn: successfulStream(["first answer"]),
    });
    const firstSession = await first.createSession();
    await first.sendMessage(firstSession.sessionId, "first question", "request-history-1");
    const restored = savedHistory.map((message) => ({ ...message }));
    first.dispose();

    const contexts: Context[] = [];
    const second = new PiAgentOrchestrator({
      configuration: configuration(),
      getSystemPrompt: () => "history test prompt",
      makeId: makeIds(),
      onHistoryChanged: (history) => {
        savedHistory = history.map((message) => ({ ...message }));
      },
      restoreHistory: async () => restored,
      streamFn: async (model, context, options) => {
        contexts.push(context);
        return await successfulStream(["second answer"])(model, context, options);
      },
    });
    const secondSession = await second.createSession();
    await second.sendMessage(secondSession.sessionId, "second question", "request-history-2");

    expect(contexts[0]?.messages.slice(0, restored.length)).toEqual(restored);
    expect(contexts[0]?.messages.at(-1)).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "second question" }],
    });
    expect(savedHistory.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);

    second.dispose();
  });
});

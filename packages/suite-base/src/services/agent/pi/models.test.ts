// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import type { AgentConfiguration } from "@lichtblick/suite-base/services/agent/agentSettings";

import { createPiModelRuntime } from "./models";

function configuration(overrides: Partial<AgentConfiguration> = {}): AgentConfiguration {
  return {
    apiKey: "browser-only-secret",
    baseUrl: "",
    desktop: false,
    model: "claude-opus-4-8",
    provider: "anthropic",
    ...overrides,
  };
}

describe("createPiModelRuntime", () => {
  it("selects only the Anthropic provider and applies the configured model and base URL", () => {
    const runtime = createPiModelRuntime(
      configuration({
        baseUrl: " https://anthropic-proxy.example.test ",
        model: " claude-opus-4-8 ",
      }),
    );

    expect(runtime.models.getProviders().map((provider) => provider.id)).toEqual(["anthropic"]);
    expect(runtime.model).toMatchObject({
      api: "anthropic-messages",
      baseUrl: "https://anthropic-proxy.example.test",
      id: "claude-opus-4-8",
      provider: "anthropic",
    });
    expect(runtime.model).not.toHaveProperty("apiKey");

    const streamSimple = jest
      .spyOn(runtime.models, "streamSimple")
      .mockReturnValue(createAssistantMessageEventStream());
    void runtime.streamFn(runtime.model, { messages: [] });
    expect(streamSimple).toHaveBeenCalledWith(
      runtime.model,
      { messages: [] },
      { apiKey: "browser-only-secret" },
    );
  });

  it("assembles one OpenAI-compatible provider from the configured model and base URL", () => {
    const runtime = createPiModelRuntime(
      configuration({
        baseUrl: " https://llm.example.test/v1 ",
        model: " custom-chat-model ",
        provider: "openai-compatible",
      }),
    );

    expect(runtime.models.getProviders().map((provider) => provider.id)).toEqual([
      "openai-compatible",
    ]);
    expect(runtime.model).toMatchObject({
      api: "openai-completions",
      baseUrl: "https://llm.example.test/v1",
      id: "custom-chat-model",
      provider: "openai-compatible",
    });
    expect(runtime.model).not.toHaveProperty("apiKey");
  });
});

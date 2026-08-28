// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
  createModels,
  createProvider,
  type Api,
  type Model,
  type Models,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

import type { AgentConfiguration } from "@lichtblick/suite-base/services/agent/agentSettings";

const OPENAI_COMPATIBLE_PROVIDER_ID = "openai-compatible";

export type PiModelRuntime = {
  model: Model<Api>;
  models: Models;
  streamFn: StreamFn;
};

function createOpenAICompatibleModel(
  configuration: AgentConfiguration,
): Model<"openai-completions"> {
  return {
    id: configuration.model.trim(),
    name: configuration.model.trim(),
    api: "openai-completions",
    provider: OPENAI_COMPATIBLE_PROVIDER_ID,
    baseUrl: configuration.baseUrl.trim(),
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_768,
  };
}

function createAnthropicModel(configuration: AgentConfiguration): Model<"anthropic-messages"> {
  const provider = anthropicProvider();
  const modelId = configuration.model.trim();
  const template = provider.getModels().find((candidate) => candidate.id === modelId);
  const fallback = template ?? provider.getModels()[0];
  if (fallback == undefined) {
    throw new Error("The pi Anthropic provider did not expose a model catalog");
  }

  return {
    ...fallback,
    id: modelId,
    name: template?.name ?? modelId,
    baseUrl: configuration.baseUrl.trim() || fallback.baseUrl,
  };
}

/**
 * Creates the deliberately small browser runtime: one selected provider and no provider bundle.
 * The API key is captured only by the per-request stream function. It is never installed in pi's
 * credential store or added to a model/provider object.
 *
 * pi-ai 0.83.0's Anthropic adapter defaults to short prompt caching and marks the complete system
 * prompt block, the last user content block, and the last immediate tool definition as ephemeral.
 * Since buildSystemPrompt returns one changing string, its static prefix has no independent cache
 * breakpoint when dynamic suffixes change. Follow-up T19 should split static and dynamic system
 * context before provider serialization if Lichtblick needs stable static-prefix cache reuse.
 */
export function createPiModelRuntime(configuration: AgentConfiguration): PiModelRuntime {
  const models = createModels();
  let model: Model<Api>;

  if (configuration.provider === "anthropic") {
    models.setProvider(anthropicProvider());
    model = createAnthropicModel(configuration);
  } else {
    const openAIModel = createOpenAICompatibleModel(configuration);
    models.setProvider(
      createProvider({
        id: OPENAI_COMPATIBLE_PROVIDER_ID,
        name: "OpenAI-compatible",
        baseUrl: openAIModel.baseUrl,
        auth: {
          apiKey: {
            name: "OpenAI-compatible API key",
            resolve: async ({ credential }) =>
              credential?.key == undefined
                ? undefined
                : { auth: { apiKey: credential.key }, source: "request credential" },
          },
        },
        models: [openAIModel],
        api: openAICompletionsApi(),
      }),
    );
    model = openAIModel;
  }

  const streamFn: StreamFn = (selectedModel, context, options) =>
    models.streamSimple(selectedModel, context, {
      ...options,
      // Browser credentials are supplied explicitly for this request and never persisted by pi.
      apiKey: configuration.apiKey,
    });

  return { model, models, streamFn };
}

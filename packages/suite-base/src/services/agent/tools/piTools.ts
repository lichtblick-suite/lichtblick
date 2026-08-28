// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@earendil-works/pi-agent-core";

import { buildToolDefinitions } from "@lichtblick/suite-base/services/agent/local/toolDefinitions";
import type { ToolRunStatus } from "@lichtblick/suite-base/services/agent/types";

import { serializeToolValue, summarizeToolValue } from "./eventMapping";
import { executeToolRuntime, type ToolRuntimeDeps } from "./toolRuntime";

export type PiToolResultDetails = {
  status: ToolRunStatus;
  progress?: number;
  summary?: string;
  result?: unknown;
  error?: string;
};

function resultText(result: unknown): string {
  return typeof result === "string" ? result : serializeToolValue(result);
}

function buildResult(
  result: unknown,
  details: PiToolResultDetails,
): AgentToolResult<PiToolResultDetails> {
  return {
    content: [{ type: "text", text: resultText(result) }],
    details,
  };
}

function update(
  onUpdate: AgentToolUpdateCallback<PiToolResultDetails> | undefined,
  message: string,
  details: PiToolResultDetails,
): void {
  onUpdate?.({ content: [{ type: "text", text: message }], details });
}

export function buildPiTools(
  deps: ToolRuntimeDeps,
  enabledSkillIds: readonly string[],
): AgentTool[] {
  const enabledSkillIdSet = new Set(enabledSkillIds);
  const runtimeDeps: ToolRuntimeDeps = {
    ...deps,
    skills: deps.skills.filter((skill) => enabledSkillIdSet.has(skill.id)),
  };

  return buildToolDefinitions(enabledSkillIds).map((definition): AgentTool => {
    const execute: AgentTool["execute"] = async (_toolCallId, params, signal, onUpdate) => {
      signal?.throwIfAborted();

      update(onUpdate, `Running ${definition.name}`, {
        status: "running",
        progress: 0,
      });
      const result = await executeToolRuntime(definition.name, params, runtimeDeps, {
        signal,
      });
      const summary = summarizeToolValue(result);
      const details: PiToolResultDetails = {
        status: "succeeded",
        progress: 1,
        summary,
        result,
      };
      const finalResult = buildResult(result, details);
      update(onUpdate, resultText(result), details);
      return finalResult;
    };

    return {
      name: definition.name,
      label: definition.name,
      description: definition.description,
      parameters: definition.inputSchema,
      execute,
    };
  });
}

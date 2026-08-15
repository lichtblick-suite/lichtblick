// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@earendil-works/pi-agent-core";

import { buildToolDefinitions } from "@lichtblick/suite-base/services/agent/local/toolDefinitions";
import type {
  ToolConfirmationDecision,
  ToolRunStatus,
} from "@lichtblick/suite-base/services/agent/types";

import { serializeToolValue, summarizeToolValue } from "./eventMapping";
import { executeToolRuntime, type ToolRuntimeDeps } from "./toolRuntime";

export const PI_TOOL_CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000;

export type ToolConfirmationRequest = {
  toolName: string;
  input: unknown;
  summary: string;
};

export type PiToolResultDetails = {
  status: ToolRunStatus;
  progress?: number;
  summary?: string;
  result?: unknown;
  error?: string;
};

export type BuildPiToolsOptions = {
  isConfirmationRequired?: (request: ToolConfirmationRequest) => boolean;
  requestConfirmation: (
    toolCallId: string,
    request: ToolConfirmationRequest,
    signal?: AbortSignal,
  ) => Promise<ToolConfirmationDecision>;
  confirmationTimeoutMs?: number;
};

export class ToolConfirmationTimeoutError extends Error {
  public constructor() {
    super("Tool confirmation timed out");
    this.name = "LocalAgentConfirmationTimeoutError";
  }
}

/**
 * Tool names whose execution requires explicit user confirmation before any side effect runs.
 *
 * The agent-only build has no confirmable tool: the VTD slice store and its dedicated batch
 * authorization tool were the only side-effecting tools and were removed with the VTD pipeline.
 * The confirmation flow (awaiting-confirmation updates, waitForConfirmation, and the
 * orchestrator's confirmToolRun contract) is retained so a future side-effecting tool only needs
 * its name added here.
 */
const CONFIRMABLE_TOOL_NAMES: ReadonlySet<string> = new Set();

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted", "AbortError");
}

async function waitForConfirmation(
  toolCallId: string,
  request: ToolConfirmationRequest,
  options: BuildPiToolsOptions,
  signal?: AbortSignal,
): Promise<ToolConfirmationDecision> {
  signal?.throwIfAborted();
  const confirmationController = new AbortController();
  const abortConfirmation = () => {
    if (signal != undefined) {
      confirmationController.abort(abortReason(signal));
    }
  };
  signal?.addEventListener("abort", abortConfirmation, { once: true });
  const confirmation = Promise.resolve().then(
    async () =>
      await options.requestConfirmation(toolCallId, request, confirmationController.signal),
  );
  const timeoutMs = options.confirmationTimeoutMs ?? PI_TOOL_CONFIRMATION_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener: (() => void) | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new ToolConfirmationTimeoutError();
      confirmationController.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const abortPromise = new Promise<never>((_resolve, reject) => {
    if (signal == undefined) {
      return;
    }
    const rejectOnAbort = () => {
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", rejectOnAbort, { once: true });
    if (signal.aborted) {
      rejectOnAbort();
    }
    removeAbortListener = () => {
      signal.removeEventListener("abort", rejectOnAbort);
    };
  });
  try {
    return await Promise.race([confirmation, timeoutPromise, abortPromise]);
  } finally {
    clearTimeout(timeout);
    removeAbortListener?.();
    signal?.removeEventListener("abort", abortConfirmation);
  }
}

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
  options: BuildPiToolsOptions,
): AgentTool[] {
  const enabledSkillIdSet = new Set(enabledSkillIds);
  const runtimeDeps: ToolRuntimeDeps = {
    ...deps,
    skills: deps.skills.filter((skill) => enabledSkillIdSet.has(skill.id)),
  };

  return buildToolDefinitions(enabledSkillIds).map((definition): AgentTool => {
    const execute: AgentTool["execute"] = async (
      toolCallId,
      params,
      signal,
      onUpdate,
    ) => {
      signal?.throwIfAborted();

      if (CONFIRMABLE_TOOL_NAMES.has(definition.name)) {
        const confirmationRequest: ToolConfirmationRequest = {
          toolName: definition.name,
          input: params,
          summary: "Waiting for user confirmation",
        };
        if (options.isConfirmationRequired?.(confirmationRequest) !== false) {
          update(onUpdate, confirmationRequest.summary, {
            status: "awaiting-confirmation",
            summary: confirmationRequest.summary,
          });
        }
        const confirmationDecision = await waitForConfirmation(
          toolCallId,
          confirmationRequest,
          options,
          signal,
        );
        if (!confirmationDecision.approved) {
          const cancelled = {
            cancelled: true,
            reason: "User declined the operation",
          };
          return buildResult(cancelled, {
            status: "cancelled",
            summary: "Cancelled by user",
            result: cancelled,
          });
        }
      }

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

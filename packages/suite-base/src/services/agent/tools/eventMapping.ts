// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { AgentEvent as PiAgentEvent } from "@earendil-works/pi-agent-core";

import type {
  ToolRun,
  ToolRunStatus,
} from "@lichtblick/suite-base/services/agent/types";

type PiToolExecutionEvent = Extract<
  PiAgentEvent,
  {
    type:
      "tool_execution_start" | "tool_execution_update" | "tool_execution_end";
  }
>;

const TOOL_RUN_STATUSES = new Set<ToolRunStatus>([
  "queued",
  "running",
  "awaiting-confirmation",
  "succeeded",
  "failed",
  "cancelled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value != undefined && !Array.isArray(value)
  );
}

export function serializeToolValue(value: unknown): string {
  const seen = new WeakSet<object>();
  return (
    JSON.stringify(value, (_key, entry: unknown) => {
      if (typeof entry === "bigint") {
        return entry.toString();
      }
      if (entry instanceof Map) {
        return Object.fromEntries(entry);
      }
      if (typeof entry === "object" && entry != undefined) {
        if (seen.has(entry)) {
          return "[Circular]";
        }
        seen.add(entry);
      }
      return entry;
    }) ?? String(value)
  );
}

/** Matches the local orchestrator's existing 240-character tool summary bound. */
export function summarizeToolValue(value: unknown): string {
  const serialized =
    typeof value === "string" ? value : serializeToolValue(value);
  return serialized.length > 240
    ? `${serialized.slice(0, 237)}...`
    : serialized;
}

function extractText(result: unknown): string | undefined {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return undefined;
  }
  const text = result.content
    .filter(
      (entry): entry is { type: "text"; text: string } =>
        isRecord(entry) &&
        entry.type === "text" &&
        typeof entry.text === "string",
    )
    .map((entry) => entry.text)
    .join("\n");
  return text.length > 0 ? text : undefined;
}

function extractDetails(result: unknown): Record<string, unknown> | undefined {
  if (!isRecord(result) || !isRecord(result.details)) {
    return undefined;
  }
  return result.details;
}

function detailStatus(
  details: Record<string, unknown> | undefined,
): ToolRunStatus | undefined {
  const status = details?.status;
  return typeof status === "string" &&
    TOOL_RUN_STATUSES.has(status as ToolRunStatus)
    ? (status as ToolRunStatus)
    : undefined;
}

function detailProgress(
  details: Record<string, unknown> | undefined,
): number | undefined {
  const progress = details?.progress;
  return typeof progress === "number" && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : undefined;
}

function detailSummary(
  details: Record<string, unknown> | undefined,
): string | undefined {
  return typeof details?.summary === "string" ? details.summary : undefined;
}

/** Converts pi-agent-core tool lifecycle events into the ToolRun shape used by `tool-update`. */
export function mapPiToolExecutionEvent(event: PiToolExecutionEvent): ToolRun {
  const base: Pick<ToolRun, "id" | "name"> = {
    id: event.toolCallId,
    name: event.toolName,
  };

  switch (event.type) {
    case "tool_execution_start":
      return { ...base, status: "queued" };
    case "tool_execution_update": {
      const details = extractDetails(event.partialResult);
      const status = detailStatus(details) ?? "running";
      const result = details?.result;
      return {
        ...base,
        status,
        progress: detailProgress(details),
        summary:
          detailSummary(details) ??
          (typeof result !== "undefined"
            ? summarizeToolValue(result)
            : undefined),
        result: status === "cancelled" ? result : undefined,
        error: typeof details?.error === "string" ? details.error : undefined,
      };
    }
    case "tool_execution_end": {
      const details = extractDetails(event.result);
      const status = detailStatus(details);
      if (status === "cancelled") {
        return {
          ...base,
          status,
          summary: detailSummary(details) ?? "Cancelled by user",
          result: details?.result,
        };
      }
      if (event.isError || status === "failed") {
        return {
          ...base,
          status: "failed",
          error:
            (typeof details?.error === "string" ? details.error : undefined) ??
            extractText(event.result) ??
            "Tool execution failed",
        };
      }
      const result = Object.hasOwn(details ?? {}, "result")
        ? details?.result
        : details;
      return {
        ...base,
        status: "succeeded",
        progress: 1,
        summary: detailSummary(details) ?? summarizeToolValue(result),
        result,
      };
    }
  }
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SKILL_IDS } from "./skills";
import type { LlmToolDef } from "./types";

const nonEmptyString = { type: "string", minLength: 1 } as const;
const decimalNanoseconds = {
  type: "string",
  pattern: "^[0-9]+$",
  description:
    "Decimal nanoseconds encoded as a string to avoid precision loss.",
} as const;

/**
 * Tool definitions for a turn.
 *
 * The load_skill enum has to reflect the skills actually available, which depends on the user's
 * custom skills, so this is a function rather than a constant.
 */
export function buildToolDefinitions(
  skillIds: readonly string[] = SKILL_IDS,
): LlmToolDef[] {
  return LOCAL_AGENT_TOOL_DEFINITIONS.map((tool) =>
    tool.name === "load_skill"
      ? {
          ...tool,
          inputSchema: {
            ...tool.inputSchema,
            properties: { skillId: { type: "string", enum: [...skillIds] } },
          },
        }
      : tool,
  );
}

export const LOCAL_AGENT_TOOL_DEFINITIONS: LlmToolDef[] = [
  {
    name: "load_skill",
    description:
      "Load the full text of a reference document listed in the skill index. Read-only and cheap; " +
      "prefer loading the relevant skill over guessing parameters or panel capabilities.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skillId"],
      properties: { skillId: { type: "string", enum: [...SKILL_IDS] } },
    },
  },
  {
    name: "memory_write",
    description:
      "Remember one durable fact about this user across sessions, such as a robot they usually " +
      "review, a preferred panel combination, or a term they use. Do not store one-off context " +
      "from the current task, anything the user asked you not to keep, or credentials.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
  {
    name: "memory_forget",
    description:
      "Delete one stored memory by id. Use this when a memory is wrong or outdated, when the user " +
      "asks you to forget something, or to free space when memory is full.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: nonEmptyString },
    },
  },
  {
    name: "memory_list",
    description:
      "List stored memories with their ids. Memories are already included in your context, so " +
      "this is only needed to confirm an id before forgetting one.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "open_data_source",
    description:
      "Ask Lichtblick to open one or more MCAP URLs. Pass multiple URLs in one call to load " +
      "them together. Catalog loading completes asynchronously.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["urls"],
      properties: {
        urls: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1, format: "uri" },
        },
        sessionId: nonEmptyString,
      },
    },
  },
  {
    name: "get_data_catalog",
    description:
      "Read the topics and datatypes currently loaded in the Lichtblick workspace.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "propose_layout",
    description:
      "Propose an Agent-safe Lichtblick layout for the loaded catalog. The user chooses whether to apply it.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "data"],
      properties: {
        name: nonEmptyString,
        summary: { type: "string" },
        data: {
          type: "object",
          description:
            "AgentSafeLayoutData. Mosaic leaves are <panel-type>!<suffix> and exactly match configById.",
        },
      },
    },
  },
  {
    name: "read_messages",
    description:
      "Read the latest loaded messages of one topic (optionally bounded by time), in receive order. " +
      "Only iterable recordings support this; live sources error out. Times are decimal nanoseconds.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["topic"],
      properties: {
        topic: nonEmptyString,
        start: decimalNanoseconds,
        end: decimalNanoseconds,
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "search_messages",
    description:
      "Search the loaded messages of one topic for a text substring and/or a log level (at least one " +
      "required; both are AND). Log hits are matched on the normalized message and level; other " +
      "schemas on the serialized payload. Hits report receiveTimeNs for seeking.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["topic"],
      // At least one of text or level is required; both act as AND when given.
      anyOf: [{ required: ["text"] }, { required: ["level"] }],
      properties: {
        topic: nonEmptyString,
        text: nonEmptyString,
        level: {
          type: "string",
          enum: ["debug", "info", "warn", "error", "fatal", "unknown"],
        },
        start: decimalNanoseconds,
        end: decimalNanoseconds,
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: "playback_control",
    description:
      "Control playback of the loaded data source: seek to a time (decimal nanoseconds; clamped to " +
      "the loaded range and the accepted target is returned), play, or pause.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["seek", "play", "pause"] },
        time: decimalNanoseconds,
      },
    },
  },
];

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import type { IAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";

/**
 * One durable fact the agent chose to keep across sessions.
 *
 * Memories are user-visible and user-deletable from the Agent settings tab. They are not secrets:
 * they live in ordinary app configuration, not the credential store.
 */
export type MemoryEntry = {
  id: string;
  text: string;
  createdAt: string;
};

/**
 * Bounds exist so a model that decides to remember everything cannot grow the system prompt
 * without limit. Writes past the limit fail loudly so the agent can choose what to forget, rather
 * than silently evicting something the user may have asked it to keep.
 */
export const AGENT_MEMORY_MAX_ENTRIES = 50;
export const AGENT_MEMORY_MAX_ENTRY_LENGTH = 500;
export const AGENT_MEMORY_MAX_TOTAL_BYTES = 32 * 1024;

export class AgentMemoryLimitError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentMemoryLimitError";
  }
}

function isEntry(value: unknown): value is MemoryEntry {
  if (typeof value !== "object" || value == undefined) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.text === "string" &&
    candidate.text.length > 0 &&
    typeof candidate.createdAt === "string"
  );
}

/**
 * Reads the stored memories. Corrupt or partially-corrupt storage degrades to whatever entries are
 * still readable instead of throwing: losing memories must never break a conversation.
 */
export function readAgentMemories(configuration: IAppConfiguration): MemoryEntry[] {
  const raw = configuration.get(AppSetting.AGENT_MEMORY);
  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

async function writeAgentMemories(
  configuration: IAppConfiguration,
  entries: MemoryEntry[],
): Promise<void> {
  await configuration.set(
    AppSetting.AGENT_MEMORY,
    entries.length === 0 ? undefined : JSON.stringify(entries),
  );
}

/**
 * Appends a memory. `makeId` is injected so callers control id generation; the orchestrator passes
 * a uuid factory and tests pass a deterministic counter.
 */
export async function addAgentMemory(
  configuration: IAppConfiguration,
  text: string,
  { makeId, now }: { makeId: () => string; now: () => Date },
): Promise<MemoryEntry> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new AgentMemoryLimitError("A memory must not be empty");
  }
  if (trimmed.length > AGENT_MEMORY_MAX_ENTRY_LENGTH) {
    throw new AgentMemoryLimitError(
      `A memory must be at most ${String(AGENT_MEMORY_MAX_ENTRY_LENGTH)} characters`,
    );
  }

  const entries = readAgentMemories(configuration);
  if (entries.some((entry) => entry.text === trimmed)) {
    throw new AgentMemoryLimitError("That memory is already stored");
  }
  if (entries.length >= AGENT_MEMORY_MAX_ENTRIES) {
    throw new AgentMemoryLimitError(
      `Memory is full at ${String(AGENT_MEMORY_MAX_ENTRIES)} entries; forget one first`,
    );
  }

  const entry: MemoryEntry = {
    id: makeId(),
    text: trimmed,
    createdAt: now().toISOString(),
  };
  const next = [...entries, entry];
  if (new TextEncoder().encode(JSON.stringify(next) ?? "").byteLength > AGENT_MEMORY_MAX_TOTAL_BYTES) {
    throw new AgentMemoryLimitError("Memory is full; forget an entry first");
  }
  await writeAgentMemories(configuration, next);
  return entry;
}

/** Removes one memory. Returns false when the id was not present. */
export async function removeAgentMemory(
  configuration: IAppConfiguration,
  id: string,
): Promise<boolean> {
  const entries = readAgentMemories(configuration);
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) {
    return false;
  }
  await writeAgentMemories(configuration, next);
  return true;
}

export async function clearAgentMemories(configuration: IAppConfiguration): Promise<void> {
  await writeAgentMemories(configuration, []);
}

/**
 * The orchestrator's view of memory. Narrow on purpose: the orchestrator is a plain service and
 * should not know about IAppConfiguration or how memories are persisted.
 */
export type AgentMemoryStore = {
  list: () => MemoryEntry[];
  add: (text: string) => Promise<MemoryEntry>;
  remove: (id: string) => Promise<boolean>;
};

export function createAgentMemoryStore(
  configuration: IAppConfiguration,
  { makeId, now = () => new Date() }: { makeId: () => string; now?: () => Date },
): AgentMemoryStore {
  return {
    list: () => readAgentMemories(configuration),
    add: async (text) => await addAgentMemory(configuration, text, { makeId, now }),
    remove: async (id) => await removeAgentMemory(configuration, id),
  };
}

/** Renders memories for the system prompt. Empty string when there is nothing to inject. */
export function renderAgentMemories(entries: readonly MemoryEntry[]): string {
  return entries.map((entry) => `- [${entry.id}] ${entry.text}`).join("\n");
}

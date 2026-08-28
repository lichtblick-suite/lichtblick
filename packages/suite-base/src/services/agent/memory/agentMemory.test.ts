// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

import {
  AGENT_MEMORY_MAX_ENTRIES,
  AGENT_MEMORY_MAX_ENTRY_LENGTH,
  AgentMemoryLimitError,
  addAgentMemory,
  clearAgentMemories,
  createAgentMemoryStore,
  readAgentMemories,
  removeAgentMemory,
  renderAgentMemories,
} from "./agentMemory";

function makeIdFactory(): () => string {
  let next = 0;
  return () => `m${String(++next)}`;
}

const options = () => ({ makeId: makeIdFactory(), now: () => new Date("2026-07-28T00:00:00Z") });

describe("agent memory", () => {
  it("round-trips entries through app configuration", async () => {
    const configuration = makeMockAppConfiguration();
    const entry = await addAgentMemory(configuration, "Usually reviews SN001", options());

    expect(entry).toMatchObject({ id: "m1", text: "Usually reviews SN001" });
    expect(readAgentMemories(configuration)).toEqual([entry]);
    expect(typeof configuration.get(AppSetting.AGENT_MEMORY)).toBe("string");
  });

  it("trims input and rejects empty or oversized memories", async () => {
    const configuration = makeMockAppConfiguration();

    await expect(addAgentMemory(configuration, "   ", options())).rejects.toThrow(
      AgentMemoryLimitError,
    );
    await expect(
      addAgentMemory(configuration, "x".repeat(AGENT_MEMORY_MAX_ENTRY_LENGTH + 1), options()),
    ).rejects.toThrow(/at most/);

    const entry = await addAgentMemory(configuration, "  padded  ", options());
    expect(entry.text).toBe("padded");
  });

  it("rejects duplicates so repeated turns cannot fill memory with one fact", async () => {
    const configuration = makeMockAppConfiguration();
    const shared = options();
    await addAgentMemory(configuration, "Prefers 3D plus Plot", shared);

    await expect(addAgentMemory(configuration, "Prefers 3D plus Plot", shared)).rejects.toThrow(
      /already stored/,
    );
    expect(readAgentMemories(configuration)).toHaveLength(1);
  });

  it("refuses to write past the entry limit instead of silently evicting", async () => {
    const configuration = makeMockAppConfiguration();
    const shared = options();
    for (let index = 0; index < AGENT_MEMORY_MAX_ENTRIES; index++) {
      await addAgentMemory(configuration, `fact ${String(index)}`, shared);
    }

    await expect(addAgentMemory(configuration, "one more", shared)).rejects.toThrow(/full/);
    expect(readAgentMemories(configuration)).toHaveLength(AGENT_MEMORY_MAX_ENTRIES);
  });

  it("reports whether a removal matched and clears the key when empty", async () => {
    const configuration = makeMockAppConfiguration();
    const entry = await addAgentMemory(configuration, "Calls it the big robot", options());

    await expect(removeAgentMemory(configuration, "missing")).resolves.toBe(false);
    await expect(removeAgentMemory(configuration, entry.id)).resolves.toBe(true);
    expect(readAgentMemories(configuration)).toEqual([]);
    expect(configuration.get(AppSetting.AGENT_MEMORY)).toBeUndefined();
  });

  it("survives corrupt storage rather than breaking the conversation", () => {
    expect(readAgentMemories(makeMockAppConfiguration([[AppSetting.AGENT_MEMORY, "{"]]))).toEqual(
      [],
    );
    expect(
      readAgentMemories(makeMockAppConfiguration([[AppSetting.AGENT_MEMORY, '{"a":1}']])),
    ).toEqual([]);
    // A partially corrupt array keeps the entries that are still well-formed.
    const mixed = JSON.stringify([
      { id: "m1", text: "kept", createdAt: "2026-07-28T00:00:00Z" },
      { id: "m2" },
      "garbage",
    ]);
    expect(
      readAgentMemories(makeMockAppConfiguration([[AppSetting.AGENT_MEMORY, mixed]])),
    ).toHaveLength(1);
  });

  it("renders entries with ids so the agent can forget a specific one", () => {
    expect(
      renderAgentMemories([{ id: "m1", text: "Reviews SN001", createdAt: "2026-07-28T00:00:00Z" }]),
    ).toBe("- [m1] Reviews SN001");
    expect(renderAgentMemories([])).toBe("");
  });

  it("clears every entry", async () => {
    const configuration = makeMockAppConfiguration();
    const shared = options();
    await addAgentMemory(configuration, "a", shared);
    await addAgentMemory(configuration, "b", shared);

    await clearAgentMemories(configuration);
    expect(readAgentMemories(configuration)).toEqual([]);
  });

  it("exposes the same behavior through the injected store facade", async () => {
    const configuration = makeMockAppConfiguration();
    const store = createAgentMemoryStore(configuration, { makeId: makeIdFactory() });

    const entry = await store.add("Uses the term 'run' for a recording");
    expect(store.list()).toEqual([entry]);
    await expect(store.remove(entry.id)).resolves.toBe(true);
    expect(store.list()).toEqual([]);
  });
});

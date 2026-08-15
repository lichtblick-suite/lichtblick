// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { buildToolDefinitions } from "@lichtblick/suite-base/services/agent/local/toolDefinitions";

import { buildPiTools } from "./piTools";
import type { ToolRuntimeDeps } from "./toolRuntime";

function makeDeps() {
  return {
    skills: [
      { id: "enabled", name: "Enabled", whenToUse: "test", body: "# Enabled" },
      {
        id: "disabled",
        name: "Disabled",
        whenToUse: "test",
        body: "# Disabled",
      },
    ],
    memoryStore: {
      list: jest.fn().mockReturnValue([]),
      add: jest.fn(),
      remove: jest.fn(),
    },
    getCatalog: jest.fn().mockReturnValue({ topics: [], datatypes: new Map() }),
    getInstalledPanelTypes: jest.fn().mockReturnValue(new Set<string>()),
    emitOpenDataSource: jest.fn(),
    emitLayoutProposal: jest.fn(),
  } satisfies ToolRuntimeDeps;
}

describe("buildPiTools", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("passes through every existing tool schema and restricts load_skill to enabled ids", async () => {
    const tools = buildPiTools(makeDeps(), ["enabled"], {
      requestConfirmation: jest.fn(),
    });
    const definitions = buildToolDefinitions(["enabled"]);

    expect(tools.map((tool) => tool.name)).toEqual(
      definitions.map((definition) => definition.name),
    );
    for (const definition of definitions) {
      const tool = tools.find(
        (candidate) => candidate.name === definition.name,
      );
      expect(tool?.description).toBe(definition.description);
      expect(tool?.parameters).toEqual(definition.inputSchema);
    }

    const loadSkill = tools.find((tool) => tool.name === "load_skill")!;
    await expect(
      loadSkill.execute("load-1", { skillId: "enabled" }),
    ).resolves.toMatchObject({
      content: [
        { type: "text", text: '<skill id="enabled">\n# Enabled\n</skill>' },
      ],
    });
    await expect(
      loadSkill.execute("load-2", { skillId: "disabled" }),
    ).rejects.toThrow("load_skill.skillId must be one of: enabled");
  });

  it("maps running and completed progress through onUpdate", async () => {
    const tool = buildPiTools(makeDeps(), ["enabled"], {
      requestConfirmation: jest.fn(),
    }).find((candidate) => candidate.name === "memory_list")!;
    const onUpdate = jest.fn();

    await tool.execute("list-call", {}, undefined, onUpdate);

    expect(onUpdate).toHaveBeenNthCalledWith(1, {
      content: [{ type: "text", text: "Running memory_list" }],
      details: { status: "running", progress: 0 },
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      content: [{ type: "text", text: '{"memories":[]}' }],
      details: {
        status: "succeeded",
        progress: 1,
        summary: '{"memories":[]}',
        result: { memories: [] },
      },
    });
  });
});

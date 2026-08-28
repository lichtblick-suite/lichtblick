// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  executeToolRuntime,
  runGetDataCatalogTool,
  runLoadSkillTool,
  runMemoryForgetTool,
  runMemoryListTool,
  runMemoryWriteTool,
  runOpenDataSourceTool,
  runProposeLayoutTool,
  TOOL_RUNTIME_MAX_RESULT_BYTES,
  type ToolRuntimeDeps,
} from "./toolRuntime";

function validLayoutData(): Record<string, unknown> {
  return {
    configById: { "Plot!speed": { paths: [{ value: "/speed" }] } },
    layout: "Plot!speed",
    globalVariables: {},
    playbackConfig: { speed: 1 },
    userNodes: {},
  };
}

function makeDeps() {
  return {
    skills: [
      {
        id: "test-skill",
        name: "Test",
        whenToUse: "For tests",
        body: "# Test skill",
      },
    ],
    memoryStore: {
      list: jest.fn().mockReturnValue([
        {
          id: "memory-1",
          text: "A fact",
          createdAt: "2026-08-04T00:00:00.000Z",
        },
      ]),
      add: jest.fn().mockResolvedValue({
        id: "memory-2",
        text: "Another fact",
        createdAt: "2026-08-04T00:00:00.000Z",
      }),
      remove: jest.fn().mockResolvedValue(true),
    },
    getCatalog: jest.fn().mockReturnValue({
      topics: [{ name: "/speed", schemaName: "std_msgs/msg/Float64" }],
      datatypes: new Map([["std_msgs/msg/Float64", { definitions: [] }]]),
    }),
    getInstalledPanelTypes: jest.fn().mockReturnValue(new Set<string>()),
    emitOpenDataSource: jest.fn(),
    emitLayoutProposal: jest.fn(),
  } satisfies ToolRuntimeDeps;
}

describe("toolRuntime", () => {
  it("loads an enabled skill and preserves the legacy invalid-id error", async () => {
    const deps = makeDeps();

    await expect(runLoadSkillTool({ skillId: "test-skill" }, deps)).resolves.toBe(
      '<skill id="test-skill">\n# Test skill\n</skill>',
    );
    await expect(runLoadSkillTool({ skillId: "missing" }, deps)).rejects.toThrow(
      "load_skill.skillId must be one of: test-skill",
    );
  });

  it("writes memory and reports unavailable memory with the legacy error", async () => {
    const deps = makeDeps();

    await expect(runMemoryWriteTool({ text: "Another fact" }, deps)).resolves.toEqual({
      remembered: "memory-2",
    });
    await expect(
      runMemoryWriteTool({ text: "Another fact" }, { ...deps, memoryStore: undefined }),
    ).rejects.toThrow("memory_write is unavailable: memory is not configured");
  });

  it("forgets memory and preserves the not-stored error", async () => {
    const deps = makeDeps();

    await expect(runMemoryForgetTool({ id: "memory-1" }, deps)).resolves.toEqual({
      forgotten: "memory-1",
    });
    jest.mocked(deps.memoryStore.remove).mockResolvedValueOnce(false);
    await expect(runMemoryForgetTool({ id: "missing" }, deps)).rejects.toThrow(
      'memory_forget.id "missing" is not a stored memory',
    );
  });

  it("lists memory and validates object input", async () => {
    const deps = makeDeps();

    await expect(runMemoryListTool({}, deps)).resolves.toEqual({
      memories: [
        {
          id: "memory-1",
          text: "A fact",
          createdAt: "2026-08-04T00:00:00.000Z",
        },
      ],
    });
    await expect(runMemoryListTool([], deps)).rejects.toThrow(
      "memory_list input must be an object",
    );
  });

  it("emits open-data requests and preserves strict MCAP URL validation", async () => {
    const deps = makeDeps();
    const input = {
      urls: ["https://data.example/record%2C1.mcap"],
    };

    await expect(runOpenDataSourceTool(input, deps)).resolves.toEqual({
      status: "opening",
      message: "打开中，等待目录就绪通知",
    });
    expect(deps.emitOpenDataSource).toHaveBeenCalledWith(input, undefined);
    await expect(
      runOpenDataSourceTool({ urls: ["http://data.example/record.mcap"] }, deps),
    ).rejects.toThrow(
      "open_data_source.urls must contain only HTTPS .mcap URLs without literal commas; encode commas as %2C",
    );
  });

  it("normalizes the active catalog and forwards catalog read failures", async () => {
    const deps = makeDeps();

    await expect(runGetDataCatalogTool({}, deps)).resolves.toEqual({
      topics: [{ name: "/speed", schemaName: "std_msgs/msg/Float64" }],
      datatypes: { "std_msgs/msg/Float64": { definitions: [] } },
    });
    jest.mocked(deps.getCatalog).mockImplementationOnce(() => {
      throw new Error("catalog unavailable");
    });
    await expect(runGetDataCatalogTool({}, deps)).rejects.toThrow("catalog unavailable");
  });

  it("validates and emits layout proposals and rejects unsafe layouts", async () => {
    const deps = makeDeps();
    const input = {
      name: "Speed",
      summary: "Show speed",
      data: validLayoutData(),
    };

    await expect(runProposeLayoutTool(input, deps)).resolves.toEqual({
      accepted: true,
      name: "Speed",
    });
    expect(deps.emitLayoutProposal).toHaveBeenCalledWith(input, undefined);
    await expect(
      runProposeLayoutTool(
        {
          name: "Unsafe",
          data: {
            ...validLayoutData(),
            configById: { "Publish!bad": {} },
            layout: "Publish!bad",
          },
        },
        deps,
      ),
    ).rejects.toThrow('uses unsupported panel type "Publish"');
  });

  it("passes the installed panel type snapshot into layout validation", async () => {
    const deps = makeDeps();
    const panelType = "Acme Extension.Custom Panel";
    const panelId = `${panelType}!main`;
    jest.mocked(deps.getInstalledPanelTypes).mockReturnValue(new Set([panelType]));
    const input = {
      name: "Installed extension",
      data: {
        configById: { [panelId]: { customSetting: true } },
        layout: panelId,
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };

    await expect(runProposeLayoutTool(input, deps)).resolves.toEqual({
      accepted: true,
      name: "Installed extension",
    });
    expect(deps.getInstalledPanelTypes).toHaveBeenCalledTimes(1);
    expect(deps.emitLayoutProposal).toHaveBeenCalledWith(input, undefined);
  });

  it("preserves aborts, unsupported-tool errors, and the result byte bound", async () => {
    const deps = makeDeps();
    const controller = new AbortController();
    controller.abort(new Error("cancelled by caller"));

    await expect(runGetDataCatalogTool({}, deps, { signal: controller.signal })).rejects.toThrow(
      "cancelled by caller",
    );
    expect(deps.getCatalog).not.toHaveBeenCalled();
    await expect(executeToolRuntime("unknown", {}, deps)).rejects.toThrow(
      'Unsupported local agent tool "unknown"',
    );

    jest.mocked(deps.getCatalog).mockReturnValueOnce({
      topics: ["x".repeat(TOOL_RUNTIME_MAX_RESULT_BYTES + 1)],
      datatypes: new Map(),
    });
    await expect(executeToolRuntime("get_data_catalog", {}, deps)).resolves.toMatchObject({
      truncated: true,
    });
  });
});

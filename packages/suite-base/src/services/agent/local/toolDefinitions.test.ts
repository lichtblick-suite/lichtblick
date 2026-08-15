// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LOCAL_AGENT_TOOL_DEFINITIONS } from "./toolDefinitions";

describe("LOCAL_AGENT_TOOL_DEFINITIONS", () => {
  it("exposes exactly the contracted tool allowlist with object schemas", () => {
    expect(LOCAL_AGENT_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "load_skill",
      "memory_write",
      "memory_forget",
      "memory_list",
      "open_data_source",
      "get_data_catalog",
      "propose_layout",
      "read_messages",
      "search_messages",
      "playback_control",
    ]);
    for (const tool of LOCAL_AGENT_TOOL_DEFINITIONS) {
      expect(tool.inputSchema).toEqual(
        expect.objectContaining({ type: "object" }),
      );
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("defines the data-query tool schemas with their limits and enums", () => {
    const byName = new Map(LOCAL_AGENT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

    const read = byName.get("read_messages")!;
    expect(read.inputSchema).toEqual(
      expect.objectContaining({
        required: ["topic"],
        properties: expect.objectContaining({
          topic: expect.any(Object),
          start: expect.any(Object),
          end: expect.any(Object),
          limit: expect.objectContaining({ maximum: 100 }),
        }),
      }),
    );

    const search = byName.get("search_messages")!;
    const searchProperties = (
      search.inputSchema as {
        properties: { level?: { enum?: string[] }; limit?: { maximum?: number } };
      }
    ).properties;
    expect(searchProperties.level?.enum).toEqual([
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "unknown",
    ]);
    expect(searchProperties.limit?.maximum).toBe(20);
    expect(search.description).toMatch(/at least one/);

    const playback = byName.get("playback_control")!;
    expect(playback.inputSchema).toEqual(
      expect.objectContaining({
        required: ["action"],
        properties: expect.objectContaining({
          action: expect.objectContaining({ enum: ["seek", "play", "pause"] }),
          time: expect.any(Object),
        }),
      }),
    );
  });

  it("documents loading multiple data-source URLs together in one call", () => {
    const openDataSource = LOCAL_AGENT_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "open_data_source",
    );
    expect(openDataSource?.description).toContain("multiple URLs in one call");
    expect(openDataSource?.description).toContain("load them together");
  });
});

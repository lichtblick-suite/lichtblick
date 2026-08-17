// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

import {
  AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES,
  AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES,
  AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH,
  AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES,
  AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH,
  AGENT_SAFE_LAYOUT_MAX_STRING_BYTES,
  type AgentSafeLayoutData,
  validateLayoutProposal,
  validateLayoutProposalData,
} from "./layoutSchema";

function validLayoutData(): Record<string, unknown> {
  return {
    configById: {
      "3D!scene": {},
      "Plot!speed": { paths: [] },
      "Image!camera": { imageMode: { imageTopic: "/camera" } },
    },
    layout: {
      direction: "row",
      splitPercentage: 60,
      first: "3D!scene",
      second: {
        direction: "column",
        first: "Plot!speed",
        second: "Image!camera",
      },
    },
    globalVariables: {},
    playbackConfig: { speed: 1 },
    userNodes: {},
  };
}

describe("layoutSchema", () => {
  it("exposes AgentSafeLayoutData as an opaque validated LayoutData subtype", () => {
    const unvalidated = validLayoutData() as LayoutData;
    const acceptsAgentSafeData = (_data: AgentSafeLayoutData): void => {};
    const validated = validateLayoutProposalData(unvalidated);

    // @ts-expect-error Plain LayoutData has not crossed the Agent-safe runtime validation boundary.
    acceptsAgentSafeData(unvalidated);
    acceptsAgentSafeData(validated);
    expect(validated).toBe(unvalidated);
  });

  it("exports the Agent-safe layout budgets for backend schema alignment", () => {
    expect({
      collectionEntries: AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES,
      configEntries: AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES,
      graphDepth: AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH,
      graphNodes: AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES,
      mosaicDepth: AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH,
      stringBytes: AGENT_SAFE_LAYOUT_MAX_STRING_BYTES,
    }).toEqual({
      collectionEntries: 4096,
      configEntries: 256,
      graphDepth: 64,
      graphNodes: 10_000,
      mosaicDepth: 64,
      stringBytes: 256 * 1024,
    });
  });

  it("accepts a valid LayoutProposal.data and preserves its object identity", () => {
    const data = validLayoutData();

    expect(validateLayoutProposalData(data)).toBe(data);
  });

  it("returns a proposal whose data is validated as AgentSafeLayoutData", () => {
    const proposal = { name: "Vehicle", summary: "Useful panels", data: validLayoutData() };

    expect(validateLayoutProposal(proposal)).toEqual(proposal);
  });

  it("accepts string baseLayoutId and baseFingerprint fields", () => {
    const proposal = {
      name: "Vehicle",
      baseLayoutId: "layout-1",
      baseFingerprint: "0a1b2c3d",
      data: validLayoutData(),
    };

    expect(validateLayoutProposal(proposal)).toEqual(proposal);
  });

  it.each<Record<string, unknown>>([
    { baseLayoutId: 42 },
    { baseLayoutId: {} },
    { baseLayoutId: null },
    { baseFingerprint: 42 },
    { baseFingerprint: ["abc"] },
    { baseFingerprint: null },
  ])("rejects a non-string baseline field %j", (badFields) => {
    expect(() =>
      validateLayoutProposal({
        name: "Vehicle",
        data: validLayoutData(),
        ...badFields,
      }),
    ).toThrow(/baseLayoutId|baseFingerprint must be a string/);
  });

  it("accepts an installed extension panel through the runtime allowlist", () => {
    const panelType = "Acme Extension.Custom Panel";
    const panelId = `${panelType}!main`;
    const proposal = {
      name: "Extension panel",
      data: {
        configById: { [panelId]: { customSetting: { enabled: true } } },
        layout: panelId,
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };

    expect(
      validateLayoutProposal(proposal, {
        installedPanelTypes: new Set([panelType]),
      }),
    ).toEqual(proposal);
  });

  it("rejects an extension panel absent from the runtime allowlist", () => {
    const panelType = "Acme Extension.Custom Panel";
    const panelId = `${panelType}!main`;
    const proposal = {
      name: "Uninstalled extension panel",
      data: {
        configById: { [panelId]: {} },
        layout: panelId,
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };

    expect(() =>
      validateLayoutProposal(proposal, {
        installedPanelTypes: new Set(["Other Extension.Other Panel"]),
      }),
    ).toThrow(`uses unsupported panel type "${panelType}"`);
  });

  it("preserves the static-only behavior when no runtime allowlist is provided", () => {
    const panelType = "Acme Extension.Custom Panel";
    const panelId = `${panelType}!main`;
    const proposal = {
      name: "No runtime inventory",
      data: {
        configById: { [panelId]: {} },
        layout: panelId,
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };

    expect(() => validateLayoutProposal(proposal)).toThrow(
      `uses unsupported panel type "${panelType}"`,
    );
  });

  it("keeps built-in per-panel validation when the runtime allowlist includes that type", () => {
    const proposal = {
      name: "Invalid Plot",
      data: {
        configById: { "Plot!speed": { paths: "not-an-array" } },
        layout: "Plot!speed",
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
    };

    expect(() =>
      validateLayoutProposal(proposal, {
        installedPanelTypes: new Set(["Plot"]),
      }),
    ).toThrow('configById["Plot!speed"].paths must be an array');
  });

  it("accepts an empty layout with no Mosaic tree", () => {
    const data = {
      configById: {},
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };

    expect(validateLayoutProposalData(data)).toBe(data);
  });

  it("rejects a panel type outside the allowlist", () => {
    const data = validLayoutData();
    data.configById = { "Publish!publisher": {} };
    data.layout = "Publish!publisher";

    expect(() => validateLayoutProposalData(data)).toThrow('uses unsupported panel type "Publish"');
  });

  it.each([
    "Plot",
    "Plot!",
    "!suffix",
    "Plot!one!two",
    "Plot! ",
  ])("rejects malformed panel id %s", (panelId) => {
    const data = validLayoutData();
    data.configById = { [panelId]: {} };
    data.layout = panelId;

    expect(() => validateLayoutProposalData(data)).toThrow('must match "<type>!<suffix>"');
  });

  it("rejects a Mosaic leaf without a configById entry", () => {
    const data = validLayoutData();
    data.layout = "Table!missing";

    expect(() => validateLayoutProposalData(data)).toThrow(
      'layout panel "Table!missing" is missing a configById entry',
    );
  });

  it("rejects orphan configById entries that are not present in the Mosaic tree", () => {
    const data = validLayoutData();
    (data.configById as Record<string, unknown>)["Gauge!orphan"] = {};

    expect(() => validateLayoutProposalData(data)).toThrow(
      'configById contains orphan panel config "Gauge!orphan"',
    );
  });

  it("rejects duplicate panel instance ids in the Mosaic tree", () => {
    const data = validLayoutData();
    data.configById = { "Plot!same": {} };
    data.layout = {
      direction: "row",
      first: "Plot!same",
      second: "Plot!same",
    };

    expect(() => validateLayoutProposalData(data)).toThrow(
      'duplicate panel id "Plot!same" in layout',
    );
  });

  it.each([
    [{ first: "Plot!speed", second: "Image!camera" }, 'direction must be "row" or "column"'],
    [
      { direction: "diagonal", first: "Plot!speed", second: "Image!camera" },
      'direction must be "row" or "column"',
    ],
    [{ direction: "row", first: "Plot!speed" }, "must contain both first and second"],
    [
      {
        direction: "row",
        first: "Plot!speed",
        second: "Image!camera",
        splitPercentage: 101,
      },
      "splitPercentage must be a number from 0 to 100",
    ],
  ])("rejects an invalid Mosaic branch", (layout, error) => {
    const data = validLayoutData();
    data.layout = layout;

    expect(() => validateLayoutProposalData(data)).toThrow(error);
  });

  it("rejects unknown fields on Mosaic branches", () => {
    const data = validLayoutData();
    (data.layout as Record<string, unknown>).extra = { hidden: true };

    expect(() => validateLayoutProposalData(data)).toThrow('layout contains unknown field "extra"');
  });

  it("rejects cyclic Mosaic objects", () => {
    const data = validLayoutData();
    const layout: Record<string, unknown> = {
      direction: "row",
      first: "Plot!speed",
    };
    layout.second = layout;
    data.layout = layout;

    expect(() => validateLayoutProposalData(data)).toThrow("contains a cyclic value");
  });

  it("rejects a Mosaic tree deeper than 64 branches without overflowing the call stack", () => {
    const configById: Record<string, unknown> = { "Plot!leaf": { paths: [] } };
    let layout: unknown = "Plot!leaf";
    for (let index = 0; index < 65; index++) {
      const panelId = `Plot!sibling-${index}`;
      configById[panelId] = { paths: [] };
      layout = {
        direction: "row",
        first: layout,
        second: panelId,
      };
    }
    const data = {
      configById,
      layout,
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };

    expect(() => validateLayoutProposalData(data)).toThrow("exceeds the maximum nesting depth");
  });

  it("rejects non-object panel configs", () => {
    const data = validLayoutData();
    data.configById = { "Gauge!speed": 42 };
    data.layout = "Gauge!speed";

    expect(() => validateLayoutProposalData(data)).toThrow(
      'configById["Gauge!speed"] must be an object',
    );
  });

  it("rejects structurally unsafe panel configuration fields", () => {
    const data = validLayoutData();
    data.configById = { "Plot!speed": { paths: {} } };
    data.layout = "Plot!speed";

    expect(() => validateLayoutProposalData(data)).toThrow(
      'configById["Plot!speed"].paths must be an array',
    );
  });

  it.each([
    ["Plot!speed", { paths: [null] }, "paths[0]"],
    ["StateTransitions!state", { paths: [{ label: "missing value" }] }, "paths[0]"],
    [
      "Indicator!status",
      {
        rules: [{ color: "red", label: "Bad", operator: "contains", rawValue: "1" }],
      },
      "rules[0]",
    ],
    ["Indicator!status", { rules: [null] }, "rules[0]"],
  ])("rejects invalid array elements for %s", (panelId, config, error) => {
    const data = validLayoutData();
    data.configById = { [panelId]: config };
    data.layout = panelId;

    expect(() => validateLayoutProposalData(data)).toThrow(error);
  });

  it("accepts structurally valid Indicator rule elements", () => {
    const data = validLayoutData();
    data.configById = {
      "Indicator!status": {
        rules: [{ color: "red", label: "Alert", operator: ">=", rawValue: "10" }],
      },
    };
    data.layout = "Indicator!status";

    expect(validateLayoutProposalData(data)).toBe(data);
  });

  it("accepts user script nodes shaped exactly as { name, sourceCode }", () => {
    const data = validLayoutData();
    data.userNodes = {
      "script-1": { name: "Speed km/h", sourceCode: "export const inputs = ['/speed'];" },
    };

    expect(validateLayoutProposalData(data)).toBe(data);
  });

  it.each([
    [
      "non-object node",
      { "script-1": "export const inputs = [];" },
      /userNodes\["script-1"\] must be an object/,
    ],
    [
      "missing sourceCode",
      { "script-1": { name: "Speed" } },
      /must contain exactly name and sourceCode/,
    ],
    [
      "extra field",
      { "script-1": { name: "Speed", sourceCode: "export const inputs = [];", enabled: true } },
      /must contain exactly name and sourceCode/,
    ],
    [
      "empty name",
      { "script-1": { name: "", sourceCode: "export const inputs = [];" } },
      /name and \.sourceCode must be non-empty strings/,
    ],
    [
      "empty sourceCode",
      { "script-1": { name: "Speed", sourceCode: "" } },
      /name and \.sourceCode must be non-empty strings/,
    ],
    [
      "non-string sourceCode",
      { "script-1": { name: "Speed", sourceCode: 42 } },
      /name and \.sourceCode must be non-empty strings/,
    ],
  ])("rejects a malformed user script node: %s", (_label, userNodes, expected) => {
    const data = validLayoutData();
    data.userNodes = userNodes;

    expect(() => validateLayoutProposalData(data)).toThrow(expected);
  });

  it("still runs the generic JSON budgets over user script nodes", () => {
    const data = validLayoutData();
    data.userNodes = {
      "script-1": { name: "x", sourceCode: "export const inputs = [];".repeat(20_000) },
    };

    expect(() => validateLayoutProposalData(data)).toThrow("exceeds the string size limit");
  });

  it("rejects cyclic values inside panel configurations", () => {
    const config: Record<string, unknown> = { paths: [] };
    config.self = config;
    const data = validLayoutData();
    data.configById = { "Plot!speed": config };
    data.layout = "Plot!speed";

    expect(() => validateLayoutProposalData(data)).toThrow("contains a cyclic value");
  });

  it("rejects more than 256 panel configurations", () => {
    const configById = Object.fromEntries(
      Array.from({ length: 257 }, (_, index) => [`Plot!panel-${index}`, { paths: [] }]),
    );
    const data = validLayoutData();
    data.configById = configById;
    data.layout = "Plot!panel-0";

    expect(() => validateLayoutProposalData(data)).toThrow("exceeds the 256 panel limit");
  });

  it("applies the string budget from the LayoutData root object", () => {
    const data = validLayoutData();
    data.extra = "x".repeat(AGENT_SAFE_LAYOUT_MAX_STRING_BYTES + 1);

    expect(() => validateLayoutProposalData(data)).toThrow("exceeds the string size limit");
  });

  it("rejects unknown top-level LayoutData fields", () => {
    const data = validLayoutData();
    data.extra = "unexpected";

    expect(() => validateLayoutProposalData(data)).toThrow(
      'LayoutProposal.data contains unknown field "extra"',
    );
  });

  it.each([
    [undefined, "LayoutProposal.data must be an object"],
    [
      {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: "fast" },
        userNodes: {},
      },
      "playbackConfig.speed must be a finite number",
    ],
    [
      {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
        version: Number.NaN,
      },
      "version must contain only JSON-compatible values",
    ],
    [
      {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
        version: null,
      },
      "version must be a finite number",
    ],
    [
      {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
        savedProps: null,
      },
      "savedProps must be an object",
    ],
  ])("rejects invalid LayoutData base fields", (data, error) => {
    expect(() => validateLayoutProposalData(data)).toThrow(error);
  });
});

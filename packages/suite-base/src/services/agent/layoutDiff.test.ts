// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import type { CatalogSnapshot } from "@lichtblick/suite-base/services/agent/local/types";

import {
  collectLayoutBaseline,
  computeProposalMode,
  planIncrementalApply,
  sanitizeLayoutData,
} from "./layoutDiff";

const emptyCatalog: CatalogSnapshot = { topics: [], datatypes: new Map() };

function catalogWithTopic(name: string, schemaName: string): CatalogSnapshot {
  return {
    topics: [{ name, schemaName }],
    datatypes: new Map([[schemaName, { definitions: [] }]]),
  };
}

function baseLayout(): LayoutData {
  return {
    configById: {
      "3D!scene": { topics: { "/points": { visible: true } } },
      "Image!front": { imageMode: { imageTopic: "/camera/front/image_raw" } },
    },
    layout: {
      direction: "row",
      first: "3D!scene",
      second: "Image!front",
      splitPercentage: 50,
    },
    globalVariables: {},
    playbackConfig: { speed: 1 },
    userNodes: {},
  };
}

function addGaugeTo(layout: LayoutData): LayoutData {
  return {
    ...layout,
    configById: {
      ...layout.configById,
      "Gauge!battery": { path: "/battery.percentage", minValue: 0, maxValue: 100 },
    },
    layout: {
      direction: "column",
      first: layout.layout!,
      second: "Gauge!battery",
      splitPercentage: 70,
    },
  };
}

/**
 * Public baseline oracle: captures the proposal-time fingerprint the same way the orchestrator
 * does (validate+sanitize, then fingerprint), through the exported collectLayoutBaseline entry.
 */
function fingerprintOf(data: LayoutData, catalog: CatalogSnapshot = emptyCatalog): string {
  const baseline = collectLayoutBaseline(
    () => data,
    () => "layout-1",
    () => catalog,
  );
  expect(baseline.baseFingerprint).toBeDefined();
  return baseline.baseFingerprint!;
}

function incrementalInput(overrides?: {
  baseLayout?: LayoutData;
  proposal?: LayoutData;
  baseLayoutId?: string;
  baseFingerprint?: string;
  currentLayoutId?: string;
}): Parameters<typeof planIncrementalApply>[0] {
  const base = overrides?.baseLayout ?? baseLayout();
  return {
    baseLayoutId:
      overrides != undefined && "baseLayoutId" in overrides ? overrides.baseLayoutId : "layout-1",
    baseFingerprint:
      overrides != undefined && "baseFingerprint" in overrides
        ? overrides.baseFingerprint
        : fingerprintOf(base),
    currentLayoutId: overrides?.currentLayoutId ?? "layout-1",
    currentLayoutData: base,
    proposalData: overrides?.proposal ?? addGaugeTo(base),
  };
}

describe("sanitizeLayoutData", () => {
  it("returns undefined for data that fails validation", () => {
    expect(
      sanitizeLayoutData({ configById: {}, playbackConfig: { speed: "fast" } }, emptyCatalog),
    ).toBeUndefined();
  });

  it("drops Plot paths that are invalid against the loaded catalog", () => {
    const data = {
      configById: {
        "Plot!speed": {
          paths: [{ value: "/missing.topic.x", enabled: true }],
        },
      },
      layout: "Plot!speed",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const sanitized = sanitizeLayoutData(data, catalogWithTopic("/camera", "sensor_msgs/Image"));
    expect(sanitized?.configById["Plot!speed"]).toEqual(
      expect.objectContaining({ autoSeeded: true, paths: [] }),
    );
  });
});

describe("planIncrementalApply (strict structural gate)", () => {
  it("returns a plan for an exact superset of the base layout", () => {
    const plan = planIncrementalApply(incrementalInput());

    expect(plan).toEqual({
      kind: "incremental",
      layout: {
        direction: "column",
        first: {
          direction: "row",
          first: "3D!scene",
          second: "Image!front",
          splitPercentage: 50,
        },
        second: "Gauge!battery",
        splitPercentage: 70,
      },
      newPanelConfigs: {
        "Gauge!battery": { path: "/battery.percentage", minValue: 0, maxValue: 100 },
      },
    });
  });

  it("returns a plan when the old tree is nested deeper in the proposal", () => {
    const proposal: LayoutData = {
      ...baseLayout(),
      configById: {
        ...baseLayout().configById,
        "Image!camera": { imageMode: { imageTopic: "/camera" } },
        "Table!status": { topicPath: "/diagnostics" },
      },
      layout: {
        direction: "row",
        first: {
          direction: "column",
          first: baseLayout().layout!,
          second: "Image!camera",
        },
        second: "Table!status",
        splitPercentage: 60,
      },
    };

    const plan = planIncrementalApply(incrementalInput({ proposal }));
    expect(plan).toEqual({
      kind: "incremental",
      layout: proposal.layout,
      newPanelConfigs: {
        "Image!camera": { imageMode: { imageTopic: "/camera" } },
        "Table!status": { topicPath: "/diagnostics" },
      },
    });
  });

  it("returns undefined when an existing panel config changed", () => {
    const proposal = addGaugeTo(baseLayout());
    (proposal.configById["3D!scene"] as Record<string, unknown>) = {
      topics: { "/points": { visible: false } },
    };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when an existing panel was removed", () => {
    const proposal = addGaugeTo(baseLayout());
    delete proposal.configById["3D!scene"];
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when the old tree was reordered", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.layout = {
      direction: "row",
      first: "Gauge!battery",
      second: {
        direction: "row",
        first: "Image!front",
        second: "3D!scene",
        splitPercentage: 50,
      },
      splitPercentage: 70,
    };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when the old tree is duplicated", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.layout = {
      direction: "column",
      first: baseLayout().layout!,
      second: {
        direction: "row",
        first: "Gauge!battery",
        second: baseLayout().layout!,
      },
    };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when userNodes changed (script added or edited)", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.userNodes = {
      "script-1": { name: "Speed", sourceCode: "export default () => {}" },
    };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when globalVariables changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.globalVariables = { speed: 1 };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when playbackConfig changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.playbackConfig = { speed: 2 };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when version changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.version = 2;
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when savedProps changed", () => {
    const proposal = addGaugeTo(baseLayout());
    // savedProps is deprecated on LayoutData; write it via an untyped record.
    (proposal as unknown as Record<string, unknown>)["savedProps"] = {
      "Image!front": { imageMode: {} },
    };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when a new config entry has no matching leaf", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.configById["Gauge!orphan"] = { path: "/nope" };
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when a new leaf has no config entry", () => {
    const proposal = addGaugeTo(baseLayout());
    delete proposal.configById["Gauge!battery"];
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when the proposal has no new panels", () => {
    expect(planIncrementalApply(incrementalInput({ proposal: baseLayout() }))).toBeUndefined();
  });

  it("returns undefined when the proposal has no mosaic tree", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.layout = undefined;
    expect(planIncrementalApply(incrementalInput({ proposal }))).toBeUndefined();
  });

  it("returns undefined when the proposal carries no baseline", () => {
    expect(planIncrementalApply(incrementalInput({ baseLayoutId: undefined }))).toBeUndefined();
    expect(planIncrementalApply(incrementalInput({ baseFingerprint: undefined }))).toBeUndefined();
  });

  it("returns undefined when no layout is currently selected", () => {
    expect(
      planIncrementalApply(
        incrementalInput({ currentLayoutId: undefined, baseLayoutId: undefined }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the selected layout id differs from the baseline", () => {
    expect(planIncrementalApply(incrementalInput({ currentLayoutId: "layout-2" }))).toBeUndefined();
  });

  it("returns undefined when the current layout fingerprint differs from the baseline", () => {
    expect(
      planIncrementalApply(
        incrementalInput({ baseFingerprint: fingerprintOf(addGaugeTo(baseLayout())) }),
      ),
    ).toBeUndefined();
  });

  it("returns the plan when baseline id and fingerprint both match", () => {
    expect(planIncrementalApply(incrementalInput())?.kind).toBe("incremental");
  });

  it("falls back when the current layout data was edited since the baseline", () => {
    const edited: LayoutData = {
      ...baseLayout(),
      playbackConfig: { speed: 4 },
    };
    expect(
      planIncrementalApply(
        incrementalInput({
          baseFingerprint: fingerprintOf(baseLayout()),
          currentLayoutId: "layout-1",
          proposal: addGaugeTo(edited),
          baseLayout: edited,
        }),
      ),
    ).toBeUndefined();
  });
});

describe("baseline fingerprint semantics", () => {
  it("treats key order as semantically identical through the apply gate", () => {
    const data = baseLayout();
    const reordered: LayoutData = {
      playbackConfig: data.playbackConfig,
      userNodes: data.userNodes,
      globalVariables: data.globalVariables,
      configById: data.configById,
      layout: data.layout,
    };
    const a = collectLayoutBaseline(
      () => data,
      () => "layout-1",
      () => emptyCatalog,
    );
    const b = collectLayoutBaseline(
      () => reordered,
      () => "layout-1",
      () => emptyCatalog,
    );
    expect(a.baseFingerprint).toBeDefined();
    expect(a.baseFingerprint).toBe(b.baseFingerprint);
    // The apply gate accepts the reordered layout against the original fingerprint.
    expect(
      planIncrementalApply(
        incrementalInput({
          baseFingerprint: a.baseFingerprint,
          baseLayout: reordered,
        }),
      )?.kind,
    ).toBe("incremental");
  });

  it("does not throw on pathological non-JSON values through the public apply gate", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    const pathological = {
      big: 1n,
      bytes: new Uint8Array([1, 2, 3]),
      cyclic,
      missing: undefined,
    };
    // The fingerprint mismatch path must degrade to a fallback, never throw.
    expect(
      planIncrementalApply({
        baseLayoutId: "layout-1",
        baseFingerprint: "00000000",
        currentLayoutId: "layout-1",
        currentLayoutData: pathological as unknown as LayoutData,
        proposalData: baseLayout(),
      }),
    ).toBeUndefined();
  });

  it("returns an incremental plan for an empty base layout with all-new panels", () => {
    // A valid empty layout omits the layout key entirely (undefined values are not JSON-safe);
    // every panel in the proposal is new.
    const emptyBase: LayoutData = {
      configById: {},
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const proposal: LayoutData = {
      ...emptyBase,
      configById: { "Plot!speed": { paths: [] } },
      layout: "Plot!speed",
    };
    const baseline = collectLayoutBaseline(
      () => emptyBase,
      () => "layout-1",
      () => emptyCatalog,
    );
    expect(baseline.baseFingerprint).toBeDefined();
    expect(
      planIncrementalApply({
        baseLayoutId: "layout-1",
        baseFingerprint: baseline.baseFingerprint,
        currentLayoutId: "layout-1",
        currentLayoutData: emptyBase,
        proposalData: proposal,
      }),
    ).toEqual({
      kind: "incremental",
      layout: "Plot!speed",
      newPanelConfigs: { "Plot!speed": { paths: [] } },
    });
  });
});

describe("collectLayoutBaseline", () => {
  it("captures the layout id and a deterministic fingerprint", () => {
    const first = collectLayoutBaseline(
      () => baseLayout(),
      () => "layout-1",
      () => emptyCatalog,
    );
    const second = collectLayoutBaseline(
      () => baseLayout(),
      () => "layout-1",
      () => emptyCatalog,
    );
    expect(first.baseLayoutId).toBe("layout-1");
    expect(first.baseFingerprint).toBeDefined();
    expect(first.baseFingerprint).toBe(second.baseFingerprint);
  });

  it("fingerprints the sanitized form, not the raw data", () => {
    const withInvalidPlotPath = {
      configById: {
        "Plot!speed": { paths: [{ value: "/missing.topic.x", enabled: true }] },
      },
      layout: "Plot!speed",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const catalog = catalogWithTopic("/camera", "sensor_msgs/Image");
    const sanitized = collectLayoutBaseline(
      () => withInvalidPlotPath,
      () => "layout-1",
      () => catalog,
    );
    const rawShaped = collectLayoutBaseline(
      () => ({
        ...withInvalidPlotPath,
        configById: {
          ...withInvalidPlotPath.configById,
          "Plot!speed": {
            ...withInvalidPlotPath.configById["Plot!speed"],
            autoSeeded: true,
            paths: [],
          },
        },
      }),
      () => "layout-1",
      () => emptyCatalog,
    );
    expect(sanitized.baseFingerprint).toBe(rawShaped.baseFingerprint);
  });

  it("returns no baseline when the current layout getters are absent or empty", () => {
    expect(collectLayoutBaseline(undefined, undefined, undefined)).toEqual({});
    expect(
      collectLayoutBaseline(
        () => undefined,
        () => "layout-1",
        () => emptyCatalog,
      ),
    ).toEqual({});
    expect(
      collectLayoutBaseline(
        () => baseLayout(),
        () => undefined,
        () => emptyCatalog,
      ),
    ).toEqual({});
    expect(
      collectLayoutBaseline(
        () => baseLayout(),
        () => "layout-1",
        undefined,
      ),
    ).toEqual({});
  });

  it("returns no baseline when a getter throws or the layout fails validation", () => {
    expect(
      collectLayoutBaseline(
        () => {
          throw new Error("boom");
        },
        () => "layout-1",
        () => emptyCatalog,
      ),
    ).toEqual({});
    expect(
      collectLayoutBaseline(
        () => ({ configById: {}, playbackConfig: { speed: "fast" } }),
        () => "layout-1",
        () => emptyCatalog,
      ),
    ).toEqual({});
  });
});

describe("computeProposalMode", () => {
  it("reports a new layout when the proposal carries no baseline", () => {
    expect(
      computeProposalMode(
        { name: "n", data: baseLayout() },
        { id: "l", data: baseLayout() },
        emptyCatalog,
      ),
    ).toEqual({ kind: "new" });
  });

  it("reports an incremental add with the panel count when the strict diff succeeds", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: fingerprintOf(baseLayout()),
    };
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: baseLayout() }, emptyCatalog),
    ).toEqual({ kind: "incremental", newPanelCount: 1 });
  });

  it("reports a new layout when the proposal would fall back (userNodes changed)", () => {
    const proposal = {
      name: "n",
      data: {
        ...addGaugeTo(baseLayout()),
        userNodes: { "script-1": { name: "S", sourceCode: "x" } },
      },
      baseLayoutId: "layout-1",
      baseFingerprint: fingerprintOf(baseLayout()),
    };
    // Script additions make the apply fall back to a new layout — the card must not claim
    // "Add panels to the current layout".
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: baseLayout() }, emptyCatalog),
    ).toEqual({ kind: "new" });
  });

  it("reports a new layout when the layout changed since the baseline (fingerprint mismatch)", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: fingerprintOf(baseLayout()),
    };
    const editedCurrent: LayoutData = { ...baseLayout(), playbackConfig: { speed: 4 } };
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: editedCurrent }, emptyCatalog),
    ).toEqual({ kind: "new" });
  });

  it("reports a new layout when a different layout is selected", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: fingerprintOf(baseLayout()),
    };
    expect(
      computeProposalMode(proposal, { id: "layout-other", data: baseLayout() }, emptyCatalog),
    ).toEqual({ kind: "new" });
  });

  it("reports a new layout when the catalog changed since the baseline", () => {
    const plotLayout = {
      configById: {
        "Plot!points": { paths: [{ value: "/points.x", enabled: true }] },
      },
      layout: "Plot!points",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const catalogWithPoints: CatalogSnapshot = {
      topics: [{ name: "/points", schemaName: "sensor_msgs/PointCloud2" }],
      datatypes: new Map([
        ["sensor_msgs/PointCloud2", { definitions: [{ name: "x", type: "float64" }] }],
      ]),
    };
    const proposal = {
      name: "n",
      data: addGaugeTo(plotLayout),
      baseLayoutId: "layout-1",
      baseFingerprint: collectLayoutBaseline(
        () => plotLayout,
        () => "layout-1",
        () => catalogWithPoints,
      ).baseFingerprint,
    };
    // The baseline was captured while /points existed; with a catalog that does not contain the
    // Plot path's topic it is sanitized away and the fingerprint no longer matches.
    expect(
      computeProposalMode(
        proposal,
        { id: "layout-1", data: plotLayout },
        catalogWithTopic("/imu", "sensor_msgs/Imu"),
      ),
    ).toEqual({ kind: "new" });
    // With the same catalog the mode stays incremental.
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: plotLayout }, catalogWithPoints),
    ).toEqual({ kind: "incremental", newPanelCount: 1 });
  });

  it("degrades to a new layout when the current layout or catalog is unavailable", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: fingerprintOf(baseLayout()),
    };
    expect(computeProposalMode(proposal, undefined, emptyCatalog)).toEqual({ kind: "new" });
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: baseLayout() }, undefined),
    ).toEqual({ kind: "new" });
  });

  it("matches the apply decision for a layout with invalid Plot paths (sanitized on both sides)", () => {
    const withInvalidPlotPath = {
      configById: {
        "Plot!speed": { paths: [{ value: "/missing.topic.x", enabled: true }] },
      },
      layout: "Plot!speed",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const proposal = {
      name: "n",
      data: {
        ...withInvalidPlotPath,
        configById: {
          ...withInvalidPlotPath.configById,
          "Gauge!battery": { path: "/battery" },
        },
        layout: {
          direction: "column",
          first: "Plot!speed",
          second: "Gauge!battery",
        },
      },
      baseLayoutId: "layout-1",
      baseFingerprint: collectLayoutBaseline(
        () => withInvalidPlotPath,
        () => "layout-1",
        () => emptyCatalog,
      ).baseFingerprint,
    };
    // The fingerprint matches (both sanitized), so the mode is incremental — and applying would
    // be incremental too.
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: withInvalidPlotPath }, emptyCatalog),
    ).toEqual({ kind: "incremental", newPanelCount: 1 });
  });
});

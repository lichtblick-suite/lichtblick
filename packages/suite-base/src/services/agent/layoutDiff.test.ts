// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import type { CatalogSnapshot } from "@lichtblick/suite-base/services/agent/local/types";

import {
  collectLayoutBaseline,
  computeLayoutFingerprint,
  computeProposalMode,
  planIncrementalApply,
  planIncrementalApplyData,
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
      "Plot!speed": {
        paths: [{ value: "/odom.twist.twist.linear.x", enabled: true }],
      },
    },
    layout: {
      direction: "row",
      first: "3D!scene",
      second: "Plot!speed",
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
      overrides != undefined && "baseLayoutId" in overrides
        ? overrides.baseLayoutId
        : "layout-1",
    baseFingerprint:
      overrides != undefined && "baseFingerprint" in overrides
        ? overrides.baseFingerprint
        : computeLayoutFingerprint(base),
    currentLayoutId: overrides?.currentLayoutId ?? "layout-1",
    currentLayoutData: base,
    proposalData: overrides?.proposal ?? addGaugeTo(base),
  };
}

describe("sanitizeLayoutData", () => {
  it("returns undefined for data that fails validation", () => {
    expect(
      sanitizeLayoutData(
        { configById: {}, playbackConfig: { speed: "fast" } },
        emptyCatalog,
      ),
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

describe("computeLayoutFingerprint", () => {
  it("is deterministic for the same data", () => {
    expect(computeLayoutFingerprint(baseLayout())).toBe(computeLayoutFingerprint(baseLayout()));
  });

  it("is independent of object key order", () => {
    const data = baseLayout();
    const reordered: LayoutData = {
      playbackConfig: data.playbackConfig,
      userNodes: data.userNodes,
      globalVariables: data.globalVariables,
      configById: data.configById,
      layout: data.layout,
    };
    expect(computeLayoutFingerprint(data)).toBe(computeLayoutFingerprint(reordered));
  });

  it("differs when the data differs", () => {
    const changed = baseLayout();
    changed.playbackConfig = { speed: 2 };
    expect(computeLayoutFingerprint(changed)).not.toBe(
      computeLayoutFingerprint(baseLayout()),
    );
  });

  it("does not throw on pathological non-JSON values", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(() =>
      computeLayoutFingerprint({
        big: 1n,
        bytes: new Uint8Array([1, 2, 3]),
        cyclic,
        missing: undefined,
      }),
    ).not.toThrow();
    // Stable across calls.
    const value = { bytes: new Uint8Array([1, 2, 3]), cyclic };
    expect(computeLayoutFingerprint(value)).toBe(computeLayoutFingerprint(value));
  });
});

describe("planIncrementalApplyData", () => {
  it("returns a plan for an exact superset of the base layout", () => {
    const plan = planIncrementalApplyData(baseLayout(), addGaugeTo(baseLayout()));

    expect(plan).toEqual({
      kind: "incremental",
      layout: {
        direction: "column",
        first: {
          direction: "row",
          first: "3D!scene",
          second: "Plot!speed",
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

    const plan = planIncrementalApplyData(baseLayout(), proposal);
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
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when an existing panel was removed", () => {
    const proposal = addGaugeTo(baseLayout());
    delete proposal.configById["3D!scene"];
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when the old tree was reordered", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.layout = {
      direction: "row",
      first: "Gauge!battery",
      second: {
        direction: "row",
        first: "Plot!speed",
        second: "3D!scene",
        splitPercentage: 50,
      },
      splitPercentage: 70,
    };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
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
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when userNodes changed (script added or edited)", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.userNodes = {
      "script-1": { name: "Speed", sourceCode: "export default () => {}" },
    };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when globalVariables changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.globalVariables = { speed: 1 };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when playbackConfig changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.playbackConfig = { speed: 2 };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when version changed", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.version = 2;
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when savedProps changed", () => {
    const proposal = addGaugeTo(baseLayout());
    // savedProps is deprecated on LayoutData; write it via an untyped record.
    (proposal as unknown as Record<string, unknown>)["savedProps"] = {
      "Plot!speed": { paths: [] },
    };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when a new config entry has no matching leaf", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.configById["Gauge!orphan"] = { path: "/nope" };
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns undefined when a new leaf has no config entry", () => {
    const proposal = addGaugeTo(baseLayout());
    delete proposal.configById["Gauge!battery"];
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });

  it("returns a plan when the base layout is empty (all panels are new)", () => {
    const emptyBase: LayoutData = {
      configById: {},
      layout: undefined,
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const proposal: LayoutData = {
      ...emptyBase,
      configById: { "Plot!speed": { paths: [] } },
      layout: "Plot!speed",
    };

    expect(planIncrementalApplyData(emptyBase, proposal)).toEqual({
      kind: "incremental",
      layout: "Plot!speed",
      newPanelConfigs: { "Plot!speed": { paths: [] } },
    });
  });

  it("returns undefined when the proposal has no new panels", () => {
    expect(planIncrementalApplyData(baseLayout(), baseLayout())).toBeUndefined();
  });

  it("returns undefined when the proposal has no mosaic tree", () => {
    const proposal = addGaugeTo(baseLayout());
    proposal.layout = undefined;
    expect(planIncrementalApplyData(baseLayout(), proposal)).toBeUndefined();
  });
});

describe("planIncrementalApply", () => {
  it("returns undefined when the proposal carries no baseline", () => {
    expect(planIncrementalApply(incrementalInput({ baseLayoutId: undefined }))).toBeUndefined();
    expect(
      planIncrementalApply(incrementalInput({ baseFingerprint: undefined })),
    ).toBeUndefined();
  });

  it("returns undefined when no layout is currently selected", () => {
    expect(
      planIncrementalApply(
        incrementalInput({ currentLayoutId: undefined, baseLayoutId: undefined }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the selected layout id differs from the baseline", () => {
    expect(
      planIncrementalApply(incrementalInput({ currentLayoutId: "layout-2" })),
    ).toBeUndefined();
  });

  it("returns undefined when the current layout fingerprint differs from the baseline", () => {
    expect(
      planIncrementalApply(
        incrementalInput({ baseFingerprint: computeLayoutFingerprint(addGaugeTo(baseLayout())) }),
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
          baseFingerprint: computeLayoutFingerprint(baseLayout()),
          currentLayoutId: "layout-1",
          proposal: addGaugeTo(edited),
          baseLayout: edited,
        }),
      ),
    ).toBeUndefined();
  });
});

describe("collectLayoutBaseline", () => {
  it("captures the layout id and the fingerprint of the sanitized data", () => {
    const baseline = collectLayoutBaseline(
      () => baseLayout(),
      () => "layout-1",
      () => emptyCatalog,
    );
    expect(baseline).toEqual({
      baseLayoutId: "layout-1",
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
    });
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
    const baseline = collectLayoutBaseline(
      () => withInvalidPlotPath,
      () => "layout-1",
      () => catalog,
    );
    const sanitizedFingerprint = computeLayoutFingerprint(
      sanitizeLayoutData(withInvalidPlotPath, catalog)!,
    );
    expect(baseline.baseFingerprint).toBe(sanitizedFingerprint);
    expect(baseline.baseFingerprint).not.toBe(
      computeLayoutFingerprint(withInvalidPlotPath),
    );
  });

  it("returns no baseline when the current layout getters are absent or empty", () => {
    expect(collectLayoutBaseline(undefined, undefined, undefined)).toEqual({});
    expect(collectLayoutBaseline(() => undefined, () => "layout-1", () => emptyCatalog)).toEqual(
      {},
    );
    expect(collectLayoutBaseline(() => baseLayout(), () => undefined, () => emptyCatalog)).toEqual(
      {},
    );
    expect(collectLayoutBaseline(() => baseLayout(), () => "layout-1", undefined)).toEqual({});
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
      computeProposalMode({ name: "n", data: baseLayout() }, { id: "l", data: baseLayout() }, emptyCatalog),
    ).toEqual({ kind: "new" });
  });

  it("reports an incremental add with the panel count when the strict diff succeeds", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
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
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
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
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
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
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
    };
    expect(
      computeProposalMode(proposal, { id: "layout-other", data: baseLayout() }, emptyCatalog),
    ).toEqual({ kind: "new" });
  });

  it("reports a new layout when the catalog changed since the baseline", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
    };
    expect(
      computeProposalMode(
        proposal,
        { id: "layout-1", data: baseLayout() },
        catalogWithTopic("/imu", "sensor_msgs/Imu"),
      ),
    ).toEqual({ kind: "new" });
  });

  it("degrades to a new layout when the current layout or catalog is unavailable", () => {
    const proposal = {
      name: "n",
      data: addGaugeTo(baseLayout()),
      baseLayoutId: "layout-1",
      baseFingerprint: computeLayoutFingerprint(sanitizeLayoutData(baseLayout(), emptyCatalog)!),
    };
    expect(computeProposalMode(proposal, undefined, emptyCatalog)).toEqual({ kind: "new" });
    expect(computeProposalMode(proposal, { id: "layout-1", data: baseLayout() }, undefined)).toEqual(
      { kind: "new" },
    );
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
      baseFingerprint: computeLayoutFingerprint(
        sanitizeLayoutData(withInvalidPlotPath, emptyCatalog)!,
      ),
    };
    // The fingerprint matches (both sanitized), so the mode is incremental — and applying would
    // be incremental too.
    expect(
      computeProposalMode(proposal, { id: "layout-1", data: withInvalidPlotPath }, emptyCatalog),
    ).toEqual({ kind: "incremental", newPanelCount: 1 });
  });
});

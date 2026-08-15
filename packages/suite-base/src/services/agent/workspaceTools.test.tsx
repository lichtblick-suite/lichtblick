/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";
import { useSnackbar } from "notistack";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { usePanelCatalog } from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";

import { computeLayoutFingerprint, sanitizeLayoutData } from "./layoutDiff";
import { useAgentWorkspaceTools } from "./workspaceTools";

jest.mock("notistack", () => ({
  ...jest.requireActual("notistack"),
  useSnackbar: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/PanelCatalogContext", () => ({
  usePanelCatalog: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn(),
}));

describe("useAgentWorkspaceTools", () => {
  const selectSource = jest.fn();
  const saveNewLayout = jest.fn();
  const setSelectedLayoutId = jest.fn();
  const addPanelsAtomically = jest.fn();
  const getCurrentLayoutState = jest.fn();
  const enqueueSnackbar = jest.fn();
  const topics = [{ name: "/camera", schemaName: "sensor_msgs/Image" }];
  const datatypes = new Map([["sensor_msgs/Image", { definitions: [] }]]);

  beforeEach(() => {
    jest.resetAllMocks();

    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar });
    (usePlayerSelection as jest.Mock).mockReturnValue({ selectSource });
    (useLayoutManager as jest.Mock).mockReturnValue({ saveNewLayout });
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      addPanelsAtomically,
      getCurrentLayoutState,
      setSelectedLayoutId,
    });
    getCurrentLayoutState.mockReturnValue({ selectedLayout: undefined });
    (useDataSourceInfo as jest.Mock).mockReturnValue({ topics, datatypes });
    (usePanelCatalog as jest.Mock).mockReturnValue({ getPanels: () => [] });
  });

  it("opens remote URLs through the remote-file data source", () => {
    const { result } = renderHook(() => useAgentWorkspaceTools());

    result.current.openDataSource([
      "https://example.com/first.mcap",
      "https://example.com/second.mcap",
    ]);

    expect(selectSource).toHaveBeenCalledWith("remote-file", {
      type: "connection",
      params: {
        url: "https://example.com/first.mcap,https://example.com/second.mcap",
      },
    });
  });

  it("rejects an empty remote URL list", () => {
    const { result } = renderHook(() => useAgentWorkspaceTools());

    expect(() => {
      result.current.openDataSource([]);
    }).toThrow("Agent data source must include at least one URL");
    expect(selectSource).not.toHaveBeenCalled();
  });

  it("rejects remote URLs containing literal commas", () => {
    const { result } = renderHook(() => useAgentWorkspaceTools());

    expect(() => {
      result.current.openDataSource(["https://example.com/segment,part.mcap"]);
    }).toThrow(
      "Agent data source URLs must not contain literal commas; encode commas as %2C",
    );
    expect(selectSource).not.toHaveBeenCalled();
  });

  it("returns the current data source catalog", () => {
    const { result } = renderHook(() => useAgentWorkspaceTools());

    expect(result.current.getCatalog()).toEqual({ topics, datatypes });
  });

  it("saves a creator-owned layout and selects it", async () => {
    const layoutData = {
      configById: {},
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const layout = { id: "layout-id" };
    saveNewLayout.mockResolvedValue(layout);
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await result.current.applyLayout("Agent layout", layoutData);

    expect(saveNewLayout).toHaveBeenCalledWith({
      name: "Agent layout",
      data: layoutData,
      permission: "CREATOR_WRITE",
    });
    expect(setSelectedLayoutId).toHaveBeenCalledWith(layout.id);
  });

  it("rejects invalid layout data before saving", async () => {
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await expect(
      result.current.applyLayout("Invalid layout", {
        configById: {},
        globalVariables: {},
        playbackConfig: {},
        userNodes: {},
      }),
    ).rejects.toThrow("playbackConfig.speed must be a finite number");
    expect(saveNewLayout).not.toHaveBeenCalled();
    expect(setSelectedLayoutId).not.toHaveBeenCalled();
  });

  it("propagates layout save failures without selecting a layout", async () => {
    const error = new Error("IndexedDB unavailable");
    saveNewLayout.mockRejectedValue(error);
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await expect(
      result.current.applyLayout("Agent layout", {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      }),
    ).rejects.toBe(error);
    expect(setSelectedLayoutId).not.toHaveBeenCalled();
  });

  it("does not await the publicly void layout selection API", async () => {
    const layout = { id: "layout-id" };
    saveNewLayout.mockResolvedValue(layout);
    setSelectedLayoutId.mockReturnValue(undefined);
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await result.current.applyLayout("Agent layout", {
      configById: {},
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    });

    expect(setSelectedLayoutId).toHaveBeenCalledWith(layout.id);
    // The incremental attempt consults the current layout; the public selection API is still
    // not awaited (returns void), so nothing after it can be truthfully reported.
    expect(getCurrentLayoutState).toHaveBeenCalled();
  });

  it("drops invalid Plot paths against the loaded catalog and reports a snackbar summary", async () => {
    const layoutData = {
      configById: {
        "Plot!agent": {
          paths: [
            { value: "/nonexistent.x", enabled: true, timestampMethod: "receiveTime" },
            { value: "/camera.data", enabled: true, timestampMethod: "receiveTime" },
          ],
        },
      },
      globalVariables: {},
      layout: "Plot!agent",
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const layout = { id: "layout-id" };
    saveNewLayout.mockResolvedValue(layout);
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await result.current.applyLayout("Agent layout", layoutData);

    // /nonexistent.x：topic 不存在 → 丢弃；/camera.data：schema 存在于 datatypes 但
    // 无 data 字段且终止类型不可绘制 → 丢弃。两条均无效，paths 置空并阻止 auto-seed。
    expect(enqueueSnackbar).toHaveBeenCalledWith("已忽略 2 条无效曲线", { variant: "info" });
    expect(saveNewLayout).toHaveBeenCalledWith({
      name: "Agent layout",
      data: expect.objectContaining({
        configById: expect.objectContaining({
          "Plot!agent": { paths: [], autoSeeded: true },
        }),
      }),
      permission: "CREATOR_WRITE",
    });
  });

  it("does not filter Plot paths when no data source is loaded", async () => {
    (useDataSourceInfo as jest.Mock).mockReturnValue({ topics: [], datatypes: new Map() });
    const layoutData = {
      configById: {
        "Plot!agent": {
          paths: [{ value: "/anything.x", enabled: true, timestampMethod: "receiveTime" }],
        },
      },
      globalVariables: {},
      layout: "Plot!agent",
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const layout = { id: "layout-id" };
    saveNewLayout.mockResolvedValue(layout);
    const { result } = renderHook(() => useAgentWorkspaceTools());

    await result.current.applyLayout("Agent layout", layoutData);

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(saveNewLayout).toHaveBeenCalledWith({
      name: "Agent layout",
      data: layoutData,
      permission: "CREATOR_WRITE",
    });
  });

  it("returns the selected layout data", () => {
    const layoutData = { layout: "Plot!agent" };
    getCurrentLayoutState.mockReturnValue({
      selectedLayout: { id: "layout-id", data: layoutData },
    });
    const { result } = renderHook(() => useAgentWorkspaceTools());

    expect(result.current.getCurrentLayout()).toBe(layoutData);
  });

  it("returns the selected layout id", () => {
    getCurrentLayoutState.mockReturnValue({
      selectedLayout: { id: "layout-id", data: {} },
    });
    const { result } = renderHook(() => useAgentWorkspaceTools());

    expect(result.current.getCurrentLayoutId()).toBe("layout-id");
  });

  describe("incremental apply", () => {
    const currentLayout = {
      configById: {
        "Image!camera": { imageMode: { imageTopic: "/camera" } },
      },
      layout: "Image!camera",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const proposalWithExtraPanel = {
      configById: {
        "Image!camera": { imageMode: { imageTopic: "/camera" } },
        "Gauge!battery": { path: "/battery.percentage", minValue: 0, maxValue: 100 },
        "Table!status": { topicPath: "/diagnostics" },
      },
      layout: {
        direction: "column",
        first: {
          direction: "row",
          first: "Image!camera",
          second: "Gauge!battery",
          splitPercentage: 60,
        },
        second: "Table!status",
        splitPercentage: 70,
      },
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const baseFingerprint = computeLayoutFingerprint(currentLayout);

    beforeEach(() => {
      getCurrentLayoutState.mockReturnValue({
        selectedLayout: { id: "layout-1", data: currentLayout },
      });
      saveNewLayout.mockResolvedValue({ id: "new-layout-id" });
    });

    it("applies a strict superset in place without saving a new layout", async () => {
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposalWithExtraPanel, {
        baseLayoutId: "layout-1",
        baseFingerprint,
      });

      expect(addPanelsAtomically).toHaveBeenCalledWith({
        layout: proposalWithExtraPanel.layout,
        configs: {
          "Gauge!battery": { path: "/battery.percentage", minValue: 0, maxValue: 100 },
          "Table!status": { topicPath: "/diagnostics" },
        },
      });
      expect(saveNewLayout).not.toHaveBeenCalled();
      expect(setSelectedLayoutId).not.toHaveBeenCalled();
    });

    it("falls back to the full path when the fingerprint does not match", async () => {
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposalWithExtraPanel, {
        baseLayoutId: "layout-1",
        baseFingerprint: "deadbeef",
      });

      expect(addPanelsAtomically).not.toHaveBeenCalled();
      expect(saveNewLayout).toHaveBeenCalledWith({
        name: "Agent layout",
        data: proposalWithExtraPanel,
        permission: "CREATOR_WRITE",
      });
      expect(setSelectedLayoutId).toHaveBeenCalledWith("new-layout-id");
    });

    it("falls back to the full path when the selected layout id differs from the baseline", async () => {
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposalWithExtraPanel, {
        baseLayoutId: "layout-other",
        baseFingerprint,
      });

      expect(addPanelsAtomically).not.toHaveBeenCalled();
      expect(saveNewLayout).toHaveBeenCalled();
    });

    it("falls back to the full path when the proposal carries no baseline", async () => {
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposalWithExtraPanel);

      expect(addPanelsAtomically).not.toHaveBeenCalled();
      expect(saveNewLayout).toHaveBeenCalled();
    });

    it("falls back to the full path when the proposal changed userNodes", async () => {
      const proposal = {
        ...proposalWithExtraPanel,
        userNodes: {
          "script-1": { name: "Speed", sourceCode: "export default () => {}" },
        },
      };
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposal, {
        baseLayoutId: "layout-1",
        baseFingerprint,
      });

      expect(addPanelsAtomically).not.toHaveBeenCalled();
      expect(saveNewLayout).toHaveBeenCalled();
    });

    it("applies incrementally even when the base layout carries stale Plot paths", async () => {
      // The loaded catalog only has /camera; the Plot path is invalid and sanitize drops it from
      // both the current layout and the proposal, so the strict diff still succeeds — the base
      // layout is not unnecessarily sent through the full path.
      const stalePlotLayout = {
        configById: {
          "Plot!speed": { paths: [{ value: "/odom.twist.twist.linear.x", enabled: true }] },
        },
        layout: "Plot!speed",
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      };
      const stalePlotProposal = {
        configById: {
          "Plot!speed": { paths: [{ value: "/odom.twist.twist.linear.x", enabled: true }] },
          "Gauge!battery": { path: "/battery", minValue: 0, maxValue: 100 },
        },
        layout: {
          direction: "column",
          first: "Plot!speed",
          second: "Gauge!battery",
          splitPercentage: 70,
        },
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      };
      getCurrentLayoutState.mockReturnValue({
        selectedLayout: { id: "layout-1", data: stalePlotLayout },
      });
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", stalePlotProposal, {
        baseLayoutId: "layout-1",
        // Same pipeline as the apply path: fingerprint over the sanitized base layout.
        baseFingerprint: computeLayoutFingerprint(
          sanitizeLayoutData(stalePlotLayout, { topics, datatypes })!,
        ),
      });

      expect(addPanelsAtomically).toHaveBeenCalledTimes(1);
      expect(saveNewLayout).not.toHaveBeenCalled();
      expect(setSelectedLayoutId).not.toHaveBeenCalled();
    });
  });

  describe("installed extension panel types", () => {
    const extensionPanelType = "Acme Extension.Custom Panel";
    const extensionPanelId = `${extensionPanelType}!main`;
    const baseLayout = {
      configById: {
        "Image!front": {},
      },
      layout: "Image!front",
      globalVariables: {},
      playbackConfig: { speed: 1 },
      userNodes: {},
    };
    const proposalWithExtensionPanel = {
      ...baseLayout,
      configById: {
        ...baseLayout.configById,
        [extensionPanelId]: { customSetting: true },
      },
      layout: {
        direction: "column",
        first: "Image!front",
        second: extensionPanelId,
        splitPercentage: 70,
      },
    };

    it("accepts an installed extension panel type through the live panel catalog and dispatches the atomic add", async () => {
      (usePanelCatalog as jest.Mock).mockReturnValue({
        getPanels: () => [{ type: extensionPanelType }],
      });
      const baseFingerprint = computeLayoutFingerprint(baseLayout);
      getCurrentLayoutState.mockReturnValue({
        selectedLayout: { id: "layout-1", data: baseLayout },
      });
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await result.current.applyLayout("Agent layout", proposalWithExtensionPanel, {
        baseLayoutId: "layout-1",
        baseFingerprint,
      });

      expect(addPanelsAtomically).toHaveBeenCalledWith({
        layout: proposalWithExtensionPanel.layout,
        configs: {
          [extensionPanelId]: { customSetting: true },
        },
      });
      expect(saveNewLayout).not.toHaveBeenCalled();
    });

    it("still rejects an extension panel type that is not installed", async () => {
      (usePanelCatalog as jest.Mock).mockReturnValue({ getPanels: () => [] });
      const { result } = renderHook(() => useAgentWorkspaceTools());

      await expect(
        result.current.applyLayout("Agent layout", proposalWithExtensionPanel),
      ).rejects.toThrow("uses unsupported panel type");
      expect(addPanelsAtomically).not.toHaveBeenCalled();
      expect(saveNewLayout).not.toHaveBeenCalled();
    });
  });
});

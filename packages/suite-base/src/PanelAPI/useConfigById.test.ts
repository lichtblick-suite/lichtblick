/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import useConfigById from "./useConfigById";

const mockGetCurrentLayoutState = vi.fn();
const mockSavePanelConfigs = vi.fn();
const mockUseCurrentLayoutActions = vi.fn();
const mockUseCurrentLayoutSelector = vi.fn();
const mockUseExtensionCatalog = vi.fn();
const mockUseMessagePipeline = vi.fn();

vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useCurrentLayoutActions: () => mockUseCurrentLayoutActions(),
  useCurrentLayoutSelector: (selector: any) => mockUseCurrentLayoutSelector(selector),
}));

vi.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", async () => ({
  useExtensionCatalog: (selector: any) => mockUseExtensionCatalog(selector),
  getExtensionPanelSettings: vi.fn(() => ({})),
}));

vi.mock("@lichtblick/suite-base/components/MessagePipeline", async () => ({
  useMessagePipeline: (selector: any) => mockUseMessagePipeline(selector),
}));

vi.mock("../util/layout", async () => ({
  getPanelTypeFromId: (id: string) => `panelType:${id}`,
}));

describe("useConfigById", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseCurrentLayoutActions.mockReturnValue({
      getCurrentLayoutState: mockGetCurrentLayoutState,
      savePanelConfigs: mockSavePanelConfigs,
    });

    mockUseCurrentLayoutSelector.mockImplementation((selector) =>
      selector({
        selectedLayout: {
          data: { configById: { "panel-1": { topics: { topic1: "topic1" } } } },
        },
      }),
    );

    mockUseExtensionCatalog.mockReturnValue({});
    mockUseMessagePipeline.mockReturnValue([
      { name: "topic1", schemaName: "Schema1" },
      { name: "topic2", schemaName: undefined },
    ]);
  });

  it("returns config, saveConfig, and extensionSettings", () => {
    const { result } = renderHook(() =>
      useConfigById<{ topics?: Record<string, string> }>("panel-1"),
    );

    const [config, saveConfig, extensionSettings] = result.current;

    expect(config).toEqual({ topics: { topic1: "topic1" } });
    expect(typeof saveConfig).toBe("function");
    expect(extensionSettings).toEqual({});
  });

  it("calls savePanelConfigs with a plain object config", () => {
    const { result } = renderHook(() =>
      useConfigById<{ topics?: Record<string, string> }>("panel-1"),
    );

    const [, saveConfig] = result.current;

    act(() => {
      saveConfig({ topics: { topic1: "topic1" } });
    });

    expect(mockSavePanelConfigs).toHaveBeenCalledWith({
      configs: [{ id: "panel-1", config: { topics: { topic1: "topic1" } } }],
    });
  });

  it("calls savePanelConfigs with a function updater", () => {
    mockGetCurrentLayoutState.mockReturnValue({
      selectedLayout: { data: { configById: { "panel-1": { topics: { topic1: "topic1" } } } } },
    });

    const { result } = renderHook(() =>
      useConfigById<{ topics?: Record<string, string> }>("panel-1"),
    );
    const [, saveConfig] = result.current;

    act(() => {
      saveConfig((prev) => ({ topics: { ...prev.topics, topic1: "topic1" } }));
    });

    expect(mockSavePanelConfigs).toHaveBeenCalledWith({
      configs: [{ id: "panel-1", config: { topics: { topic1: "topic1" } } }],
    });
  });

  it("does nothing if panelId is undefined", () => {
    const { result } = renderHook(() =>
      useConfigById<{ topics?: Record<string, string> }>(undefined),
    );

    const [, saveConfig] = result.current;

    act(() => {
      saveConfig({ topics: { topic1: "topic1" } });
    });

    expect(mockSavePanelConfigs).not.toHaveBeenCalled();
  });
});

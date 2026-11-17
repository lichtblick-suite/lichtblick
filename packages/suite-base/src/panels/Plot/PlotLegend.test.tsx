/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { userEvent } from "@storybook/testing-library";
import { act, render, screen } from "@testing-library/react";
import { Profiler, useMemo } from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { BasicBuilder } from "@lichtblick/test-builders";

import type { PlotCoordinator } from "./PlotCoordinator";
import { PlotLegend } from "./PlotLegend";

const defaultProps = {
  showLegend: true,
  saveConfig: jest.fn(),
  sidebarDimension: BasicBuilder.number(),
  paths: [],
};

const getContextValue = () => ({
  type: "foo",
  id: "bar",
  title: "Foo Panel",
  config: {},
  saveConfig: jest.fn(),
  updatePanelConfigs: jest.fn(),
  exitFullscreen: jest.fn(),
  setHasFullscreenDescendant: jest.fn(),
  isFullscreen: false,
  connectToolbarDragHandle: jest.fn(),
  setMessagePathDropConfig: jest.fn(),
  openSiblingPanel: jest.fn(),
  replacePanel: jest.fn(),
  enterFullscreen: jest.fn(),
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const contextValue = useMemo(getContextValue, []);
  return (
    <PanelContext.Provider value={contextValue}>
      <div>{children}</div>
    </PanelContext.Provider>
  );
};

const setup = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  return render(
    <PanelContext.Provider value={getContextValue()}>
      <TestWrapper>
        <PlotLegend
          coordinator={undefined}
          legendDisplay="floating"
          onClickPath={jest.fn()}
          showValues={false}
          {...props}
        />
      </TestWrapper>
    </PanelContext.Provider>,
  );
};

jest.mock("@lichtblick/hooks", () => ({
  useGuaranteedContext: jest.fn(() => ({
    setState: jest.fn(),
    state: {},
  })),
  useSetState: jest.fn(),
  useContext: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(() => ({
    getCurrentLayoutState: jest.fn(),
    setCurrentLayout: jest.fn(),
  })),
  useSelectedPanels: jest.fn(() => []),
}));

// Called once per PlotLegendRow render, so its call count is the row render count.
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(() => ({ openPanelSettings: jest.fn() })),
}));

describe("PlotLegend", () => {
  const mockSetSelectedPanelIds = jest.fn();
  const path = BasicBuilder.string();
  const secondPath = BasicBuilder.string();

  beforeEach(() => {
    (useSelectedPanels as jest.Mock).mockReturnValue({
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders PlotLegend without crashing", () => {
    setup();
    expect(screen.getByTitle("Add series")).toBeDefined();
  });

  it("toggles legend visibility when IconButton is clicked", async () => {
    const mockSaveConfig = jest.fn();
    const { getByRole } = setup({ showLegend: false, saveConfig: mockSaveConfig });

    await userEvent.setup().click(getByRole("button"));

    expect(mockSaveConfig).toHaveBeenCalledWith({ showLegend: true });
  });

  it("renders paths from props", () => {
    const paths = [
      { value: path, enabled: true },
      { value: secondPath, enabled: true },
    ];
    setup({ paths });

    expect(screen.getByText(path)).toBeDefined();
    expect(screen.getByText(secondPath)).toBeDefined();
  });

  it("calls onClickPath when a path is clicked", async () => {
    const mockOnClickPath = jest.fn();
    const paths = [{ value: path, enabled: true }];

    setup({ paths, onClickPath: mockOnClickPath });

    await userEvent.setup().click(screen.getByText(path));

    expect(mockOnClickPath).toHaveBeenCalledWith(0);
  });

  it("calls onClickPath with the row index when Add series is clicked", async () => {
    // Given
    const mockOnClickPath = jest.fn();
    setup({ paths: [], onClickPath: mockOnClickPath });

    // When
    await userEvent.setup().click(screen.getByTitle("Add series"));

    // Then
    expect(mockOnClickPath).toHaveBeenCalledWith(0);
  });
});

describe("PlotLegend re-renders", () => {
  const paths = [
    { value: BasicBuilder.string(), enabled: true },
    { value: BasicBuilder.string(), enabled: true },
  ];
  const onClickPath = jest.fn();
  const saveConfig = jest.fn();
  const panelContext = getContextValue();

  function makeCoordinator() {
    const handlers = new Map<string, (arg: unknown) => void>();
    const coordinator = {
      on: (event: string, handler: (arg: unknown) => void) => {
        handlers.set(event, handler);
      },
      off: jest.fn(),
    } as unknown as PlotCoordinator;
    return { coordinator, emit: (event: string, arg: unknown) => handlers.get(event)?.(arg) };
  }

  function legend(props: { sidebarDimension: number; coordinator?: PlotCoordinator }) {
    return (
      <PanelContext.Provider value={panelContext}>
        <PlotLegend
          coordinator={props.coordinator}
          legendDisplay="floating"
          onClickPath={onClickPath}
          paths={paths}
          saveConfig={saveConfig}
          showLegend
          showValues={false}
          sidebarDimension={props.sidebarDimension}
        />
      </PanelContext.Provider>
    );
  }

  beforeEach(() => {
    (useSelectedPanels as jest.Mock).mockReturnValue({ setSelectedPanelIds: jest.fn() });
    (useWorkspaceActions as jest.Mock).mockClear();
  });

  it("should not re-render rows when the legend re-renders with unchanged row props", () => {
    // Given
    const view = render(legend({ sidebarDimension: 100 }));
    const rowRendersAfterMount = (useWorkspaceActions as jest.Mock).mock.calls.length;
    expect(rowRendersAfterMount).toBe(paths.length);

    // When
    view.rerender(legend({ sidebarDimension: 200 }));

    // Then
    expect((useWorkspaceActions as jest.Mock).mock.calls.length).toBe(rowRendersAfterMount);
  });

  it("should not commit when the coordinator reports an unchanged mismatch list", () => {
    // Given
    const { coordinator, emit } = makeCoordinator();
    const onCommit = jest.fn();
    render(
      <Profiler id="legend" onRender={onCommit}>
        {legend({ sidebarDimension: 100, coordinator })}
      </Profiler>,
    );
    act(() => {
      emit("pathsWithMismatchedDataLengthsChanged", [paths[0]!.value]);
    });
    const commitsAfterChange = onCommit.mock.calls.length;

    // When
    act(() => {
      for (let i = 0; i < 5; i++) {
        emit("pathsWithMismatchedDataLengthsChanged", [paths[0]!.value]);
      }
    });

    // Then
    expect(onCommit.mock.calls.length).toBe(commitsAfterChange);
  });

  it("should re-render when the mismatch list content changes", () => {
    // Given
    const { coordinator, emit } = makeCoordinator();
    const onCommit = jest.fn();
    render(
      <Profiler id="legend" onRender={onCommit}>
        {legend({ sidebarDimension: 100, coordinator })}
      </Profiler>,
    );
    const commitsAfterMount = onCommit.mock.calls.length;

    // When
    act(() => {
      emit("pathsWithMismatchedDataLengthsChanged", [paths[1]!.value]);
    });

    // Then
    expect(onCommit.mock.calls.length).toBeGreaterThan(commitsAfterMount);
  });
});

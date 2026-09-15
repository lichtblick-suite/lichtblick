/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { userEvent } from "@storybook/testing-library";
import { render, screen } from "@testing-library/react";

import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { PathLegendProps } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { useDraggedMessagePath } from "@lichtblick/suite-base/panels/shared/useDraggedMessagePath";
import { useMessagePathDrag } from "@lichtblick/suite-base/services/messagePathDragging";
import { BasicBuilder } from "@lichtblick/test-builders";

import { PathLegend } from "./PathLegend";

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext");
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions");

jest.mock("@lichtblick/suite-base/panels/shared/useDraggedMessagePath", () => ({
  useDraggedMessagePath: jest.fn(() => undefined),
}));

jest.mock("@lichtblick/suite-base/services/messagePathDragging", () => ({
  useMessagePathDrag: jest.fn(() => ({
    connectDragSource: jest.fn(),
    connectDragPreview: jest.fn(),
    cursor: undefined,
    isDragging: false,
    draggedItemCount: 0,
  })),
}));

describe("PathLegend Component", () => {
  const mockSetFocusedPath = jest.fn();
  const mockSaveConfig = jest.fn();
  const mockOpenPanelSettings = jest.fn();
  const mockSetSelectedPanelIds = jest.fn();

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (useSelectedPanels as jest.Mock).mockReturnValue({
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
    (useWorkspaceActions as jest.Mock).mockReturnValue({
      globalVariables: {},
      openPanelSettings: mockOpenPanelSettings,
      setGlobalVariables: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (propsOverride: Partial<PathLegendProps & { panelId: string }> = {}) => {
    const props: PathLegendProps = {
      heightPerTopic: BasicBuilder.number({ min: 0, max: 5000 }),
      paths: [
        {
          value: BasicBuilder.string(),
          timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"]),
        },
        {
          value: BasicBuilder.string(),
          timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"]),
        },
      ],
      saveConfig: mockSaveConfig,
      setFocusedPath: mockSetFocusedPath,
      ...propsOverride,
    };

    const ui: React.ReactElement = (
      <MockPanelContextProvider id={propsOverride.panelId}>
        <PathLegend {...props} />
      </MockPanelContextProvider>
    );

    return {
      ...render(ui),
      props,
      user: userEvent.setup(),
    };
  };

  it("should render correctly with provided paths", () => {
    const { props } = renderComponent();

    expect(screen.getByText(props.paths[0]!.value)).toBeTruthy();
    expect(screen.getByText(props.paths[1]!.value)).toBeTruthy();
  });

  it("should render default text when paths array is empty", () => {
    renderComponent({ paths: [] });

    expect(screen.getByText("Click to add a series")).toBeTruthy();
  });

  it("should call setFocusedPath and openPanelSettings when edit button is clicked", async () => {
    const row = 0;
    const panelId = BasicBuilder.string();
    const { user } = renderComponent({ paths: [], panelId });
    const editButton = screen.getByTestId(`edit-topic-button-${row}`);

    await user.click(editButton);

    expect(editButton).not.toBeNull();
    expect(mockSetSelectedPanelIds).toHaveBeenCalledWith([panelId]);
    expect(mockOpenPanelSettings).toHaveBeenCalled();
    expect(mockSetFocusedPath).toHaveBeenCalledWith(["paths", `${row}`]);
  });

  it("should call saveConfig with updated paths when delete button is clicked", async () => {
    const row = 0;
    const { user, props } = renderComponent();
    const deleteButton = screen.getByTestId(`delete-topic-button-${row}`);

    await user.click(deleteButton);

    expect(mockSaveConfig).toHaveBeenCalledWith({ paths: [props.paths[1]] });
  });

  it("should apply the row styling (including height) via a generated class to each topic row", () => {
    // Given a rendered legend with multiple series
    renderComponent();

    // When reading the row elements
    const firstRow = screen.getByTestId(`row-0`);
    const secondRow = screen.getByTestId(`row-1`);

    // Then height is applied through a tss-react generated class (not an inline style), and both
    // rows share the same class since they use the same heightPerTopic parameter
    expect(firstRow.getAttribute("style")).toBeNull();
    expect(firstRow.className).toBeTruthy();
    expect(firstRow.className).toBe(secondRow.className);
  });

  it("wires each row as a message-path drag source scoped to the panel", () => {
    // Given a legend rendered for a specific panel with configured series
    const panelId = BasicBuilder.string();

    // When the component renders
    const { props } = renderComponent({ panelId });

    // Then a DraggedMessagePath is built from each series' value
    expect(useDraggedMessagePath).toHaveBeenCalledWith(props.paths[0]!.value);
    expect(useDraggedMessagePath).toHaveBeenCalledWith(props.paths[1]!.value);

    // And the drag is scoped to the owning panel so it can't be dropped back onto itself
    expect(useMessagePathDrag).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePanelId: panelId, selected: false }),
    );
  });

  it("does not build a drag source for the placeholder row", () => {
    // Given a legend with no configured series (placeholder row only)
    // When the component renders
    renderComponent({ paths: [] });

    // Then no draggable path is built for the placeholder
    expect(useDraggedMessagePath).toHaveBeenCalledWith(undefined);
  });
});

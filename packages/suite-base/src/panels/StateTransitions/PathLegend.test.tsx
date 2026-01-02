/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { userEvent } from "@storybook/testing-library";
import { render, screen } from "@testing-library/react";

import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { PathLegendProps } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import { PathLegend } from "./PathLegend";

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext");
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions");

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

  it("should apply the correct height for each topic", () => {
    const { props } = renderComponent();
    const { style: firstRowStyle } = screen.getByTestId(`row-0`);
    const { style: secondRowStyle } = screen.getByTestId(`row-1`);
    const heightStyle = `height: ${props.heightPerTopic}px;`;

    expect(firstRowStyle.cssText).toContain(heightStyle);
    expect(secondRowStyle.cssText).toContain(heightStyle);
  });
});

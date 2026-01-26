/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@testing-library/jest-dom";

import SettingsTreeEditor from "@lichtblick/suite-base/components/SettingsTreeEditor";
import { SettingsTreeEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/hooks/useGlobalVariables");
jest.mock("@lichtblick/suite-base/context/PanelCatalogContext");
jest.mock("@lichtblick/suite-base/context/PanelStateContext");

jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: () => ({
    datatypes: new Map(),
    topics: [],
  }),
  useConfigById: jest.fn(() => [{}, jest.fn()]),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useSelectedPanels: jest.fn(() => ({
    selectedPanelIds: [],
    setSelectedPanelIds: jest.fn(),
  })),
}));

describe("SettingsTreeEditor", () => {
  const mockSetSelectedPanelIds = jest.fn();

  const renderComponent = async (overrides: Partial<SettingsTreeEditorProps> = {}) => {
    const defaultProps: SettingsTreeEditorProps = {
      variant: "panel",
      settings: { actionHandler: jest.fn(), nodes: {} },
      ...overrides,
    };

    const ui: React.ReactElement = (
      <SettingsTreeEditor variant={defaultProps.variant} settings={defaultProps.settings} />
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props: defaultProps,
    };
  };

  beforeEach(() => {
    (useSelectedPanels as jest.Mock).mockReturnValue({
      selectedPanelIds: [],
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
    jest.clearAllMocks();
  });

  it("should render SettingsTreeEditor, apply a filter and only show filtered nodes", async () => {
    const nodeLabel = BasicBuilder.string();
    const nodeLabel2 = BasicBuilder.string();

    const { props } = await renderComponent({
      settings: {
        actionHandler: jest.fn(),
        enableFilter: true,
        nodes: { firstNode: { label: nodeLabel }, secondNode: { label: nodeLabel2 } },
      },
    });
    const inputField = screen.getByTestId(`${props.variant}-settings-filter-input`);
    fireEvent.change(inputField, { target: { value: nodeLabel } });

    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
    expect(screen.queryByText(nodeLabel2)).not.toBeInTheDocument();
  });

  it("should filter for something and then clear the filter", async () => {
    const nodeLabel = BasicBuilder.string();

    const { props } = await renderComponent({
      settings: {
        actionHandler: jest.fn(),
        enableFilter: true,
        nodes: { firstNode: { label: nodeLabel } },
      },
    });
    const inputField = screen.getByTestId(`${props.variant}-settings-filter-input`);
    fireEvent.change(inputField, { target: { value: nodeLabel } });

    expect(inputField).toHaveValue(nodeLabel);

    const clearButton = screen.getByTestId("clear-filter-button");
    await userEvent.click(clearButton);

    expect(inputField).toHaveValue("");
  });
});

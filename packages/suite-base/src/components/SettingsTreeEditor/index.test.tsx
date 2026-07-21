/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "@testing-library/jest-dom/vitest";

import SettingsTreeEditor from "@lichtblick/suite-base/components/SettingsTreeEditor";
import { SettingsTreeEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { BasicBuilder } from "@lichtblick/test-builders";

vi.mock("@lichtblick/suite-base/hooks/useGlobalVariables");
vi.mock("@lichtblick/suite-base/context/PanelCatalogContext");
vi.mock("@lichtblick/suite-base/context/PanelStateContext");

vi.mock("@lichtblick/suite-base/PanelAPI", async () => ({
  useDataSourceInfo: () => ({
    datatypes: new Map(),
    topics: [],
  }),
  useConfigById: vi.fn(() => [{}, vi.fn()]),
}));

vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useSelectedPanels: vi.fn(() => ({
    selectedPanelIds: [],
    setSelectedPanelIds: vi.fn(),
  })),
}));

describe("SettingsTreeEditor", () => {
  const mockSetSelectedPanelIds = vi.fn();

  const renderComponent = async (overrides: Partial<SettingsTreeEditorProps> = {}) => {
    const defaultProps: SettingsTreeEditorProps = {
      variant: "panel",
      settings: { actionHandler: vi.fn(), nodes: {} },
      ...overrides,
    };

    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        <SettingsTreeEditor variant={defaultProps.variant} settings={defaultProps.settings} />
      </DndProvider>
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props: defaultProps,
    };
  };

  beforeEach(() => {
    (useSelectedPanels as Mock).mockReturnValue({
      selectedPanelIds: [],
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
    vi.clearAllMocks();
  });

  it("should render SettingsTreeEditor, apply a filter and only show filtered nodes", async () => {
    const nodeLabel = BasicBuilder.string();
    const nodeLabel2 = BasicBuilder.string();

    const { props } = await renderComponent({
      settings: {
        actionHandler: vi.fn(),
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
        actionHandler: vi.fn(),
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

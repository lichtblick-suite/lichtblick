/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

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
  const scrollIntoViewMock = jest.fn();

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  const renderComponent = async (overrides: Partial<SettingsTreeEditorProps> = {}) => {
    const defaultProps: SettingsTreeEditorProps = {
      variant: "panel",
      settings: { actionHandler: jest.fn(), nodes: {} },
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

  describe("Component Rendering", () => {
    describe("given a basic settings tree editor", () => {
      it("should render the component with data-testid", async () => {
        // when
        await renderComponent();

        // then
        expect(screen.getByTestId("settings-tree-editor")).toBeInTheDocument();
      });

      it("should render with panel variant by default", async () => {
        // when
        await renderComponent({ variant: "panel" });

        // then
        expect(screen.getByTestId("settings-tree-editor")).toBeInTheDocument();
      });

      it("should render with log variant", async () => {
        // when
        await renderComponent({ variant: "log" });

        // then
        expect(screen.getByTestId("settings-tree-editor")).toBeInTheDocument();
      });
    });

    describe("given filter is enabled", () => {
      it("should render the search input field", async () => {
        // given
        const variant = "panel";

        // when
        const { props } = await renderComponent({
          variant,
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {},
          },
        });

        // then
        expect(screen.getByTestId(`${props.variant}-settings-filter-input`)).toBeInTheDocument();
      });

      it("should render search icon in the input field", async () => {
        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {},
          },
        });

        // then
        const searchIcon = screen.getByTestId("SearchIcon");
        expect(searchIcon).toBeInTheDocument();
      });

      it("should not render clear button when filter is empty", async () => {
        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {},
          },
        });

        // then
        expect(screen.queryByTestId("clear-filter-button")).not.toBeInTheDocument();
      });

      it("should render clear button when filter has text", async () => {
        // given
        const filterText = BasicBuilder.string();

        // when
        const { props } = await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {},
          },
        });

        const inputField = screen.getByTestId(`${props.variant}-settings-filter-input`);
        fireEvent.change(inputField, { target: { value: filterText } });

        // then
        expect(screen.getByTestId("clear-filter-button")).toBeInTheDocument();
      });
    });

    describe("given filter is disabled", () => {
      it("should not render the search input field", async () => {
        // when
        const { props } = await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: false,
            nodes: {},
          },
        });

        // then
        expect(
          screen.queryByTestId(`${props.variant}-settings-filter-input`),
        ).not.toBeInTheDocument();
      });
    });

    describe("given nodes are provided", () => {
      it("should render single node", async () => {
        // given
        const nodeLabel = BasicBuilder.string();

        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            nodes: {
              testNode: { label: nodeLabel },
            },
          },
        });

        // then
        expect(screen.getByText(nodeLabel)).toBeInTheDocument();
      });

      it("should render multiple nodes", async () => {
        // given
        const nodeLabels = BasicBuilder.strings({ count: 3 });

        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            nodes: {
              node1: { label: nodeLabels[0] },
              node2: { label: nodeLabels[1] },
              node3: { label: nodeLabels[2] },
            },
          },
        });

        // then
        nodeLabels.forEach((label) => {
          expect(screen.getByText(label)).toBeInTheDocument();
        });
      });

      it("should render nodes with default expansion state collapsed", async () => {
        // given
        const parentLabel = BasicBuilder.string();
        const childLabel = BasicBuilder.string();

        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            nodes: {
              parent: {
                label: parentLabel,
                defaultExpansionState: "collapsed",
                children: {
                  child: { label: childLabel },
                },
              },
            },
          },
        });

        // then
        expect(screen.getByText(parentLabel)).toBeInTheDocument();
        expect(screen.queryByText(childLabel)).not.toBeInTheDocument();
      });
    });

    describe("given no nodes are provided", () => {
      it("should render empty tree", async () => {
        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            nodes: {},
          },
        });

        // then
        expect(screen.getByTestId("settings-tree-editor")).toBeInTheDocument();
      });
    });

    describe("given panel is selected with custom title", () => {
      it("should not render title field when hasCustomToolbar is true", async () => {
        // given
        const panelId = BasicBuilder.string();
        const customTitle = BasicBuilder.string();

        (useSelectedPanels as jest.Mock).mockReturnValue({
          selectedPanelIds: [panelId],
          setSelectedPanelIds: jest.fn(),
        });

        const { useConfigById } = await import("@lichtblick/suite-base/PanelAPI");
        const { usePanelCatalog } = await import(
          "@lichtblick/suite-base/context/PanelCatalogContext"
        );

        (useConfigById as jest.Mock).mockReturnValue([
          { general: { title: customTitle } },
          jest.fn(),
        ]);
        (usePanelCatalog as jest.Mock).mockReturnValue({
          getPanelByType: jest.fn(() => ({
            title: "Default Title",
            hasCustomToolbar: true,
          })),
        });

        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            nodes: {},
          },
        });

        // then
        expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
      });

      it("should not render title field for log variant", async () => {
        // given
        const panelId = BasicBuilder.string();

        (useSelectedPanels as jest.Mock).mockReturnValue({
          selectedPanelIds: [panelId],
          setSelectedPanelIds: jest.fn(),
        });

        // when
        await renderComponent({
          variant: "log",
          settings: {
            actionHandler: jest.fn(),
            nodes: {},
          },
        });

        // then
        expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
      });
    });

    describe("given focused path is provided", () => {
      it("should render with focused path", async () => {
        // given
        const nodeLabel = BasicBuilder.string();
        const focusedPath = [BasicBuilder.string()];

        // when
        await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            focusedPath,
            nodes: {
              testNode: { label: nodeLabel },
            },
          },
        });

        // then
        expect(screen.getByText(nodeLabel)).toBeInTheDocument();
      });
    });

    describe("given filter text is applied", () => {
      it("should filter and display only matching nodes", async () => {
        // given
        const matchingLabel = "Test Match";
        const nonMatchingLabel = BasicBuilder.string();

        // when
        const { props } = await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {
              node1: { label: matchingLabel },
              node2: { label: nonMatchingLabel },
            },
          },
        });

        const inputField = screen.getByTestId(`${props.variant}-settings-filter-input`);
        fireEvent.change(inputField, { target: { value: "Match" } });

        // then
        // Text is split by highlighting, check for parts
        expect(screen.getByText("Test")).toBeInTheDocument();
        expect(screen.getByText("Match")).toBeInTheDocument();
        expect(screen.queryByText(nonMatchingLabel)).not.toBeInTheDocument();
      });

      it("should show all nodes when filter is cleared", async () => {
        // given
        const label1 = BasicBuilder.string();
        const label2 = BasicBuilder.string();

        // when
        const { props } = await renderComponent({
          settings: {
            actionHandler: jest.fn(),
            enableFilter: true,
            nodes: {
              node1: { label: label1 },
              node2: { label: label2 },
            },
          },
        });

        const inputField = screen.getByTestId(`${props.variant}-settings-filter-input`);
        fireEvent.change(inputField, { target: { value: label1 } });

        expect(screen.getByText(label1)).toBeInTheDocument();
        expect(screen.queryByText(label2)).not.toBeInTheDocument();

        // Clear filter
        fireEvent.change(inputField, { target: { value: "" } });

        // then
        expect(screen.getByText(label1)).toBeInTheDocument();
        expect(screen.getByText(label2)).toBeInTheDocument();
      });
    });
  });
});

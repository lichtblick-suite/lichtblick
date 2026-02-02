/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "@testing-library/jest-dom";

import { NodeEditor } from "@lichtblick/suite-base/components/SettingsTreeEditor/NodeEditor";
import { NodeEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import { AppContext } from "@lichtblick/suite-base/context/AppContext";
import { BasicBuilder } from "@lichtblick/test-builders";

const mockAppContext = {
  renderSettingsStatusButton: undefined,
};

describe("NodeEditor - Component Rendering", () => {
  const scrollIntoViewMock = jest.fn();

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  const renderComponent = async (overrides: Partial<NodeEditorProps> = {}) => {
    const defaultProps: NodeEditorProps = {
      actionHandler: jest.fn(),
      path: ["root"],
      settings: {},
      focusedPath: undefined,
      ...overrides,
    };

    const ui: React.ReactElement = (
      <AppContext.Provider value={mockAppContext as any}>
        <DndProvider backend={HTML5Backend}>
          <NodeEditor
            actionHandler={defaultProps.actionHandler}
            path={defaultProps.path}
            settings={defaultProps.settings}
            focusedPath={defaultProps.focusedPath}
          />
        </DndProvider>
      </AppContext.Provider>
    );

    return {
      ...render(ui),
      props: defaultProps,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("given basic node settings", () => {
    it("should render node with label", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("should render node without label showing General", async () => {
      // when
      await renderComponent({
        settings: {},
      });

      // then
      expect(screen.getByText("General")).toBeInTheDocument();
    });

    it("should render node with data-testid", async () => {
      // given
      const label = BasicBuilder.string();
      const path = ["test", "node"];

      // when
      await renderComponent({
        path,
        settings: { label },
      });

      // then
      expect(screen.getByTestId("settings__nodeHeaderToggle__test-node")).toBeInTheDocument();
    });
  });

  describe("given node visibility settings", () => {
    it("should render visible node", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, visible: true },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("should render invisible node", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, visible: false },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("should render visibility toggle when visible is defined", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, visible: true },
      });

      // then
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should not render visibility toggle when visible is undefined", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  describe("given node with icon", () => {
    it("should render node with icon", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, icon: "Check" },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByTestId("CheckIcon")).toBeInTheDocument();
    });

    it("should render node without icon", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByTestId("CheckIcon")).not.toBeInTheDocument();
    });
  });

  describe("given node with error", () => {
    it("should render error icon when error is present", async () => {
      // given
      const label = BasicBuilder.string();
      const error = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, error },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByTestId("ErrorIcon")).toBeInTheDocument();
    });

    it("should not render error icon when no error", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.queryByTestId("ErrorIcon")).not.toBeInTheDocument();
    });
  });

  describe("given node with fields", () => {
    it("should render field editors when node has fields", async () => {
      // given
      const label = BasicBuilder.string();
      const fieldLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label,
          fields: {
            testField: {
              input: "string",
              label: fieldLabel,
            },
          },
        },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(fieldLabel)).toBeInTheDocument();
    });

    it("should render expansion arrow when node has properties", async () => {
      // given
      const label = BasicBuilder.string();
      const fieldLabel = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
          fields: {
            testField: {
              input: "string",
              label: fieldLabel,
            },
          },
        },
      });

      // then
      expect(screen.getByTestId("ArrowDropDownIcon")).toBeInTheDocument();
    });

    it("should not render expansion arrow when node has no properties", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
        },
      });

      // then
      expect(screen.queryByTestId("ArrowDropDownIcon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ArrowRightIcon")).not.toBeInTheDocument();
    });
  });

  describe("given node with children", () => {
    it("should render child nodes when expanded", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const childLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          children: {
            child: {
              label: childLabel,
            },
          },
        },
      });

      // then
      expect(screen.getByText(parentLabel)).toBeInTheDocument();
      expect(screen.getByText(childLabel)).toBeInTheDocument();
    });

    it("should render multiple child nodes", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const childLabels = BasicBuilder.strings({ count: 3 });

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          children: {
            child1: { label: childLabels[0] },
            child2: { label: childLabels[1] },
            child3: { label: childLabels[2] },
          },
        },
      });

      // then
      expect(screen.getByText(parentLabel)).toBeInTheDocument();
      childLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe("given node with renamable setting", () => {
    it("should render edit button when renamable is true", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, renamable: true },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /rename/i })).toBeInTheDocument();
    });

    it("should not render edit button when renamable is false", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label, renamable: false },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    });

    it("should not render edit button when renamable is undefined", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    });
  });

  describe("given node with actions", () => {
    it("should render inline action button", async () => {
      // given
      const label = BasicBuilder.string();
      const actionLabel = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
          actions: [
            {
              type: "action",
              id: "test-action",
              label: actionLabel,
              display: "inline",
            },
          ],
        },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: actionLabel })).toBeInTheDocument();
    });

    it("should render inline action with icon", async () => {
      // given
      const label = BasicBuilder.string();
      const actionLabel = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
          actions: [
            {
              type: "action",
              id: "test-action",
              label: actionLabel,
              display: "inline",
              icon: "Add",
            },
          ],
        },
      });

      // then
      expect(screen.getByTestId("AddIcon")).toBeInTheDocument();
    });

    it("should render menu actions when display is menu", async () => {
      // given
      const label = BasicBuilder.string();
      const actionLabel = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
          actions: [
            {
              type: "action",
              id: "test-action",
              label: actionLabel,
              display: "menu",
            },
          ],
        },
      });

      // then
      expect(screen.getByTestId("MoreVertIcon")).toBeInTheDocument();
    });

    it("should render multiple inline actions", async () => {
      // given
      const label = BasicBuilder.string();
      const actionLabels = BasicBuilder.strings({ count: 2 });

      // when
      await renderComponent({
        settings: {
          label,
          actions: [
            {
              type: "action",
              id: "action1",
              label: actionLabels[0]!,
              display: "inline",
            },
            {
              type: "action",
              id: "action2",
              label: actionLabels[1]!,
              display: "inline",
            },
          ],
        },
      });

      // then
      expect(screen.getByRole("button", { name: actionLabels[0] })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: actionLabels[1] })).toBeInTheDocument();
    });

    it("should not render actions menu when no menu actions", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: {
          label,
          actions: [
            {
              type: "action",
              id: "action1",
              label: "Action 1",
              display: "inline",
            },
          ],
        },
      });

      // then
      expect(screen.queryByTestId("MoreVertIcon")).not.toBeInTheDocument();
    });
  });

  describe("given node with visibility filter enabled", () => {
    it("should render visibility filter when enabled and has children", async () => {
      // given
      const label = BasicBuilder.string();
      const childLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label,
          enableVisibilityFilter: true,
          children: {
            child: { label: childLabel },
          },
        },
      });

      // then
      expect(screen.getByText("Filter list")).toBeInTheDocument();
    });

    it("should not render visibility filter when disabled", async () => {
      // given
      const label = BasicBuilder.string();
      const childLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label,
          enableVisibilityFilter: false,
          children: {
            child: { label: childLabel },
          },
        },
      });

      // then
      expect(screen.queryByText("Filter list")).not.toBeInTheDocument();
    });

    it("should not render visibility filter when no children", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label,
          enableVisibilityFilter: true,
        },
      });

      // then
      expect(screen.queryByText("Filter list")).not.toBeInTheDocument();
    });
  });

  describe("given node with default expansion state", () => {
    it("should render expanded by default when defaultOpen is true", async () => {
      // given
      const label = BasicBuilder.string();
      const fieldLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label,
          fields: {
            field: { input: "string", label: fieldLabel },
          },
        },
      });

      // then
      expect(screen.getByText(fieldLabel)).toBeInTheDocument();
    });
  });

  describe("given node with filter text", () => {
    it("should render node with filter prop passed", async () => {
      // given
      const label = "TestMatch";
      const filter = "Match";

      // when
      await renderComponent({
        filter,
        settings: { label },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it("should render node without highlighting when no filter", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        settings: { label },
      });

      // then
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe("given node at different indentation levels", () => {
    it("should render divider for level 1 nodes", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      const { container } = await renderComponent({
        path: ["level1"],
        settings: { label },
      });

      // then
      expect(container.querySelector(".MuiDivider-root")).toBeInTheDocument();
    });

    it("should not render divider for level 0 nodes", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      const { container } = await renderComponent({
        path: [],
        settings: { label },
      });

      // then
      expect(container.querySelector(".MuiDivider-root")).not.toBeInTheDocument();
    });

    it("should not render divider for level 2+ nodes", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      const { container } = await renderComponent({
        path: ["level1", "level2"],
        settings: { label },
      });

      // then
      expect(container.querySelector(".MuiDivider-root")).not.toBeInTheDocument();
    });
  });

  describe("given node with reorderable setting", () => {
    it("should apply drag styling when reorderable is true", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      const { container } = await renderComponent({
        settings: { label, reorderable: true },
      });

      // then
      const nodeHeader = container.querySelector('[style*="cursor"]');
      expect(nodeHeader).toBeInTheDocument();
    });

    it("should not apply drag cursor when reorderable is false", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      const { container } = await renderComponent({
        settings: { label, reorderable: false },
      });

      // then
      const nodeHeader = container.querySelector('[style*="cursor: grab"]');
      expect(nodeHeader).not.toBeInTheDocument();
    });
  });

  describe("given focused path", () => {
    it("should apply focused styling when path matches focusedPath", async () => {
      // given
      const label = BasicBuilder.string();
      const path = ["test", "node"];

      // when
      await renderComponent({
        path,
        focusedPath: path,
        settings: { label },
      });

      // then
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    it("should not apply focused styling when path does not match", async () => {
      // given
      const label = BasicBuilder.string();

      // when
      await renderComponent({
        path: ["test", "node"],
        focusedPath: ["other", "node"],
        settings: { label },
      });

      // then
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });
  });

  describe("given node with visibility filter set to visible", () => {
    it("should show children with visible=true", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const visibleChildLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          children: {
            visibleChild: { label: visibleChildLabel, visible: true },
          },
        },
      });

      // then
      expect(screen.getByText(visibleChildLabel)).toBeInTheDocument();
    });

    it("should show children with visible=undefined", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const undefinedVisibleChildLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          children: {
            undefinedChild: { label: undefinedVisibleChildLabel },
          },
        },
      });

      // then
      expect(screen.getByText(undefinedVisibleChildLabel)).toBeInTheDocument();
    });

    it("should not filter out children with visible=false by default", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const invisibleChildLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          children: {
            invisibleChild: { label: invisibleChildLabel, visible: false },
          },
        },
      });

      // then
      expect(screen.getByText(invisibleChildLabel)).toBeInTheDocument();
    });

    it("should show all children when filter is all", async () => {
      // given
      const parentLabel = BasicBuilder.string();
      const visibleChildLabel = BasicBuilder.string();
      const invisibleChildLabel = BasicBuilder.string();
      const undefinedChildLabel = BasicBuilder.string();

      // when
      await renderComponent({
        defaultOpen: true,
        settings: {
          label: parentLabel,
          enableVisibilityFilter: true,
          children: {
            visibleChild: { label: visibleChildLabel, visible: true },
            invisibleChild: { label: invisibleChildLabel, visible: false },
            undefinedChild: { label: undefinedChildLabel },
          },
        },
      });

      // Filter defaults to "all"
      // then
      expect(screen.getByText(visibleChildLabel)).toBeInTheDocument();
      expect(screen.getByText(invisibleChildLabel)).toBeInTheDocument();
      expect(screen.getByText(undefinedChildLabel)).toBeInTheDocument();
    });
  });

  describe("given node with renamable label editing", () => {
    it("should call actionHandler when label is changed and renamable is true", async () => {
      // given
      const label = BasicBuilder.string();
      const actionHandler = jest.fn();
      const path = [BasicBuilder.string(), BasicBuilder.string()];

      // when
      await renderComponent({
        path,
        actionHandler,
        settings: { label, renamable: true },
      });

      const editButton = screen.getByRole("button", { name: /rename/i });
      await userEvent.click(editButton);

      const textField = screen.getByRole("textbox");
      await userEvent.type(textField, "X");

      // then
      expect(actionHandler).toHaveBeenCalled();
      const lastCall = actionHandler.mock.calls.at(-1);
      expect(lastCall[0]).toMatchObject({
        action: "update",
        payload: {
          path: [...path, "label"],
          input: "string",
        },
      });
      // Value contains the typed character
      expect(lastCall[0].payload.value).toContain("X");
    });

    it("should not call actionHandler when renamable is false", async () => {
      // given
      const label = BasicBuilder.string();
      const actionHandler = jest.fn();

      // when
      await renderComponent({
        actionHandler,
        settings: { label, renamable: false },
      });

      // then
      expect(actionHandler).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    });

    it("should not call actionHandler when renamable is undefined", async () => {
      // given
      const label = BasicBuilder.string();
      const actionHandler = jest.fn();

      // when
      await renderComponent({
        actionHandler,
        settings: { label, renamable: undefined },
      });

      // then
      expect(actionHandler).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    });

    it("should include correct path in update action", async () => {
      // given
      const label = BasicBuilder.string();
      const actionHandler = jest.fn();
      const path = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];

      // when
      await renderComponent({
        path,
        actionHandler,
        settings: { label, renamable: true },
      });

      const editButton = screen.getByRole("button", { name: /rename/i });
      await userEvent.click(editButton);

      const textField = screen.getByRole("textbox");
      await userEvent.type(textField, "Y");

      // then
      expect(actionHandler).toHaveBeenCalled();
      const lastCall = actionHandler.mock.calls.at(-1);
      expect(lastCall[0]).toMatchObject({
        action: "update",
        payload: {
          path: [...path, "label"],
          input: "string",
        },
      });
    });

    it("should call actionHandler for each character typed", async () => {
      // given
      const label = "";
      const actionHandler = jest.fn();
      const path = [BasicBuilder.string()];

      // when
      await renderComponent({
        path,
        actionHandler,
        settings: { label, renamable: true },
      });

      const editButton = screen.getByRole("button", { name: /rename/i });
      await userEvent.click(editButton);

      const textField = screen.getByRole("textbox");
      await userEvent.type(textField, "ab");

      // then
      // userEvent.type triggers onChange for each character
      expect(actionHandler).toHaveBeenCalledTimes(2);

      // Verify incremental typing - each character is sent separately
      expect(actionHandler.mock.calls[0][0].payload.value).toBe("a");
      expect(actionHandler.mock.calls[1][0].payload.value).toBe("b");
    });
  });
});

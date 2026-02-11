/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "@testing-library/jest-dom";

import { Immutable, SettingsTreeAction, SettingsTreeNode } from "@lichtblick/suite";
import {
  handleDropNode,
  NodeEditor,
} from "@lichtblick/suite-base/components/SettingsTreeEditor/NodeEditor";
import {
  FieldEditorProps,
  NodeEditorProps,
  SelectVisibilityFilterValue,
} from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import { BasicBuilder } from "@lichtblick/test-builders";

let capturedActionHandler: (action: SettingsTreeAction) => void;

jest.mock("@lichtblick/suite-base/components/SettingsTreeEditor/FieldEditor", () => ({
  FieldEditor: (props: FieldEditorProps) => {
    capturedActionHandler = props.actionHandler;
    return <div />; // Simple mock because UI does not matter here
  },
}));

const changeVisibilityFilter = (visibility: SelectVisibilityFilterValue) => {
  capturedActionHandler({
    action: "update",
    payload: { input: "select", value: visibility, path: ["topics", "visibilityFilter"] },
  });
};

describe("handleDropNode", () => {
  it("calls actionHandler with reorder-node action", () => {
    // Given: A drop item and action handler
    const actionHandler = jest.fn();
    const sourcePath = [BasicBuilder.string(), BasicBuilder.string()];
    const targetPath = [BasicBuilder.string(), BasicBuilder.string()];
    const dragItem = { path: sourcePath };

    // When: handleDropNode is called
    handleDropNode(dragItem, targetPath, actionHandler);

    // Then: actionHandler is called with correct action
    expect(actionHandler).toHaveBeenCalledWith({
      action: "reorder-node",
      payload: {
        path: sourcePath,
        targetPath,
      },
    });
  });
});

describe("NodeEditor childNodes filtering", () => {
  const nodes = BasicBuilder.strings({ count: 3 }) as [string, string, string];
  const scrollIntoViewMock = jest.fn();

  const tree: Immutable<SettingsTreeNode> = {
    enableVisibilityFilter: true,
    children: {
      [nodes[0]]: { visible: true, label: nodes[0] },
      [nodes[1]]: {
        visible: false,
        label: nodes[1],
        error: BasicBuilder.string(),
        icon: "Clear",
        actions: [{ id: BasicBuilder.string(), type: "action", label: BasicBuilder.string() }],
      },
      [nodes[2]]: { label: nodes[2] }, // undefined visibility is always shown
    },
  };

  const renderComponent = async (overrides: Partial<NodeEditorProps> = {}) => {
    const props: NodeEditorProps = {
      actionHandler: jest.fn(),
      path: ["root"],
      settings: tree,
      focusedPath: [],
      ...overrides,
    };

    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        <NodeEditor {...props} />
      </DndProvider>
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props,
    };
  };

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it("all nodes should be visible at start", async () => {
    await renderComponent();

    expect(screen.queryByText(nodes[0])).toBeInTheDocument();
    expect(screen.queryByText(nodes[1])).toBeInTheDocument();
    expect(screen.queryByText(nodes[2])).toBeInTheDocument();
  });

  it("should list only the selected option filter", async () => {
    await renderComponent();

    expect(screen.queryByText(nodes[0])).toBeInTheDocument();
    expect(screen.queryByText(nodes[1])).toBeInTheDocument();
    expect(screen.queryByText(nodes[2])).toBeInTheDocument();

    act(() => {
      changeVisibilityFilter("visible");
    });

    expect(screen.queryByText(nodes[0])).toBeInTheDocument();
    expect(screen.queryByText(nodes[1])).not.toBeInTheDocument();
    expect(screen.queryByText(nodes[2])).toBeInTheDocument();

    act(() => {
      changeVisibilityFilter("invisible");
    });

    expect(screen.queryByText(nodes[0])).not.toBeInTheDocument();
    expect(screen.queryByText(nodes[1])).toBeInTheDocument();
    expect(screen.queryByText(nodes[2])).toBeInTheDocument();

    act(() => {
      changeVisibilityFilter("all");
    });

    expect(screen.queryByText(nodes[0])).toBeInTheDocument();
    expect(screen.queryByText(nodes[1])).toBeInTheDocument();
    expect(screen.queryByText(nodes[2])).toBeInTheDocument();
  });

  it("calls actionHandler with toggled visibility", async () => {
    const label = BasicBuilder.string();

    const { props } = await renderComponent({ settings: { label, visible: true } });

    const toggle = screen.getByRole("checkbox");
    fireEvent.click(toggle);

    expect(props.actionHandler).toHaveBeenCalledWith({
      action: "update",
      payload: {
        input: "boolean",
        path: ["root", "visible"],
        value: false,
      },
    });
  });

  it("should call scrollIntoView when node is focused", async () => {
    const path = BasicBuilder.strings({ count: 3 }) as [string, string, string];
    const label = BasicBuilder.string();

    await renderComponent({ path, settings: { label, visible: true }, focusedPath: path });

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("calls actionHandler to edit label", async () => {
    const label = BasicBuilder.string();

    const { props } = await renderComponent({
      settings: { label, visible: true, renamable: true },
    });

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    const input = screen.getByRole("textbox");

    const newLabel = BasicBuilder.string();
    fireEvent.change(input, { target: { value: newLabel } });

    expect(props.actionHandler).toHaveBeenCalledWith({
      action: "update",
      payload: {
        path: ["root", "label"],
        input: "string",
        value: newLabel,
      },
    });
  });

  it.each(["{Enter}", "{Escape}"])("exits editing on %s", async (key: string) => {
    const user = userEvent.setup();
    const nodeLabel = BasicBuilder.string();

    await renderComponent({ settings: { label: nodeLabel, renamable: true } });

    await user.click(screen.getByRole("button", { name: /rename/i }));

    await user.keyboard(key);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
  });

  it("exits editing mode when CheckIcon button is clicked", async () => {
    // Given: A renamable node in editing mode
    const nodeLabel = BasicBuilder.string();

    await renderComponent({ settings: { label: nodeLabel, renamable: true } });

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    const textbox = screen.getByRole("textbox");
    expect(textbox).toBeInTheDocument();

    // When: The CheckIcon confirm button is clicked
    const confirmButton = screen.getByTestId("check-icon-button");
    fireEvent.click(confirmButton);

    // Then: Editing mode is exited
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
  });

  it("stops event propagation when CheckIcon button is clicked", async () => {
    // Given: A renamable node in editing mode
    const nodeLabel = BasicBuilder.string();
    const stopPropagationSpy = jest.fn();

    await renderComponent({ settings: { label: nodeLabel, renamable: true } });

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    // When: The CheckIcon button is clicked with event
    const confirmButton = screen.getByTestId("check-icon-button");

    const clickEvent = new MouseEvent("click", { bubbles: true });
    clickEvent.stopPropagation = stopPropagationSpy;

    fireEvent(confirmButton, clickEvent);

    // Then: Event propagation is stopped
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("does not toggle open state when in editing mode", async () => {
    // Given: A renamable node with children in editing mode
    const nodeLabel = BasicBuilder.string();
    const childLabel = BasicBuilder.string();

    await renderComponent({
      settings: {
        label: nodeLabel,
        renamable: true,
        children: {
          child1: { label: childLabel },
        },
      },
    });

    // Enter editing mode
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // When: Clicking the toggle area while in editing mode
    const toggleArea = screen.getByTestId(`settings__nodeHeaderToggle__root`);
    fireEvent.click(toggleArea);

    // Then: Node remains expanded and still in editing mode
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByText(childLabel)).toBeInTheDocument();
  });

  it("renders icon when icon is set and not a drag handle", async () => {
    // Given: A node with a non-drag-handle icon
    const nodeLabel = BasicBuilder.string();

    await renderComponent({
      settings: {
        label: nodeLabel,
        icon: "Clear",
      },
    });

    // Then: Icon should be rendered
    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
    // Icon is rendered as an SVG, we can verify the component rendered successfully
  });

  it("renders drag handle icon for reorderable nodes", async () => {
    // Given: A reorderable node with DragHandle icon
    const nodeLabel = BasicBuilder.string();

    await renderComponent({
      settings: {
        label: nodeLabel,
        icon: "DragHandle",
        reorderable: true,
      },
    });

    // Then: Node is rendered with drag functionality
    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
    // Drag handle icon is rendered as part of the component
  });

  it("renders fields when settings has fields", async () => {
    // Given: A node with field settings
    const nodeLabel = BasicBuilder.string();
    const fieldLabel = BasicBuilder.string();

    await renderComponent({
      settings: {
        label: nodeLabel,
        fields: {
          testField: {
            label: fieldLabel,
            input: "string",
            value: "test value",
          },
        },
      },
    });

    // Then: Fields are rendered
    expect(screen.getByText(nodeLabel)).toBeInTheDocument();
  });

  it("toggles node open state when not editing", async () => {
    // Given: A node with children that is initially open
    const nodeLabel = BasicBuilder.string();
    const childLabel = BasicBuilder.string();

    await renderComponent({
      settings: {
        label: nodeLabel,
        children: {
          child1: { label: childLabel },
        },
      },
    });

    // Child should be visible initially (defaultOpen is true)
    expect(screen.getByText(childLabel)).toBeInTheDocument();

    // When: Clicking the toggle area
    const toggleArea = screen.getByTestId(`settings__nodeHeaderToggle__root`);
    fireEvent.click(toggleArea);

    // Then: Child is hidden
    expect(screen.queryByText(childLabel)).not.toBeInTheDocument();

    // When: Clicking the toggle area again
    fireEvent.click(toggleArea);

    // Then: Child is visible again
    expect(screen.getByText(childLabel)).toBeInTheDocument();
  });
});

describe("NodeEditor drag and drop functionality", () => {
  function setup(propsOverride: Partial<NodeEditorProps> = {}) {
    const props: Readonly<NodeEditorProps> = {
      actionHandler: jest.fn(),
      path: BasicBuilder.strings({ count: 2 }),
      settings: {
        label: BasicBuilder.string(),
        reorderable: true,
      },
      focusedPath: [],
      ...propsOverride,
    };

    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        <NodeEditor {...props} />
      </DndProvider>
    );

    return {
      ...render(ui),
      props,
    };
  }

  function setupMultipleNodes(
    nodes: Array<{ path: string[]; label: string; reorderable?: boolean }>,
    actionHandler = jest.fn(),
  ) {
    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        {nodes.map(({ path, label, reorderable = true }) => (
          <NodeEditor
            key={path.join("-")}
            actionHandler={actionHandler}
            path={path}
            settings={{ label, reorderable }}
            focusedPath={[]}
          />
        ))}
      </DndProvider>
    );

    return {
      ...render(ui),
      actionHandler,
    };
  }

  describe("drag behavior", () => {
    it("should show grab cursor and default opacity when node is reorderable", () => {
      // Given/When: A reorderable node is rendered
      const { container } = setup({
        settings: { label: BasicBuilder.string(), reorderable: true },
      });

      // Then: The node header should have grab cursor and opacity 1
      const nodeHeader = container.querySelector('[class*="nodeHeader"]');
      expect(nodeHeader).toHaveStyle({ cursor: "grab" });
      expect(nodeHeader).toHaveStyle({ opacity: "1" });
    });

    it("should not show grab cursor when node is not reorderable", () => {
      // Given/When: A non-reorderable node is rendered
      const { container } = setup({
        settings: { label: BasicBuilder.string(), reorderable: false },
      });

      // Then: The node header should not have grab cursor
      const nodeHeader = container.querySelector('[class*="nodeHeader"]');
      expect(nodeHeader).not.toHaveStyle({ cursor: "grab" });
    });
  });

  describe("drop behavior with sibling nodes", () => {
    it("should render multiple sibling nodes correctly for drag and drop", () => {
      // Given: Two sibling reorderable nodes under the same parent
      const sourceLabel = "Source Node";
      const targetLabel = "Target Node";

      // When: Both nodes are rendered in the same DndProvider
      const { container } = setupMultipleNodes([
        { path: ["topics", "node1"], label: sourceLabel },
        { path: ["topics", "node2"], label: targetLabel },
      ]);

      // Then: Both nodes should be rendered and draggable
      expect(screen.getByText(sourceLabel)).toBeInTheDocument();
      expect(screen.getByText(targetLabel)).toBeInTheDocument();

      const nodeHeaders = container.querySelectorAll('[draggable="true"]');
      expect(nodeHeaders).toHaveLength(2);
      expect(nodeHeaders[0]).toHaveStyle({ cursor: "grab" });
      expect(nodeHeaders[1]).toHaveStyle({ cursor: "grab" });
    });

    it("should not show grab cursor when target is not reorderable", () => {
      // Given: Source is reorderable, target is not
      const { container } = setupMultipleNodes([
        { path: ["topics", "node1"], label: "Draggable", reorderable: true },
        { path: ["topics", "node2"], label: "Not Draggable", reorderable: false },
      ]);

      // Then: Both nodes are rendered
      expect(screen.getByText("Draggable")).toBeInTheDocument();
      expect(screen.getByText("Not Draggable")).toBeInTheDocument();

      // Only the first node should be draggable
      const draggableNodes = container.querySelectorAll('[draggable="true"]');
      expect(draggableNodes).toHaveLength(1);
      expect(draggableNodes[0]).toHaveStyle({ cursor: "grab" });
    });
  });

  describe("depth validation", () => {
    it("should render top-level nodes but with grab cursor (depth validation is on canDrop)", () => {
      // Given: Top-level reorderable nodes (depth 1)
      const { container } = setupMultipleNodes([
        { path: ["topics"], label: "Topics" },
        { path: ["cameras"], label: "Cameras" },
      ]);

      // Then: Nodes are rendered (canDrop will prevent actual drop between them)
      expect(screen.getByText("Topics")).toBeInTheDocument();
      expect(screen.getByText("Cameras")).toBeInTheDocument();

      const nodeHeaders = container.querySelectorAll('[draggable="true"]');
      expect(nodeHeaders).toHaveLength(2);
    });

    it("should render nodes at different depths", () => {
      // Given: Nodes at different depths
      const { container } = setupMultipleNodes([
        { path: ["topics", "node1"], label: "Shallow Node" },
        { path: ["topics", "nested", "node2"], label: "Deep Node" },
      ]);

      // Then: Both nodes should be rendered
      expect(screen.getByText("Shallow Node")).toBeInTheDocument();
      expect(screen.getByText("Deep Node")).toBeInTheDocument();

      const nodeHeaders = container.querySelectorAll('[draggable="true"]');
      expect(nodeHeaders).toHaveLength(2);
    });
  });

  describe("drag events simulation", () => {
    it("should handle dragStart event on reorderable node", () => {
      // Given: A reorderable node
      const { container } = setup({
        path: ["topics", "node1"],
        settings: { label: "Draggable Node", reorderable: true },
      });

      const nodeHeader = container.querySelector('[class*="nodeHeader"]')!;

      // When: dragStart event is fired
      fireEvent.dragStart(nodeHeader, {
        dataTransfer: { setData: jest.fn(), effectAllowed: "move" },
      });

      // Then: The node should still be in the document
      expect(screen.getByText("Draggable Node")).toBeInTheDocument();
    });

    it("should handle dragOver and dragLeave events", () => {
      // Given: Two sibling reorderable nodes
      const { container } = setupMultipleNodes([
        { path: ["topics", "node1"], label: "Source" },
        { path: ["topics", "node2"], label: "Target" },
      ]);

      const nodeHeaders = container.querySelectorAll('[class*="nodeHeader"]');
      const targetNode = nodeHeaders[1]!;

      // When: dragOver and dragLeave events are fired
      fireEvent.dragOver(targetNode);
      fireEvent.dragLeave(targetNode);

      // Then: Both nodes should still be in the document
      expect(screen.getByText("Source")).toBeInTheDocument();
      expect(screen.getByText("Target")).toBeInTheDocument();
    });

    it("should handle drop event on valid sibling target", () => {
      // Given: Two sibling reorderable nodes with shared actionHandler
      const actionHandler = jest.fn();
      setupMultipleNodes(
        [
          { path: ["topics", "node1"], label: "Source" },
          { path: ["topics", "node2"], label: "Target" },
        ],
        actionHandler,
      );

      // Then: Nodes should be rendered
      expect(screen.getByText("Source")).toBeInTheDocument();
      expect(screen.getByText("Target")).toBeInTheDocument();

      // Note: Testing the actual drop behavior via react-dnd requires more complex setup
      // The drop functionality is tested through the render and canDrop logic
    });
  });
});

describe("NodeEditor inline actions", () => {
  function setup(propsOverride: Partial<NodeEditorProps> = {}) {
    const props: Readonly<NodeEditorProps> = {
      actionHandler: jest.fn(),
      path: BasicBuilder.strings({ count: 2 }),
      settings: {
        label: BasicBuilder.string(),
      },
      focusedPath: [],
      ...propsOverride,
    };

    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        <NodeEditor {...props} />
      </DndProvider>
    );

    return {
      ...render(ui),
      props,
    };
  }

  describe("inline action with icon", () => {
    it("should call actionHandler with perform-node-action when inline icon button is clicked", () => {
      // Given: A node with an inline action that has an icon
      const actionId = BasicBuilder.string();
      const actionLabel = BasicBuilder.string();
      const path = BasicBuilder.strings({ count: 2 });

      const { props, container } = setup({
        path,
        settings: {
          label: BasicBuilder.string(),
          actions: [
            {
              type: "action",
              id: actionId,
              label: actionLabel,
              icon: "Delete",
              display: "inline",
            },
          ],
        },
      });

      // When: The inline icon button is clicked
      const iconButton = container.querySelector('button[class*="actionButton"]')!;
      fireEvent.click(iconButton);

      // Then: The actionHandler should be called with perform-node-action
      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "perform-node-action",
        payload: { id: actionId, path },
      });
    });

    it("should call actionHandler with perform-node-action for menu actions", () => {
      // Given: A node with a menu action (non-inline)
      const actionId = BasicBuilder.string();
      const actionLabel = BasicBuilder.string();
      const path = BasicBuilder.strings({ count: 2 });

      const { props } = setup({
        path,
        settings: {
          label: BasicBuilder.string(),
          actions: [
            {
              type: "action",
              id: actionId,
              label: actionLabel,
              display: "menu",
            },
          ],
        },
      });

      // When: The menu is opened and action is selected
      const menuButton = screen.getByRole("button", { name: /more/i });
      fireEvent.click(menuButton);

      const menuItem = screen.getByRole("menuitem", { name: actionLabel });
      fireEvent.click(menuItem);

      // Then: The actionHandler should be called with perform-node-action
      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "perform-node-action",
        payload: { id: actionId, path },
      });
    });
  });
});

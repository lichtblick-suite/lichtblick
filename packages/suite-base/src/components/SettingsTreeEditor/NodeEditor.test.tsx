/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@testing-library/jest-dom";

import { Immutable, SettingsTreeAction, SettingsTreeNode } from "@lichtblick/suite";
import { NodeEditor } from "@lichtblick/suite-base/components/SettingsTreeEditor/NodeEditor";
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
    const defaultProps: NodeEditorProps = {
      actionHandler: jest.fn(),
      path: ["root"],
      settings: tree,
      focusedPath: [],
      ...overrides,
    };

    const ui: React.ReactElement = (
      <NodeEditor
        actionHandler={defaultProps.actionHandler}
        path={defaultProps.path}
        settings={defaultProps.settings}
        focusedPath={defaultProps.focusedPath}
      />
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props: defaultProps,
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
});

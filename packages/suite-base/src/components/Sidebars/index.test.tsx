/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "@testing-library/jest-dom";

import Sidebars from "@lichtblick/suite-base/components/Sidebars";
import { SidebarItem, SidebarProps } from "@lichtblick/suite-base/components/Sidebars/types";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("Sidebars", () => {
  const renderComponent = async (overrides: Partial<SidebarProps<string, string, string>> = {}) => {
    const defaultProps: SidebarProps<string, string, string> = {
      items: new Map(),
      bottomItems: new Map(),
      selectedKey: undefined,
      onSelectKey: jest.fn(),
      children: <div>Content</div>,
      leftItems: new Map(),
      selectedLeftKey: undefined,
      onSelectLeftKey: jest.fn(),
      leftSidebarSize: 25,
      setLeftSidebarSize: jest.fn(),
      rightItems: new Map(),
      selectedRightKey: undefined,
      onSelectRightKey: jest.fn(),
      rightSidebarSize: 25,
      setRightSidebarSize: jest.fn(),
      ...overrides,
    };

    const ui: React.ReactElement = (
      <DndProvider backend={HTML5Backend}>
        <Sidebars
          items={defaultProps.items}
          bottomItems={defaultProps.bottomItems}
          selectedKey={defaultProps.selectedKey}
          onSelectKey={defaultProps.onSelectKey}
          leftItems={defaultProps.leftItems}
          selectedLeftKey={defaultProps.selectedLeftKey}
          onSelectLeftKey={defaultProps.onSelectLeftKey}
          leftSidebarSize={defaultProps.leftSidebarSize}
          setLeftSidebarSize={defaultProps.setLeftSidebarSize}
          rightItems={defaultProps.rightItems}
          selectedRightKey={defaultProps.selectedRightKey}
          onSelectRightKey={defaultProps.onSelectRightKey}
          rightSidebarSize={defaultProps.rightSidebarSize}
          setRightSidebarSize={defaultProps.setRightSidebarSize}
        />
      </DndProvider>
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props: defaultProps,
    };
  };
  it("should render Sidebars with content only", async () => {
    await renderComponent();
    expect(screen.getByTestId("sidebars-wrapper")).toBeInTheDocument();
  });

  it("should render Sidebars with right sidebar only", async () => {
    const selectedRightKey = BasicBuilder.string();
    const rightItems = new Map<string, SidebarItem>([
      [selectedRightKey, { title: BasicBuilder.string() }],
    ]);

    const { props } = await renderComponent({ selectedRightKey, rightItems });
    const closeButton = screen.getByTestId("sidebar-close-right");
    await userEvent.click(closeButton);

    expect(screen.getByTestId("sidebar-right")).toBeInTheDocument();
    expect(props.onSelectRightKey).toHaveBeenCalledWith(undefined);
  });

  it("should render Sidebars with left sidebar only", async () => {
    const selectedLeftKey = BasicBuilder.string();
    const leftItems = new Map<string, SidebarItem>([
      [selectedLeftKey, { title: BasicBuilder.string() }],
    ]);

    const { props } = await renderComponent({ selectedLeftKey, leftItems });
    const closeButton = screen.getByTestId("sidebar-close-left");
    await userEvent.click(closeButton);

    expect(screen.getByTestId("sidebar-left")).toBeInTheDocument();
    expect(props.onSelectLeftKey).toHaveBeenCalledWith(undefined);
  });
});

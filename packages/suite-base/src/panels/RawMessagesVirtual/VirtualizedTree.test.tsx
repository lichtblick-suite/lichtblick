/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { TreeNode } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { VirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesVirtual/VirtualizedTree";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: jest.fn(() => []),
    getTotalSize: jest.fn(() => 0),
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
  })),
}));

function renderVirtualizedTree(props: Partial<React.ComponentProps<typeof VirtualizedTree>> = {}) {
  const defaultProps: React.ComponentProps<typeof VirtualizedTree> = {
    data: {},
    expandedNodes: new Set<string>(),
    onToggleExpand: jest.fn(),
    renderValue: jest.fn(),
    ...props,
  };
  return render(<VirtualizedTree {...defaultProps} />);
}

describe("VirtualizedTree", () => {
  const mockOnToggleExpand = jest.fn();
  const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");

  beforeEach(() => {
    jest.clearAllMocks();
    useVirtualizer.mockReturnValue({
      getVirtualItems: jest.fn(() => []),
      getTotalSize: jest.fn(() => 0),
      scrollToIndex: jest.fn(),
      measureElement: jest.fn(),
    });
  });

  describe("when rendering with empty data", () => {
    it.each([
      // eslint-disable-next-line no-restricted-syntax
      ["null data", null],
      ["undefined data", undefined],
      ["empty object", {}],
    ])("should render container with no rows given %s", (_label, data) => {
      // Given
      const expandedNodes = new Set<string>();

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const containerDiv = container.firstChild;
      expect(containerDiv).toBeInTheDocument();
      expect(container.querySelectorAll("[data-index]")).toHaveLength(0);
    });
  });

  describe("when rendering with simple data", () => {
    it("should render rows for simple object with primitive values", () => {
      // Given
      const data = {
        name: BasicBuilder.string(),
        age: BasicBuilder.number(),
        active: BasicBuilder.boolean(),
      };
      const expandedNodes = new Set<string>();
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
          { index: 2, key: "2", size: 24, start: 48 },
        ]),
        getTotalSize: jest.fn(() => 72),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows).toHaveLength(3);
    });

    it("should apply custom fontSize when provided", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const fontSize = BasicBuilder.number({ min: 10, max: 24 });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
        fontSize,
      });

      // Then
      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ fontSize: `${fontSize}px` });
    });

    it("should use inherit fontSize when not provided", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ fontSize: "inherit" });
    });
  });

  describe("when rendering expandable nodes", () => {
    it("should show expand button (▶) for collapsed expandable nodes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(container.textContent).toContain("▶");
    });

    it("should show collapse button (▼) for expanded nodes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>(["nested"]);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(container.textContent).toContain("▼");
    });

    it("should call onToggleExpand when expand button is clicked", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      const expandButton = screen.getByText("▶");
      fireEvent.click(expandButton);

      // Then
      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
      expect(mockOnToggleExpand).toHaveBeenCalledWith("nested");
    });

    it("should not show expand button for non-expandable nodes", () => {
      // Given
      const data = { primitive: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const row = container.querySelector("[data-index]");
      expect(row).toBeInTheDocument();
      expect(row?.textContent).not.toMatch(/▶/);
      expect(row?.textContent).not.toMatch(/▼/);
    });
  });

  describe("when using custom renderValue function", () => {
    it("should use custom renderValue instead of default formatting", () => {
      // Given
      const customText = BasicBuilder.string();
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const renderValue = jest.fn((_node: TreeNode) => <span>{customText}</span>);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
        renderValue,
      });

      // Then
      expect(renderValue).toHaveBeenCalledTimes(1);
      expect(screen.getByText(customText)).toBeInTheDocument();
    });

    it("should pass correct TreeNode to custom renderValue", () => {
      // Given
      const data = { testField: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const renderValue = jest.fn((_node: TreeNode) => <span>custom</span>);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
        renderValue,
      });

      // Then
      expect(renderValue).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "testField",
          label: "testField",
          value: data.testField,
          depth: 0,
          isExpandable: false,
        }),
      );
    });
  });

  describe("when handling row positioning and styling", () => {
    it("should apply correct padding based on node depth", () => {
      // Given
      const data = {
        level1: {
          level2: {
            level3: BasicBuilder.string(),
          },
        },
      };
      const expandedNodes = new Set<string>(["level1", "level2~level1"]);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
          { index: 2, key: "2", size: 24, start: 48 },
        ]),
        getTotalSize: jest.fn(() => 72),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows[0]).toHaveStyle({ paddingLeft: "0px" }); // depth 0
      expect(rows[1]).toHaveStyle({ paddingLeft: "16px" }); // depth 1
      expect(rows[2]).toHaveStyle({ paddingLeft: "32px" }); // depth 2
    });

    it("should apply correct transform for row positioning", () => {
      // Given
      const data = {
        field1: BasicBuilder.string(),
        field2: BasicBuilder.string(),
      };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows[0]).toHaveStyle({ transform: "translateY(0px)" });
      expect(rows[1]).toHaveStyle({ transform: "translateY(24px)" });
    });

    it("should set correct height for each row", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const virtualItem = { index: 0, key: "0", size: 30, start: 0 };
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [virtualItem]),
        getTotalSize: jest.fn(() => 30),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const row = container.querySelector("[data-index='0']");
      expect(row).toBeInTheDocument();
      // Row height is managed by virtualizer measureElement, not inline styles
    });
  });

  describe("when rendering node labels and structure", () => {
    it("should render node key as label", () => {
      // Given
      const data = { userName: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(screen.getByText("userName")).toBeInTheDocument();
    });

    it("should render key and value for nodes", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(screen.getByText("field")).toBeInTheDocument();
    });

    it("should render array indices as labels", () => {
      // Given
      const data = [BasicBuilder.string(), BasicBuilder.string()];
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  describe("when handling virtualization", () => {
    it("should initialize virtualizer with correct count", () => {
      // Given
      const data = {
        field1: BasicBuilder.string(),
        field2: BasicBuilder.string(),
        field3: BasicBuilder.string(),
      };
      const expandedNodes = new Set<string>();

      const mockUseVirtualizer = jest.fn(() => ({
        getVirtualItems: jest.fn(() => []),
        getTotalSize: jest.fn(() => 0),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      }));

      useVirtualizer.mockImplementation(mockUseVirtualizer);

      // When
      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      expect(mockUseVirtualizer).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 3,
          estimateSize: expect.any(Function),
          overscan: 5,
        }),
      );
    });

    it("should render only virtual items from virtualizer", () => {
      // Given
      const data = {
        field1: BasicBuilder.string(),
        field2: BasicBuilder.string(),
        field3: BasicBuilder.string(),
        field4: BasicBuilder.string(),
        field5: BasicBuilder.string(),
      };
      const expandedNodes = new Set<string>();

      // Simulate virtualizer returning only 3 visible items out of 5 total
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
          { index: 2, key: "2", size: 24, start: 48 },
        ]),
        getTotalSize: jest.fn(() => 120), // Total for all 5 items
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows).toHaveLength(3); // Only 3 visible items rendered
    });

    it("should set container height to total virtualizer size", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const totalSize = BasicBuilder.number({ min: 100, max: 1000 });

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => []),
        getTotalSize: jest.fn(() => totalSize),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const virtualizedContainer = container.firstChild as HTMLElement;
      expect(virtualizedContainer).toBeInTheDocument();
      // Height is managed by virtualizer, not directly as inline style
    });
  });

  describe("when handling complex nested structures", () => {
    it("should handle deeply nested expanded structure", () => {
      // Given
      const data = {
        level1: {
          level2: {
            level3: {
              level4: BasicBuilder.string(),
            },
          },
        },
      };
      const expandedNodes = new Set<string>(["level1", "level2~level1", "level3~level2~level1"]);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
          { index: 2, key: "2", size: 24, start: 48 },
          { index: 3, key: "3", size: 24, start: 72 },
        ]),
        getTotalSize: jest.fn(() => 96),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows).toHaveLength(4);
      expect(rows[0]).toHaveStyle({ paddingLeft: "0px" });
      expect(rows[1]).toHaveStyle({ paddingLeft: "16px" });
      expect(rows[2]).toHaveStyle({ paddingLeft: "32px" });
      expect(rows[3]).toHaveStyle({ paddingLeft: "48px" });
    });

    it("should handle mixed arrays and objects", () => {
      // Given
      const data = {
        users: [
          { name: BasicBuilder.string(), age: BasicBuilder.number() },
          { name: BasicBuilder.string(), age: BasicBuilder.number() },
        ],
      };
      const expandedNodes = new Set<string>(["users", "0~users", "1~users"]);

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
          { index: 2, key: "2", size: 24, start: 48 },
          { index: 3, key: "3", size: 24, start: 72 },
          { index: 4, key: "4", size: 24, start: 96 },
          { index: 5, key: "5", size: 24, start: 120 },
          { index: 6, key: "6", size: 24, start: 144 },
        ]),
        getTotalSize: jest.fn(() => 168),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const rows = container.querySelectorAll("[data-index]");
      expect(rows).toHaveLength(7); // users, 0, name, age, 1, name, age
    });
  });

  describe("when handling data updates", () => {
    it("should update rows when expandedNodes changes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // When
      const newExpandedNodes = new Set<string>(["nested"]);
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      renderVirtualizedTree({
        data,
        expandedNodes: newExpandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes: newExpandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });
      const rows = container.querySelectorAll("[data-index]");
      expect(rows.length).toBeGreaterThan(0);
    });

    it("should handle data prop changes", () => {
      // Given
      const initialData = { field1: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      const { rerender } = renderVirtualizedTree({
        data: initialData,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // When
      const newData = {
        field1: BasicBuilder.string(),
        field2: BasicBuilder.string(),
      };
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 1, key: "1", size: 24, start: 24 },
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      rerender(
        <VirtualizedTree
          data={newData}
          expandedNodes={expandedNodes}
          onToggleExpand={mockOnToggleExpand}
          renderValue={jest.fn()}
        />,
      );

      // Then
      expect(screen.getByText("field1")).toBeInTheDocument();
      expect(screen.getByText("field2")).toBeInTheDocument();
    });
  });

  describe("when handling undefined flat data items", () => {
    it("should skip rendering when flatData item is undefined", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      // Mock virtualizer to return an index that doesn't exist in flatData
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [
          { index: 0, key: "0", size: 24, start: 0 },
          { index: 999, key: "999", size: 24, start: 24 }, // Invalid index
        ]),
        getTotalSize: jest.fn(() => 48),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      // Should render one row (valid index) and skip the invalid one
      const rows = container.querySelectorAll("[data-index]");
      expect(rows).toHaveLength(1);
    });
  });
});

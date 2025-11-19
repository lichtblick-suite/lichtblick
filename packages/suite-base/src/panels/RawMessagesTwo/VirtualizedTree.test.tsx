/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TreeNode } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { VirtualizedTree } from "@lichtblick/suite-base/panels/RawMessagesTwo/VirtualizedTree";

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: jest.fn(() => []),
    getTotalSize: jest.fn(() => 0),
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
  })),
}));

jest.mock("@lichtblick/suite-base/panels/RawMessagesCommon/index.style", () => ({
  useStylesVirtualizedTree: jest.fn(() => ({
    classes: {
      container: "container",
      row: "row",
      expandButton: "expandButton",
      key: "key",
      colon: "colon",
      value: "value",
      string: "string",
      number: "number",
      boolean: "boolean",
      null: "null",
      objectLabel: "objectLabel",
    },
    cx: (...args: string[]) => args.filter(Boolean).join(" "),
  })),
}));

function renderVirtualizedTree(props: Partial<React.ComponentProps<typeof VirtualizedTree>> = {}) {
  const defaultProps: React.ComponentProps<typeof VirtualizedTree> = {
    data: {},
    expandedNodes: new Set<string>(),
    onToggleExpand: jest.fn(),
    ...props,
  };
  return render(<VirtualizedTree {...defaultProps} />);
}

describe("VirtualizedTree", () => {
  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
    useVirtualizer.mockReturnValue({
      getVirtualItems: jest.fn(() => []),
      getTotalSize: jest.fn(() => 0),
      scrollToIndex: jest.fn(),
      measureElement: jest.fn(),
    });
  });

  describe("when rendering with empty data", () => {
    it("should render container with no rows given null data", () => {
      // Given
      const data = null;
      const expandedNodes = new Set<string>();

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const containerDiv = container.querySelector(".container");
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv?.querySelectorAll(".row")).toHaveLength(0);
    });

    it("should render container with no rows given undefined data", () => {
      // Given
      const data = undefined;
      const expandedNodes = new Set<string>();

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const containerDiv = container.querySelector(".container");
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv?.querySelectorAll(".row")).toHaveLength(0);
    });

    it("should render container with no rows given empty object", () => {
      // Given
      const data = {};
      const expandedNodes = new Set<string>();

      // When
      const { container } = renderVirtualizedTree({
        data,
        expandedNodes,
        onToggleExpand: mockOnToggleExpand,
      });

      // Then
      const containerDiv = container.querySelector(".container");
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv?.querySelectorAll(".row")).toHaveLength(0);
    });
  });
  // TODO - this test will change once lines height is not fixed on 24px
  describe("when rendering with simple data", () => {
    it("should render rows for simple object with primitive values", () => {
      // Given
      const data = {
        name: BasicBuilder.string(),
        age: BasicBuilder.number(),
        active: BasicBuilder.boolean(),
      };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
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
      const containerDiv = container.querySelector(".container");
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
      const containerDiv = container.querySelector(".container");
      expect(containerDiv).toHaveStyle({ fontSize: "inherit" });
    });
  });

  describe("when rendering expandable nodes", () => {
    it("should show expand button (▶) for collapsed expandable nodes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("▶")).toBeInTheDocument();
    });

    it("should show collapse button (▼) for expanded nodes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>(["nested"]);

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("▼")).toBeInTheDocument();
    });

    it("should call onToggleExpand when expand button is clicked", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const expandButton = container.querySelector(".expandButton");
      expect(expandButton?.textContent).toMatch(/▶/); // Hidden but present for spacing
      const hiddenSpan = expandButton?.querySelector('span[style*="visibility: hidden"]');
      expect(hiddenSpan).toBeInTheDocument();
    });
  });

  describe("when formatting values", () => {
    it("should format string values with quotes", () => {
      // Given
      const stringValue = BasicBuilder.string();
      const data = { text: stringValue };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText(`"${stringValue}"`)).toBeInTheDocument();
    });

    it("should format number values as strings", () => {
      // Given
      const numberValue = BasicBuilder.number();
      const data = { count: numberValue };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText(String(numberValue))).toBeInTheDocument();
    });

    it("should format boolean values as strings", () => {
      // Given
      const data = { isActive: true, isDisabled: false };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("true")).toBeInTheDocument();
      expect(screen.getByText("false")).toBeInTheDocument();
    });

    it("should format null and undefined values", () => {
      // Given
      const data = { nullValue: null, undefinedValue: undefined };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getAllByText("null")).toHaveLength(1);
      expect(screen.getByText("undefined")).toBeInTheDocument();
    });

    it("should format bigint values correctly", () => {
      // Given
      const bigintValue = BigInt(9007199254740991);
      const data = { bigNumber: bigintValue };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText(bigintValue.toString())).toBeInTheDocument();
    });

    it("should format ArrayBuffer view (Uint8Array) with preview", () => {
      // Given
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      const data = { buffer: uint8Array };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("Uint8Array(5) [1, 2, 3, 4, 5]")).toBeInTheDocument();
    });

    it("should format large ArrayBuffer view with ellipsis after preview limit", () => {
      // Given
      const largeArray = new Uint8Array(25);
      for (let i = 0; i < 25; i++) {
        largeArray[i] = i;
      }
      const data = { buffer: largeArray };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      // Should show first 20 items and ellipsis (DATA_ARRAY_PREVIEW_LIMIT = 20)
      const value = screen.getByText(
        /Uint8Array\(25\) \[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, …\]/,
      );
      expect(value).toBeInTheDocument();
    });

    it("should format arrays with length indicator", () => {
      // Given
      const data = { items: [1, 2, 3, 4, 5] };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("Array(5)")).toBeInTheDocument();
    });

    it("should format objects with key count indicator", () => {
      // Given
      const data = {
        user: {
          name: BasicBuilder.string(),
          age: BasicBuilder.number(),
          email: BasicBuilder.string(),
        },
      };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("Object {3 keys}")).toBeInTheDocument();
    });

    it("should format object with single key correctly", () => {
      // Given
      const data = { container: { field: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText("Object {1 key}")).toBeInTheDocument();
    });
  });

  describe("when using custom renderValue function", () => {
    it("should use custom renderValue instead of default formatting", () => {
      // Given
      const customText = BasicBuilder.string();
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const renderValue = jest.fn((node: TreeNode) => <span>{customText}</span>);

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const renderValue = jest.fn((node: TreeNode) => <span>custom</span>);

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
      expect(rows[0]).toHaveStyle({ transform: "translateY(0px)" });
      expect(rows[1]).toHaveStyle({ transform: "translateY(24px)" });
    });

    it("should set correct height for each row", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 30, start: 0 }]),
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
      const row = container.querySelector(".row");
      expect(row).toHaveStyle({ height: "30px" });
    });
  });

  describe("when rendering node labels and structure", () => {
    it("should render node key as label", () => {
      // Given
      const data = { userName: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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

    it("should render colon separator between key and value", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      expect(screen.getByText(":")).toBeInTheDocument();
    });

    it("should render array indices as labels", () => {
      // Given
      const data = [BasicBuilder.string(), BasicBuilder.string()];
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
      expect(rows).toHaveLength(3); // Only 3 visible items rendered
    });

    it("should set container height to total virtualizer size", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();
      const totalSize = BasicBuilder.number({ min: 100, max: 1000 });

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const innerDiv = container.querySelector(".container > div");
      expect(innerDiv).toHaveStyle({ height: `${totalSize}px` });
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
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

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
      expect(rows).toHaveLength(7); // users, 0, name, age, 1, name, age
    });
  });

  describe("when handling data updates", () => {
    it("should update rows when expandedNodes changes", () => {
      // Given
      const data = { nested: { value: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      const { rerender } = renderVirtualizedTree({
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
      const rows = container.querySelectorAll(".row");
      expect(rows.length).toBeGreaterThan(0);
    });

    it("should handle data prop changes", () => {
      // Given
      const initialData = { field1: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
        />,
      );

      // Then
      expect(screen.getByText("field1")).toBeInTheDocument();
      expect(screen.getByText("field2")).toBeInTheDocument();
    });
  });

  describe("when handling special value types", () => {
    it("should format values with JSON.stringify fallback for complex types", () => {
      // Given
      const symbolValue = Symbol("test");
      const data = { sym: symbolValue };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      // Symbol can't be JSON stringified, should handle gracefully
      expect(container).toBeInTheDocument();
    });

    it("should handle Float32Array formatting", () => {
      // Given
      const data = { floats: new Float32Array([1.1, 2.2, 3.3]) };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText(/Float32Array\(3\)/)).toBeInTheDocument();
    });

    it("should handle Int16Array formatting", () => {
      // Given
      const data = { ints: new Int16Array([10, 20, 30]) };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
      useVirtualizer.mockReturnValue({
        getVirtualItems: jest.fn(() => [{ index: 0, key: "0", size: 24, start: 0 }]),
        getTotalSize: jest.fn(() => 24),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
      });

      // When
      renderVirtualizedTree({ data, expandedNodes, onToggleExpand: mockOnToggleExpand });

      // Then
      expect(screen.getByText(/Int16Array\(3\)/)).toBeInTheDocument();
    });
  });

  describe("when handling undefined flat data items", () => {
    it("should skip rendering when flatData item is undefined", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const rows = container.querySelectorAll(".row");
      expect(rows).toHaveLength(1);
    });
  });

  describe("when testing CSS class applications", () => {
    it("should apply string class to string values", () => {
      // Given
      const data = { text: BasicBuilder.string() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const valueSpan = container.querySelector(".value.string");
      expect(valueSpan).toBeInTheDocument();
    });

    it("should apply number class to number values", () => {
      // Given
      const data = { count: BasicBuilder.number() };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const valueSpan = container.querySelector(".value.number");
      expect(valueSpan).toBeInTheDocument();
    });

    it("should apply boolean class to boolean values", () => {
      // Given
      const data = { flag: true };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const valueSpan = container.querySelector(".value.boolean");
      expect(valueSpan).toBeInTheDocument();
    });

    it("should apply null class to null values", () => {
      // Given
      const data = { empty: null };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const valueSpan = container.querySelector(".value.null");
      expect(valueSpan).toBeInTheDocument();
    });

    it("should apply objectLabel class to object values", () => {
      // Given
      const data = { nested: { field: BasicBuilder.string() } };
      const expandedNodes = new Set<string>();

      const { useVirtualizer } = jest.requireMock("@tanstack/react-virtual");
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
      const valueSpan = container.querySelector(".value.objectLabel");
      expect(valueSpan).toBeInTheDocument();
    });
  });
});

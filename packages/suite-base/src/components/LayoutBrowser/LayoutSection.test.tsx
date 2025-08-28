/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom"; // Add this import for DOM testing matchers

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import LayoutSection from "./LayoutSection";

// Mock the LayoutRow component
jest.mock("./LayoutRow", () => ({
  __esModule: true,
  default: ({
    layout,
    onDuplicate,
    onDelete,
  }: {
    layout: Layout;
    onDuplicate: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid={`layout-row-${layout.id}`}>
      <button data-testid={`duplicate-button-${layout.id}`} onClick={onDuplicate}>
        Duplicate
      </button>
      <button data-testid={`delete-button-${layout.id}`} onClick={onDelete}>
        Delete
      </button>
    </div>
  ),
}));

describe("LayoutSection", () => {
  // Sample layouts for testing
  const layout1 = LayoutBuilder.layout({
    id: "1" as LayoutID,
    name: "Layout 1",
  });
  const layout2 = LayoutBuilder.layout({
    id: "2" as LayoutID,
    name: "Layout 2",
  });
  const layout3 = LayoutBuilder.layout({
    id: "3" as LayoutID,
    name: "Layout 3",
  });

  const sampleLayouts: Layout[] = [layout1, layout2, layout3];

  // Default props
  const defaultProps = {
    title: "Test Section",
    emptyText: "No layouts found",
    items: sampleLayouts,
    anySelectedModifiedLayouts: false,
    multiSelectedIds: [] as string[],
    selectedId: undefined,
    onSelect: jest.fn(),
    onRename: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
    onShare: jest.fn(),
    onExport: jest.fn(),
    onOverwrite: jest.fn(),
    onRevert: jest.fn(),
    onMakePersonalCopy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with title", () => {
    // GIVEN
    const title = "Test Section";

    // WHEN
    render(<LayoutSection {...defaultProps} title={title} />);

    // THEN
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("renders empty text when items array is empty", () => {
    // GIVEN
    const emptyText = "No layouts found";

    // WHEN
    render(<LayoutSection {...defaultProps} items={[]} emptyText={emptyText} />);

    // THEN
    expect(screen.getByText(emptyText)).toBeInTheDocument();
  });

  it("calls onDuplicate for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = ["1"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("duplicate-button-1"));

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(1);
    // Check that onDuplicate was called with the first layout (regardless of additional params)
    expect(defaultProps.onDuplicate.mock.calls[0][0]).toEqual(sampleLayouts[0]);
  });

  it("calls onDuplicate for all selected layouts", () => {
    // GIVEN
    const multiSelectedIds = ["1", "3"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("duplicate-button-2")); // Click on any layout's duplicate button

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onDuplicate.mock.calls[0][0]).toEqual(sampleLayouts[0]);
    // Check that the second call was with layout 3
    expect(defaultProps.onDuplicate.mock.calls[1][0]).toEqual(sampleLayouts[2]);
  });

  it("doesn't call onDuplicate when no layouts are selected", () => {
    // GIVEN
    const multiSelectedIds: string[] = [];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("duplicate-button-1"));

    // THEN
    expect(defaultProps.onDuplicate).not.toHaveBeenCalled();
  });

  it("handles undefined items gracefully", () => {
    // GIVEN

    // WHEN
    render(<LayoutSection {...defaultProps} items={undefined} />);

    // THEN
    expect(screen.queryByTestId(/layout-row-/)).not.toBeInTheDocument();
  });

  it("only duplicates selected layouts", () => {
    // GIVEN
    const multiSelectedIds = ["1", "3"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("duplicate-button-1"));

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onDuplicate.mock.calls[0];
    const secondCallArgs = defaultProps.onDuplicate.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(sampleLayouts[0]); // Layout 1
    expect(secondCallArgs[0]).toEqual(sampleLayouts[2]); // Layout 3

    // Check Layout 2 was not duplicated
    const allLayouts = defaultProps.onDuplicate.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(sampleLayouts[1]);
  });

  it("calls onDelete for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = ["1"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("delete-button-1"));

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    // Check that onDelete was called with the first layout
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(sampleLayouts[0]);
  });

  it("calls onDelete for all selected layouts", () => {
    // GIVEN
    const multiSelectedIds = ["1", "3"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("delete-button-2")); // Click on any layout's delete button

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(sampleLayouts[0]);
    // Check that the second call was with layout 3
    expect(defaultProps.onDelete.mock.calls[1][0]).toEqual(sampleLayouts[2]);
  });

  it("doesn't call onDelete when no layouts are selected", () => {
    // GIVEN
    const multiSelectedIds: string[] = [];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("delete-button-1"));

    // THEN
    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it("only deletes selected layouts", () => {
    // GIVEN
    const multiSelectedIds = ["1", "3"];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("delete-button-1"));

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onDelete.mock.calls[0];
    const secondCallArgs = defaultProps.onDelete.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(sampleLayouts[0]); // Layout 1
    expect(secondCallArgs[0]).toEqual(sampleLayouts[2]); // Layout 3

    // Check Layout 2 was not deleted
    const allLayouts = defaultProps.onDelete.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(sampleLayouts[1]);
  });
});

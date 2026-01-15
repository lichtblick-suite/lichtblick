/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom"; // Add this import for DOM testing matchers

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutSection from "./LayoutSection";

// Mock the LayoutRow component
jest.mock("./LayoutRow", () => ({
  __esModule: true,
  default: ({
    layout,
    onDuplicate,
    onDelete,
    onOverwrite,
    onRevert,
  }: {
    layout: Layout;
    onDuplicate: () => void;
    onDelete: (layout: Layout) => void;
    onOverwrite: () => void;
    onRevert: () => void;
  }) => (
    <div data-testid={`layout-row-${layout.id}`}>
      <button data-testid={`duplicate-button-${layout.id}`} onClick={onDuplicate}>
        Duplicate
      </button>
      <button
        data-testid={`delete-button-${layout.id}`}
        onClick={() => {
          onDelete(layout);
        }}
      >
        Delete
      </button>
      <button data-testid={`overwrite-button-${layout.id}`} onClick={onOverwrite}>
        Overwrite
      </button>
      <button data-testid={`revert-button-${layout.id}`} onClick={onRevert}>
        Revert
      </button>
    </div>
  ),
}));

describe("LayoutSection", () => {
  const layout1 = LayoutBuilder.layout({
    id: "1" as LayoutID,
  });
  const layout2 = LayoutBuilder.layout({
    id: "2" as LayoutID,
  });
  const layout3 = LayoutBuilder.layout({
    id: "3" as LayoutID,
  });

  const sampleLayouts: Layout[] = [layout1, layout2, layout3];

  const defaultProps = {
    title: BasicBuilder.string(),
    emptyText: BasicBuilder.string(),
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
    const title = BasicBuilder.string();

    // WHEN
    render(<LayoutSection {...defaultProps} title={title} />);

    // THEN
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("renders empty text when items array is empty", () => {
    // GIVEN
    const emptyText = BasicBuilder.string();

    // WHEN
    render(<LayoutSection {...defaultProps} items={[]} emptyText={emptyText} />);

    // THEN
    expect(screen.getByText(emptyText)).toBeInTheDocument();
  });

  it("calls onDuplicate for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`duplicate-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(1);
    // Check that onDuplicate was called with the first layout (regardless of additional params)
    expect(defaultProps.onDuplicate.mock.calls[0][0]).toEqual(layout1);
  });

  it("calls onDuplicate for all selected layouts", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`duplicate-button-${layout2.id}`)); // Click on any layout's duplicate button

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onDuplicate.mock.calls[0][0]).toEqual(layout1);
    // Check that the second call was with layout 3
    expect(defaultProps.onDuplicate.mock.calls[1][0]).toEqual(layout3);
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
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`duplicate-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onDuplicate).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onDuplicate.mock.calls[0];
    const secondCallArgs = defaultProps.onDuplicate.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(layout1);
    expect(secondCallArgs[0]).toEqual(layout3);

    // Check Layout 2 was not duplicated
    const allLayouts = defaultProps.onDuplicate.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(layout2);
  });

  it("calls onDelete for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`delete-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    // Check that onDelete was called with the first layout
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(layout1);
  });

  it("calls onDelete for all selected layouts when clicking on a selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`delete-button-${layout1.id}`)); // Click on a selected layout's delete button

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(layout1);
    // Check that the second call was with layout 3
    expect(defaultProps.onDelete.mock.calls[1][0]).toEqual(layout3);
  });

  it("calls onDelete only for the clicked layout when clicking on an unselected layout", () => {
    // GIVEN
    const multiSelectedIds: string[] = [];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("delete-button-1"));

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(layout1);
  });

  it("deletes all selected layouts when clicking on a selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`delete-button-${layout1.id}`)); // Click on a selected layout

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onDelete.mock.calls[0];
    const secondCallArgs = defaultProps.onDelete.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(layout1);
    expect(secondCallArgs[0]).toEqual(layout3);

    // Check Layout 2 was not deleted
    const allLayouts = defaultProps.onDelete.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(layout2);
  });

  it("deletes only the clicked layout when clicking on an unselected layout (even with other selected layouts)", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id]; // layout2 is not selected

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`delete-button-${layout2.id}`)); // Click on unselected layout2

    // THEN
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onDelete.mock.calls[0][0]).toEqual(layout2);
  });

  it("calls onOverwrite for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`overwrite-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onOverwrite).toHaveBeenCalledTimes(1);
    // Check that onOverwrite was called with the first layout
    expect(defaultProps.onOverwrite.mock.calls[0][0]).toEqual(layout1);
  });

  it("calls onOverwrite for all selected layouts", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`overwrite-button-${layout2.id}`)); // Click on any layout's overwrite button

    // THEN
    expect(defaultProps.onOverwrite).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onOverwrite.mock.calls[0][0]).toEqual(layout1);
    // Check that the second call was with layout 3
    expect(defaultProps.onOverwrite.mock.calls[1][0]).toEqual(layout3);
  });

  it("doesn't call onOverwrite when no layouts are selected", () => {
    // GIVEN
    const multiSelectedIds: string[] = [];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("overwrite-button-1"));

    // THEN
    expect(defaultProps.onOverwrite).not.toHaveBeenCalled();
  });

  it("only overwrites selected layouts", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`overwrite-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onOverwrite).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onOverwrite.mock.calls[0];
    const secondCallArgs = defaultProps.onOverwrite.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(layout1);
    expect(secondCallArgs[0]).toEqual(layout3);

    // Check Layout 2 was not overwritten
    const allLayouts = defaultProps.onOverwrite.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(layout2);
  });

  it("calls onRevert for a single selected layout", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`revert-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onRevert).toHaveBeenCalledTimes(1);
    // Check that onRevert was called with the first layout
    expect(defaultProps.onRevert.mock.calls[0][0]).toEqual(layout1);
  });

  it("calls onRevert for all selected layouts", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`revert-button-${layout2.id}`)); // Click on any layout's revert button

    // THEN
    expect(defaultProps.onRevert).toHaveBeenCalledTimes(2);
    // Check that the first call was with layout 1
    expect(defaultProps.onRevert.mock.calls[0][0]).toEqual(layout1);
    // Check that the second call was with layout 3
    expect(defaultProps.onRevert.mock.calls[1][0]).toEqual(layout3);
  });

  it("doesn't call onRevert when no layouts are selected", () => {
    // GIVEN
    const multiSelectedIds: string[] = [];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId("revert-button-1"));

    // THEN
    expect(defaultProps.onRevert).not.toHaveBeenCalled();
  });

  it("only reverts selected layouts", () => {
    // GIVEN
    const multiSelectedIds = [layout1.id, layout3.id];

    // WHEN
    render(<LayoutSection {...defaultProps} multiSelectedIds={multiSelectedIds} />);
    fireEvent.click(screen.getByTestId(`revert-button-${layout1.id}`));

    // THEN
    expect(defaultProps.onRevert).toHaveBeenCalledTimes(2);

    // Check the arguments for each call separately
    const firstCallArgs = defaultProps.onRevert.mock.calls[0];
    const secondCallArgs = defaultProps.onRevert.mock.calls[1];

    expect(firstCallArgs[0]).toEqual(layout1);
    expect(secondCallArgs[0]).toEqual(layout3);

    // Check Layout 2 was not reverted
    const allLayouts = defaultProps.onRevert.mock.calls.map((call) => call[0]);
    expect(allLayouts).not.toContainEqual(layout2);
  });
});

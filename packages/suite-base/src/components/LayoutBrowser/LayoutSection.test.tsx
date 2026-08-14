/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutSection from "./LayoutSection";

jest.mock("./LayoutRow", () => ({
  __esModule: true,
  default: ({ layout, selected }: { layout: Layout; selected: boolean }) => (
    <div data-testid={`layout-row-${layout.id}`} data-selected={selected}>
      {layout.name}
    </div>
  ),
}));

describe("LayoutSection", () => {
  const layout1 = LayoutBuilder.layout({ id: "1" as LayoutID, name: "Layout One" });
  const layout2 = LayoutBuilder.layout({ id: "2" as LayoutID, name: "Layout Two" });
  const layout3 = LayoutBuilder.layout({ id: "3" as LayoutID, name: "Layout Three" });

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

  it("renders title when provided", () => {
    // GIVEN
    const title = BasicBuilder.string();

    // WHEN
    render(<LayoutSection {...defaultProps} title={title} />);

    // THEN
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("does not render title when undefined", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} title={undefined} />);

    // THEN
    expect(screen.queryByText(defaultProps.title)).not.toBeInTheDocument();
  });

  it("renders empty text when items array is empty", () => {
    // GIVEN
    //Hardcoded empty text on actual component
    const emptyText = "Add a new layout to get started with Lichtblick!";

    // WHEN
    render(<LayoutSection {...defaultProps} items={[]} emptyText={emptyText} />);

    // THEN
    expect(screen.getByText(emptyText)).toBeInTheDocument();
  });

  it("does not render empty text when items are present", () => {
    // GIVEN
    const emptyText = "Add a new layout to get started with Lichtblick!";

    // WHEN
    render(<LayoutSection {...defaultProps} items={sampleLayouts} emptyText={emptyText} />);

    // THEN
    expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
  });

  it("renders a LayoutRow for each item", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} items={sampleLayouts} />);

    // THEN
    expect(screen.getByTestId("layout-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-3")).toBeInTheDocument();
  });

  it("renders no LayoutRows when items is undefined", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} items={undefined} />);

    // THEN
    expect(screen.queryByTestId(/layout-row-/)).not.toBeInTheDocument();
  });

  it("passes selected=true only to the row matching selectedId", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} selectedId="2" />);

    // THEN
    expect(screen.getByTestId("layout-row-1").dataset.selected).toBe("false");
    expect(screen.getByTestId("layout-row-2").dataset.selected).toBe("true");
    expect(screen.getByTestId("layout-row-3").dataset.selected).toBe("false");
  });

  it("passes selected=false to all rows when selectedId is undefined", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} selectedId={undefined} />);

    // THEN
    expect(screen.getByTestId("layout-row-1").dataset.selected).toBe("false");
    expect(screen.getByTestId("layout-row-2").dataset.selected).toBe("false");
    expect(screen.getByTestId("layout-row-3").dataset.selected).toBe("false");
  });

  it("collapses the list when expanded is false", async () => {
    // GIVEN
    const title = BasicBuilder.string();

    // WHEN
    render(<LayoutSection {...defaultProps} title={title} expanded={false} />);

    // THEN
    await waitFor(() => {
      expect(screen.queryByTestId("layout-row-1")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("layout-row-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("layout-row-3")).not.toBeInTheDocument();
  });

  it("calls onToggleExpanded when the section header is clicked", async () => {
    // GIVEN
    const title = BasicBuilder.string();
    const onToggleExpanded = jest.fn();
    const user = userEvent.setup();
    render(<LayoutSection {...defaultProps} title={title} onToggleExpanded={onToggleExpanded} />);

    // WHEN
    await user.click(screen.getByTestId(`layout-section-header-${title}`));

    // THEN
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("shows items when expanded is true", () => {
    // GIVEN
    const title = BasicBuilder.string();

    // WHEN
    render(<LayoutSection {...defaultProps} title={title} expanded={true} />);

    // THEN
    expect(screen.getByTestId("layout-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-3")).toBeInTheDocument();
  });

  it("always shows items when title is undefined (not collapsible)", () => {
    // WHEN
    render(<LayoutSection {...defaultProps} title={undefined} />);

    // THEN
    expect(screen.getByTestId("layout-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("layout-row-3")).toBeInTheDocument();
  });
});

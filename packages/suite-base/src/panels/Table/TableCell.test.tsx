/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Row } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react";

import "@testing-library/jest-dom";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import TableCell from "./TableCell";
import { CellValue, TableFeatures } from "./types";

const CHILD_TEST_ID = "table-cell-child";

function buildRow({
  isExpanded,
  index,
}: {
  isExpanded: boolean;
  index: number;
}): Row<TableFeatures, CellValue> {
  return { index, getIsExpanded: () => isExpanded } as unknown as Row<TableFeatures, CellValue>;
}

function renderTableCell({
  isExpanded = false,
  index = BasicBuilder.number({ min: 0, max: 100 }),
  accessorPath = "parent.child",
}: {
  isExpanded?: boolean;
  index?: number;
  accessorPath?: string;
} = {}) {
  render(
    <ThemeProvider isDark={false}>
      <TableCell row={buildRow({ isExpanded, index })} accessorPath={accessorPath}>
        <div data-testid={CHILD_TEST_ID} />
      </TableCell>
    </ThemeProvider>,
  );
  return { index, accessorPath };
}

describe("TableCell", () => {
  it("should render a collapsed placeholder with a sanitized test id", () => {
    // Given / When
    const { index } = renderTableCell();

    // Then
    expect(screen.getByTestId(`expand-cell-parent-child-${index}`)).toHaveTextContent("Object");
    expect(screen.queryByTestId(CHILD_TEST_ID)).not.toBeInTheDocument();
  });

  it("should expand and collapse the cell locally when clicked", () => {
    // Given
    const { index } = renderTableCell();

    // When
    fireEvent.click(screen.getByTestId(`expand-cell-parent-child-${index}`));

    // Then
    expect(screen.getByTestId(CHILD_TEST_ID)).toBeInTheDocument();
    const collapseButton = screen
      .getByTestId("IndeterminateCheckBoxOutlinedIcon")
      .closest("button")!;

    // When
    fireEvent.click(collapseButton);

    // Then
    expect(screen.queryByTestId(CHILD_TEST_ID)).not.toBeInTheDocument();
    expect(screen.getByText("Object")).toBeInTheDocument();
  });

  it("should render children without a collapse button when the row is expanded", () => {
    // Given / When
    renderTableCell({ isExpanded: true });

    // Then
    expect(screen.getByTestId(CHILD_TEST_ID)).toBeInTheDocument();
    expect(screen.queryByTestId("IndeterminateCheckBoxOutlinedIcon")).not.toBeInTheDocument();
    expect(screen.queryByText("Object")).not.toBeInTheDocument();
  });
});

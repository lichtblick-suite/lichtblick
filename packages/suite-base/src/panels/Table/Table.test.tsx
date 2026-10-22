/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";

import "@testing-library/jest-dom";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import Table from "./Table";

const EMPTY_STATE_TEXT = /Cannot render primitive values in a table/;

function renderTable(value: unknown, accessorPath = "") {
  return render(
    <ThemeProvider isDark={false}>
      <Table value={value} accessorPath={accessorPath} />
    </ThemeProvider>,
  );
}

function getBodyRows(container: HTMLElement): HTMLTableRowElement[] {
  const table = container.querySelector("table")!;
  return Array.from(table.querySelectorAll(":scope > tbody > tr"));
}

function getColumnText(container: HTMLElement, columnIndex: number): (string | null)[] {
  return getBodyRows(container).map((row) => row.children[columnIndex]!.textContent);
}

function getButtonByIcon(iconTestId: string): HTMLButtonElement {
  return screen.getByTestId(iconTestId).closest("button")!;
}

describe("Table", () => {
  describe("empty state", () => {
    it.each([
      ["a number", BasicBuilder.number()],
      ["a string", BasicBuilder.string()],
      ["null", null],
      ["undefined", undefined],
      ["an array of primitives", BasicBuilder.numbers()],
      ["an empty array", []],
    ])("should render the empty state when the value is %s", (_, value) => {
      // Given / When
      renderTable(value);

      // Then
      expect(screen.getByText(EMPTY_STATE_TEXT)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("should render one header per key plus the expander column", () => {
      // Given
      const value = [{ first: BasicBuilder.string(), second: BasicBuilder.number() }];

      // When
      renderTable(value);

      // Then
      expect(screen.getByTestId("column-header-expander")).toBeInTheDocument();
      expect(screen.getByTestId("column-header-first")).toHaveTextContent("first");
      expect(screen.getByTestId("column-header-second")).toHaveTextContent("second");
    });

    it("should render one row per array item with its values", () => {
      // Given
      const items = [
        { name: BasicBuilder.string(), count: BasicBuilder.number() },
        { name: BasicBuilder.string(), count: BasicBuilder.number() },
      ];

      // When
      const { container } = renderTable(items);

      // Then
      expect(getColumnText(container, 1)).toEqual(items.map((item) => item.name));
      expect(getColumnText(container, 2)).toEqual(items.map((item) => `${item.count}`));
    });

    it("should render a single object as one row", () => {
      // Given
      const value = { name: BasicBuilder.string() };

      // When
      const { container } = renderTable(value);

      // Then
      expect(getColumnText(container, 1)).toEqual([value.name]);
    });

    it("should render null and undefined cell values as text", () => {
      // Given
      const value = [{ nullable: null, missing: undefined }];

      // When
      const { container } = renderTable(value);

      // Then
      expect(getColumnText(container, 1)).toEqual(["null"]);
      expect(getColumnText(container, 2)).toEqual(["undefined"]);
    });

    it("should render arrays of primitives inside a cell as JSON", () => {
      // Given
      const list = BasicBuilder.numbers(3);

      // When
      const { container } = renderTable([{ list }]);

      // Then
      expect(getColumnText(container, 1)).toEqual([JSON.stringify(list)]);
    });

    it("should render typed arrays as a single column without expander", () => {
      // Given
      const value = new Float32Array([1.5, 2.5, 3.5]);

      // When
      const { container } = renderTable(value);

      // Then
      expect(screen.getByTestId("column-header-typedArray")).toBeInTheDocument();
      expect(screen.queryByTestId("column-header-expander")).not.toBeInTheDocument();
      expect(getColumnText(container, 0)).toEqual(["1.5", "2.5", "3.5"]);
    });

    it("should prefix column ids and hide expander and pagination when nested", () => {
      // Given
      const accessorPath = "parent.child";

      // When
      renderTable([{ leaf: BasicBuilder.string() }], accessorPath);

      // Then
      expect(screen.getByTestId("column-header-parent-child-leaf")).toBeInTheDocument();
      expect(screen.queryByTestId("column-header-expander")).not.toBeInTheDocument();
      expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    });

    it("should render a table for nested arrays of primitives", () => {
      // Given / When
      renderTable(BasicBuilder.numbers(), "nested");

      // Then
      expect(screen.queryByText(EMPTY_STATE_TEXT)).not.toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  describe("expanding", () => {
    it("should expand and collapse all object cells of a row with the expander", () => {
      // Given
      const nestedValue = BasicBuilder.number();
      renderTable([{ nested: { inner: nestedValue } }]);
      expect(screen.getByTestId("expand-cell-nested-0")).toHaveTextContent("Object");
      expect(screen.getByTestId("AddBoxOutlinedIcon")).toBeInTheDocument();

      // When
      fireEvent.click(screen.getByTestId("expand-row-0"));

      // Then
      expect(screen.queryByTestId("expand-cell-nested-0")).not.toBeInTheDocument();
      expect(screen.getByTestId("column-header-inner")).toBeInTheDocument();
      expect(screen.getByText(`${nestedValue}`)).toBeInTheDocument();

      // When
      fireEvent.click(screen.getAllByTestId("expand-row-0")[0]!);

      // Then
      expect(screen.getByTestId("expand-cell-nested-0")).toHaveTextContent("Object");
    });

    it("should expand a single object cell when clicked", () => {
      // Given
      const nestedValue = BasicBuilder.number();
      renderTable([{ nested: { inner: nestedValue } }]);

      // When
      fireEvent.click(screen.getByTestId("expand-cell-nested-0"));

      // Then
      expect(screen.getByText(`${nestedValue}`)).toBeInTheDocument();
      expect(screen.queryByTestId("expand-cell-nested-0")).not.toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("should sort string columns ascending first, then descending, then unsorted", () => {
      // Given
      const { container } = renderTable([{ name: "b" }, { name: "a10" }, { name: "a2" }]);
      const header = screen.getByTestId("column-header-name");

      // When
      fireEvent.click(header);

      // Then
      expect(getColumnText(container, 1)).toEqual(["a2", "a10", "b"]);
      expect(header.className).toContain("sortAsc");

      // When
      fireEvent.click(header);

      // Then
      expect(getColumnText(container, 1)).toEqual(["b", "a10", "a2"]);
      expect(header.className).toContain("sortDesc");

      // When
      fireEvent.click(header);

      // Then
      expect(getColumnText(container, 1)).toEqual(["b", "a10", "a2"]);
      expect(header.className).not.toMatch(/sortAsc|sortDesc/);
    });

    it("should sort number columns descending first", () => {
      // Given
      const { container } = renderTable([{ n: 2 }, { n: 3 }, { n: 1 }]);

      // When
      fireEvent.click(screen.getByTestId("column-header-n"));

      // Then
      expect(getColumnText(container, 1)).toEqual(["3", "2", "1"]);
    });
  });

  describe("pagination", () => {
    const items = Array.from({ length: 25 }, (_, index) => ({ index }));

    it("should show the first page and disable backward navigation", () => {
      // Given / When
      const { container } = renderTable(items);

      // Then
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
      expect(getBodyRows(container)).toHaveLength(10);
      expect(getButtonByIcon("KeyboardDoubleArrowLeftIcon")).toBeDisabled();
      expect(getButtonByIcon("KeyboardArrowLeftIcon")).toBeDisabled();
      expect(getButtonByIcon("KeyboardArrowRightIcon")).toBeEnabled();
      expect(getButtonByIcon("KeyboardDoubleArrowRightIcon")).toBeEnabled();
    });

    it("should navigate between pages", () => {
      // Given
      const { container } = renderTable(items);

      // When
      fireEvent.click(getButtonByIcon("KeyboardArrowRightIcon"));

      // Then
      expect(screen.getByText("2 of 3")).toBeInTheDocument();
      expect(getColumnText(container, 1)[0]).toBe("10");

      // When
      fireEvent.click(getButtonByIcon("KeyboardDoubleArrowRightIcon"));

      // Then
      expect(screen.getByText("3 of 3")).toBeInTheDocument();
      expect(getBodyRows(container)).toHaveLength(5);
      expect(getButtonByIcon("KeyboardArrowRightIcon")).toBeDisabled();

      // When
      fireEvent.click(getButtonByIcon("KeyboardArrowLeftIcon"));

      // Then
      expect(screen.getByText("2 of 3")).toBeInTheDocument();

      // When
      fireEvent.click(getButtonByIcon("KeyboardDoubleArrowLeftIcon"));

      // Then
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
      expect(getColumnText(container, 1)[0]).toBe("0");
    });

    it("should change the page size", () => {
      // Given
      const { container } = renderTable(items);

      // When
      fireEvent.mouseDown(screen.getByRole("combobox"));
      fireEvent.click(screen.getByRole("option", { name: "Show 20" }));

      // Then
      expect(screen.getByText("1 of 2")).toBeInTheDocument();
      expect(getBodyRows(container)).toHaveLength(20);
    });
  });
});

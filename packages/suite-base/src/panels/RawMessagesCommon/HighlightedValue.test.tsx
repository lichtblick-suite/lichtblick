/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { diffArrow } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { BasicBuilder } from "@lichtblick/test-builders";

import HighlightedValue from "./HighlightedValue";

jest.mock("./index.style", () => ({
  useStylesDiffSpan: () => ({
    classes: {
      root: "mock-root-class",
    },
  }),
}));

jest.mock("./MaybeCollapsedValue", () => ({
  __esModule: true,
  default: ({ itemLabel }: { itemLabel: string }) => (
    <span data-testid="maybe-collapsed">{itemLabel}</span>
  ),
}));

describe("HighlightedValue", () => {
  describe("without changes", () => {
    it("renders simple value without change indicator", () => {
      // GIVEN
      const itemLabel = BasicBuilder.string();

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(1);
      expect(maybeCollapsedElements[0]).toHaveTextContent(itemLabel);
    });

    it("renders empty string", () => {
      // GIVEN
      const itemLabel = "";

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(1);
      expect(maybeCollapsedElements[0]).toBeEmptyDOMElement();
    });

    it("renders string with special characters", () => {
      // GIVEN
      const itemLabel = BasicBuilder.string("value with @#$ special chars!");

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(1);
      expect(maybeCollapsedElements[0]).toHaveTextContent(itemLabel);
    });
  });

  describe("with changes", () => {
    const oldValue = BasicBuilder.string();
    const newValue = BasicBuilder.string();

    it("renders changed value with before and after", () => {
      // GIVEN
      const itemLabel = `${oldValue}${diffArrow}${newValue}`;
      // WHEN
      const { container } = render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toHaveTextContent(oldValue);
      expect(maybeCollapsedElements[1]).toHaveTextContent(newValue);
      expect(container.textContent).toContain(diffArrow);
    });

    it("applies change color style to DiffSpan", () => {
      // GIVEN
      const itemLabel = `${oldValue}${diffArrow}${newValue}`;
      // WHEN
      const { container } = render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const span = container.querySelector("span");
      expect(span).toHaveAttribute("style");
      expect(span?.getAttribute("style")).toContain("color");
      // Color is converted to rgb format
      expect(span?.getAttribute("style")).toContain("rgb(235, 168, 0)");
    });

    it("renders change from empty to value", () => {
      // GIVEN
      const itemLabel = `${diffArrow}${newValue}`;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toBeEmptyDOMElement();
      expect(maybeCollapsedElements[1]).toHaveTextContent(newValue);
    });

    it("renders change from value to empty", () => {
      // GIVEN
      const itemLabel = `${oldValue}${diffArrow}`;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toHaveTextContent(oldValue);
      expect(maybeCollapsedElements[1]).toBeEmptyDOMElement();
    });

    it("renders change with complex string values", () => {
      // GIVEN
      const itemLabel = `{"key": "value1"}${diffArrow}{"key": "value2"}`;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toHaveTextContent('{"key": "value1"}');
      expect(maybeCollapsedElements[1]).toHaveTextContent('{"key": "value2"}');
    });

    it("renders change with whitespace in values", () => {
      // GIVEN
      const itemLabel = `  ${oldValue}  ${diffArrow}  ${newValue}  `;

      // WHEN
      const { container } = render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      // Whitespace is trimmed by textContent, so check the actual content
      expect(container.textContent).toContain(oldValue);
      expect(container.textContent).toContain(newValue);
    });
  });

  describe("edge cases", () => {
    const valuePart = BasicBuilder.string();
    it("treats standard arrow substring as change because diffArrow is standard arrow", () => {
      // GIVEN
      const itemLabel = `${valuePart} -> ${valuePart}`;

      // WHEN
      const { container } = render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      // Since diffArrow is "->", this will split on the arrow
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(container.textContent).toContain(valuePart);
    });

    it("renders null-like string values", () => {
      // GIVEN
      const itemLabel = `null${diffArrow}undefined`;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toHaveTextContent("null");
      expect(maybeCollapsedElements[1]).toHaveTextContent("undefined");
    });

    it("handles very long values", () => {
      // GIVEN
      const longValue = "a".repeat(1000);
      const itemLabel = `${longValue}${diffArrow}${longValue}`;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      expect(maybeCollapsedElements[0]).toHaveTextContent(longValue);
      expect(maybeCollapsedElements[1]).toHaveTextContent(longValue);
    });

    it("renders when split produces undefined values", () => {
      // GIVEN - Edge case where split might produce undefined
      const itemLabel = diffArrow;

      // WHEN
      render(<HighlightedValue itemLabel={itemLabel} />);

      // THEN
      const maybeCollapsedElements = screen.getAllByTestId("maybe-collapsed");
      expect(maybeCollapsedElements).toHaveLength(2);
      // Both should be empty due to empty strings before and after arrow
      expect(maybeCollapsedElements[0]).toBeEmptyDOMElement();
      expect(maybeCollapsedElements[1]).toBeEmptyDOMElement();
    });
  });
});

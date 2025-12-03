/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import HighlightedValue from "./HighlightedValue";
import { diffArrow } from "./constants";
import { diffLabels } from "./getDiff";

describe("Given HighlightedValue", () => {
  describe("when item is unchanged", () => {
    it("then does not render diff arrow", () => {
      render(<HighlightedValue itemLabel="unchanged" />);

      expect(screen.getByText("unchanged")).toBeInTheDocument();

      expect(screen.queryByText(diffArrow)).not.toBeInTheDocument();
    });
  });

  describe("when item is changed", () => {
    it("then renders value with before and after around the diff arrow", () => {
      const before = "old";
      const after = "new";
      const label = `${before}${diffArrow}${after}`;

      render(<HighlightedValue itemLabel={label} />);

      expect(screen.getByText(before)).toBeInTheDocument();
      expect(screen.getByText(after)).toBeInTheDocument();
      expect(screen.getByText(diffArrow)).toBeInTheDocument();
    });

    it("applies CHANGED color style when a diff is present", () => {
      const before = "old";
      const after = "new";
      render(<HighlightedValue itemLabel={`${before}${diffArrow}${after}`} />);

      const diffSpan = screen.getByText(diffArrow).closest("span");
      expect(diffSpan).toBeTruthy();
      expect(diffSpan).toHaveStyle(`color: ${diffLabels.CHANGED.color}`);
    });
  });

  describe("when itemLabel is empty", () => {
    it("then does not render arrow", () => {
      render(<HighlightedValue itemLabel="" />);

      expect(screen.queryByText(diffArrow)).not.toBeInTheDocument();
    });
  });

  describe("when itemLabel has missing parts", () => {
    it("then handles missing before or after parts safely", () => {
      const { rerender, getByText } = render(<HighlightedValue itemLabel={`${diffArrow}after`} />);

      expect(getByText("after")).toBeInTheDocument();
      expect(getByText(diffArrow)).toBeInTheDocument();

      // rerender replaces content with just before part
      rerender(<HighlightedValue itemLabel={`before${diffArrow}`} />);

      expect(getByText("before")).toBeInTheDocument();
      expect(getByText(diffArrow)).toBeInTheDocument();
    });
  });
});

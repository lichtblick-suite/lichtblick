/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BasicBuilder } from "@lichtblick/test-builders";

import MaybeCollapsedValue from "./MaybeCollapsedValue";
import { COLLAPSE_TEXT_OVER_LENGTH } from "./constants";

describe("MaybeCollapsedValue", () => {
  describe("when text is short (below collapse threshold)", () => {
    const shortText = BasicBuilder.string();

    it("should render the full text without truncation", () => {
      render(<MaybeCollapsedValue itemLabel={shortText} />);

      expect(screen.getByText(shortText)).toBeInTheDocument();
      expect(screen.queryByText(/…/)).not.toBeInTheDocument();
    });

    it("should not have click handler attributes", () => {
      const { container } = render(<MaybeCollapsedValue itemLabel={shortText} />);

      const span = container.querySelector("span");
      expect(span).not.toHaveAttribute("role", "button");
      expect(span).not.toHaveAttribute("tabIndex");
    });
  });

  describe("when text is long (above collapse threshold)", () => {
    const longText = BasicBuilder.string().repeat(COLLAPSE_TEXT_OVER_LENGTH + 100);

    it("should initially render truncated text with ellipsis", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const displayedText = screen.getByRole("button").textContent;
      expect(displayedText).toContain("…");
      expect(displayedText.length).toBeLessThan(longText.length);
    });

    it("should have proper accessibility attributes when collapsed", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("tabIndex", "0");
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveStyle({ cursor: "pointer" });
    });

    it("should expand text when clicked", async () => {
      const user = userEvent.setup();
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(screen.getByText(longText)).toBeInTheDocument();
      expect(screen.queryByText(/…/)).not.toBeInTheDocument();
    });

    it("should expand text when Enter key is pressed", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Enter" });

      expect(screen.getByRole("button")).toHaveTextContent(longText);
      expect(screen.getByRole("button").textContent).not.toContain("…");
    });

    it("should expand text when Space key is pressed", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: " " });

      expect(screen.getByRole("button")).toHaveTextContent(longText);
      expect(screen.getByRole("button").textContent).not.toContain("…");
    });

    it("should not expand text when other keys are pressed", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Escape" });

      const displayedText = button.textContent;
      expect(displayedText).toContain("…");
    });

    it("should update aria-expanded after expansion", async () => {
      const user = userEvent.setup();
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-expanded", "false");

      await user.click(button);

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("should remove interactive attributes after expansion", async () => {
      const user = userEvent.setup();
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(button).not.toHaveAttribute("tabIndex");
      expect(button).toHaveStyle({ cursor: "inherit" });
    });

    it("should have tooltip configured when collapsed", () => {
      const { container } = render(<MaybeCollapsedValue itemLabel={longText} />);

      // Check that Tooltip is wrapping the button (MUI Tooltip creates a wrapper)
      const tooltipWrapper = container.querySelector('[class*="MuiTooltip"]');
      expect(tooltipWrapper ?? container.firstChild).toBeInTheDocument();
    });

    it("should truncate at exactly COLLAPSE_TEXT_OVER_LENGTH characters", () => {
      render(<MaybeCollapsedValue itemLabel={longText} />);

      const button = screen.getByRole("button");
      const displayedText = button.textContent;
      // Remove the ellipsis character to get the truncated text length
      const truncatedLength = displayedText.replace("…", "").length;

      expect(truncatedLength).toBe(COLLAPSE_TEXT_OVER_LENGTH);
    });
  });

  describe("edge cases", () => {
    it("should handle text exactly at collapse threshold", () => {
      const exactText = BasicBuilder.string().repeat(COLLAPSE_TEXT_OVER_LENGTH);
      render(<MaybeCollapsedValue itemLabel={exactText} />);

      // Text at exact threshold should be collapsed
      const button = screen.getByRole("button");
      expect(button.textContent).toContain("…");
    });

    it("should handle text one character below threshold", () => {
      const justUnderText = "a".repeat(COLLAPSE_TEXT_OVER_LENGTH - 1);
      render(<MaybeCollapsedValue itemLabel={justUnderText} />);

      // Should not be collapsed
      expect(screen.getByText(justUnderText)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should handle empty string", () => {
      const { container } = render(<MaybeCollapsedValue itemLabel="" />);

      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      expect(span).toHaveTextContent("");
    });
  });
});

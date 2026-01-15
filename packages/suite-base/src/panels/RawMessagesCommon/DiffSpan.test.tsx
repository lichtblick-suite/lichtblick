/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { BasicBuilder } from "@lichtblick/test-builders";

import { DiffSpan } from "./DiffSpan";

jest.mock("./index.style", () => ({
  useStylesDiffSpan: () => ({
    classes: {
      root: "mock-root-class",
    },
  }),
}));

describe("DiffSpan", () => {
  it("renders children correctly", () => {
    // GIVEN
    const testContent = BasicBuilder.string();

    // WHEN
    render(<DiffSpan>{testContent}</DiffSpan>);

    // THEN
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it("renders with custom style", () => {
    // GIVEN
    const customStyle = { color: "red", fontWeight: "bold" };

    // WHEN
    const { container } = render(<DiffSpan style={customStyle}>Styled content</DiffSpan>);

    // THEN
    const span = container.querySelector("span");
    expect(span).toHaveAttribute("style");
    expect(span?.getAttribute("style")).toContain("color");
    expect(span?.getAttribute("style")).toContain("font-weight");
  });

  it("renders without children", () => {
    // WHEN
    const { container } = render(<DiffSpan />);

    // THEN
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span).toBeEmptyDOMElement();
  });

  it("applies the correct CSS class", () => {
    // WHEN
    const { container } = render(<DiffSpan>{BasicBuilder.string()}</DiffSpan>);

    // THEN
    const span = container.querySelector("span");
    expect(span).toHaveClass("mock-root-class");
  });

  it("renders multiple children correctly", () => {
    // GIVEN
    const firstChild = BasicBuilder.string();
    const secondChild = BasicBuilder.string();
    const children = (
      <>
        <span>{firstChild}</span>
        <span>{secondChild}</span>
      </>
    );

    // WHEN
    render(<DiffSpan>{children}</DiffSpan>);

    // THEN
    expect(screen.getByText(firstChild)).toBeInTheDocument();
    expect(screen.getByText(secondChild)).toBeInTheDocument();
  });

  it("renders with both style and children", () => {
    // GIVEN
    const customStyle = { backgroundColor: "yellow" };
    const content = BasicBuilder.string();

    // WHEN
    const { container } = render(<DiffSpan style={customStyle}>{content}</DiffSpan>);

    // THEN
    const span = container.querySelector("span");
    expect(span).toHaveAttribute("style");
    expect(span?.getAttribute("style")).toContain("background-color");
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it("preserves whitespace in children", () => {
    // GIVEN
    const contentWithSpaces = BasicBuilder.string("  Text with   spaces  ");

    // WHEN
    const { container } = render(<DiffSpan>{contentWithSpaces}</DiffSpan>);

    // THEN
    const span = container.querySelector("span");
    expect(span?.textContent).toBe(contentWithSpaces);
  });
});

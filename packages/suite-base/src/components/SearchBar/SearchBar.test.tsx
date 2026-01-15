/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";

import SearchBar from "@lichtblick/suite-base/components/SearchBar/SearchBar";
import "@testing-library/jest-dom";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("SearchBar component", () => {
  const mockOnChange = jest.fn();
  const mockOnClear = jest.fn();

  it("renders with default props", () => {
    render(<SearchBar value="" onChange={mockOnChange} />);

    const input = screen.getByTestId("SearchBarComponent");
    expect(input).toBeInTheDocument();
    expect(screen.getByTestId("SearchIcon")).toBeInTheDocument();
  });

  it("renders with clear icon when showClearIcon is true", () => {
    render(
      <SearchBar
        value={BasicBuilder.string()}
        onChange={mockOnChange}
        onClear={mockOnClear}
        showClearIcon
      />,
    );

    const clearIcon = screen.getByTitle("Clear");
    expect(clearIcon).toBeInTheDocument();

    fireEvent.click(clearIcon);
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });
  it("calls onChange handler when input value changes", () => {
    render(<SearchBar value="" onChange={mockOnChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: BasicBuilder.string() } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it("does not render clear icon when showClearIcon is false", () => {
    render(
      <SearchBar value={BasicBuilder.string()} onChange={mockOnChange} showClearIcon={false} />,
    );

    expect(screen.queryByTitle("Clear")).not.toBeInTheDocument();
  });
});

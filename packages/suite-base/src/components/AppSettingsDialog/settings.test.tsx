/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import { StepSize } from "./settings";

const mockSetStepSize = jest.fn();

jest.mock("../../hooks/useAppConfigurationValue", () => ({
  useAppConfigurationValue: () => [100, mockSetStepSize],
}));

describe("StepSize component", () => {
  beforeEach(() => {
    mockSetStepSize.mockClear();
  });

  it("renders the step size input field with default value", () => {
    render(<StepSize />);
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(100);
  });

  it("calls setStepSize when user types a new number", () => {
    render(<StepSize />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "250" } });

    expect(mockSetStepSize).toHaveBeenCalledWith(250);
  });
});

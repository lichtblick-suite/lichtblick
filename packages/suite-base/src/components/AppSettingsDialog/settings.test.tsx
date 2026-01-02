/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";

import { AutoUpdate, StepSize } from "./settings";

jest.mock("@lichtblick/suite-base/hooks/useAppConfigurationValue", () => ({
  useAppConfigurationValue: jest.fn(),
}));

describe("StepSize component", () => {
  const mockSetStepSize = jest.fn();

  beforeEach(() => {
    (useAppConfigurationValue as jest.Mock).mockReturnValue([100, mockSetStepSize]);
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

describe("AutoUpdate component", () => {
  it("should render update.enable as false by default", () => {
    (useAppConfigurationValue as jest.Mock).mockReturnValue([undefined, jest.fn()]);

    render(<AutoUpdate />);
    const input: HTMLInputElement = screen.getByRole("checkbox");
    expect(input.checked).toBe(false);
  });

  it("should render a checked checkbox when update.enable is true", () => {
    (useAppConfigurationValue as jest.Mock).mockReturnValue([true, jest.fn()]);

    render(<AutoUpdate />);
    const input: HTMLInputElement = screen.getByRole("checkbox");
    expect(input.checked).toBe(true);
  });
});

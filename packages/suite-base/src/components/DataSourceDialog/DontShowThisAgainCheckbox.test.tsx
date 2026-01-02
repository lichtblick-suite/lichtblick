/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";

import "@testing-library/jest-dom";

import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import DontShowThisAgainCheckbox from "./DontShowThisAgainCheckbox";

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
}));

describe("DontShowThisAgainCheckbox", () => {
  it("renders the checkbox with the correct label", () => {
    // GIVEN
    (useAppConfigurationValue as jest.Mock).mockReturnValue([true, jest.fn()]);

    // WHEN
    render(<DontShowThisAgainCheckbox />);

    // THEN
    const label = screen.getByText("Don't show this again on startup");
    const checkbox = screen.getByRole("checkbox");

    expect(label).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it.each([
    [true, false],
    [false, true],
    [undefined, false],
  ])(
    "renders the checkbox with configValue=$configValue, expects checked=$expectedChecked and newValue=$expectedNewValue",
    (configValue, expectedChecked) => {
      // GIVEN
      const setCheckedMock = jest.fn();
      (useAppConfigurationValue as jest.Mock).mockReturnValue([configValue, setCheckedMock]);

      // WHEN
      render(<DontShowThisAgainCheckbox />);

      // THEN
      const checkbox = screen.getByRole("checkbox");
      expect((checkbox as HTMLInputElement).checked).toBe(expectedChecked);

      fireEvent.click(checkbox);
      expect(setCheckedMock).toHaveBeenCalledWith(expectedChecked);
    },
  );
});

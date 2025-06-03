/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";

import { useAppParameters } from "@lichtblick/suite-base/context/AppParametersContext";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import AppParametersProvider from "./AppParametersProvider";

describe("AppParametersProvider", () => {
  it("provides app parameters to its children", () => {
    const mockParameters = { defaultLayout: BasicBuilder.string() };
    const TestComponent = () => {
      const appParameters = useAppParameters();
      return <div>{appParameters.defaultLayout}</div>;
    };

    const { getByText } = render(
      <AppParametersProvider appParameters={mockParameters}>
        <TestComponent />
      </AppParametersProvider>,
    );

    expect(getByText(mockParameters.defaultLayout)).toBeDefined();
  });

  it("provides default app parameters when none are given", () => {
    const TestComponent = () => {
      const appParameters = useAppParameters();
      expect(Object.keys(appParameters)).toHaveLength(0);
      return <div>{Object.keys(appParameters).length}</div>;
    };

    const { getByText } = render(
      <AppParametersProvider>
        <TestComponent />
      </AppParametersProvider>,
    );

    expect(getByText("0")).toBeDefined();
  });

  it("should throw an error if useAppParameters is called without AppParametersProvider", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const TestComponent = () => {
      useAppParameters();
      return <div />;
    };

    expect(() => render(<TestComponent />)).toThrow();
    consoleErrorSpy.mockRestore();
  });
});

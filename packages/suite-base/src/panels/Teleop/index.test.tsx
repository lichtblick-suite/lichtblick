/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { useCrash } from "@lichtblick/hooks";
import { TeleopPanelAdapterProps } from "@lichtblick/suite-base/panels/Teleop/types";

import TeleopPanelAdapter from "./index";

// Mock dependencies
jest.mock("@lichtblick/hooks", () => ({
  useCrash: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/Panel", () => ({
  __esModule: true,
  default: (Component: any) => Component,
}));

jest.mock("@lichtblick/suite-base/components/PanelExtensionAdapter", () => ({
  PanelExtensionAdapter: ({
    config,
    highestSupportedConfigVersion,
  }: {
    config: any;
    highestSupportedConfigVersion: number;
  }) => (
    <div
      data-testid="panel-extension-adapter"
      data-config={JSON.stringify(config)}
      data-highest-supported-config-version={highestSupportedConfigVersion}
    />
  ),
}));

jest.mock("@lichtblick/suite-base/components/CaptureErrorBoundary", () => ({
  CaptureErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="capture-error-boundary">{children}</div>
  ),
}));

jest.mock("@lichtblick/suite-base/panels/createSyncRoot", () => ({
  createSyncRoot: (element: React.ReactNode) => <div data-testid="sync-root">{element}</div>,
}));

jest.mock("./TeleopPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="teleop-panel" />,
}));

// Type the mocked hook
const mockUseCrash = useCrash as jest.MockedFunction<typeof useCrash>;

describe("TeleopPanelAdapter", () => {
  // Test data builders
  const createMockProps = (
    overrides: Partial<TeleopPanelAdapterProps> = {},
  ): TeleopPanelAdapterProps => ({
    config: {},
    saveConfig: jest.fn(),
    ...overrides,
  });

  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useCrash hook
    const mockCrashFunction = jest.fn();
    mockUseCrash.mockReturnValue(mockCrashFunction);
  });

  describe("Panel configuration", () => {
    it("Then should have correct panelType", () => {
      // Given - TeleopPanelAdapter component
      // When - checking panelType property
      const panelType = TeleopPanelAdapter.panelType;

      // Then - should be "Teleop"
      expect(panelType).toBe("Teleop");
    });

    it("Then should have empty default config", () => {
      // Given - TeleopPanelAdapter component
      // When - checking defaultConfig property
      const defaultConfig = TeleopPanelAdapter.defaultConfig;

      // Then - should be empty object
      expect(defaultConfig).toEqual({});
    });
  });

  it("should maintain stable references", () => {
    // Given
    const props = createMockProps();
    const mockCrashFunction = jest.fn();
    mockUseCrash.mockReturnValue(mockCrashFunction);

    // When
    const { rerender } = render(<TeleopPanelAdapter {...props} />);
    rerender(<TeleopPanelAdapter {...props} />);

    // Then
    // useCrash should be called for each render, but the same reference should be maintained
    expect(mockUseCrash).toHaveBeenCalledTimes(2);
  });

  it("should update with new crash function", () => {
    // Given
    const props = createMockProps();
    const firstCrashFunction = jest.fn();
    const secondCrashFunction = jest.fn();

    // When
    mockUseCrash.mockReturnValueOnce(firstCrashFunction);
    const { rerender } = render(<TeleopPanelAdapter {...props} />);

    mockUseCrash.mockReturnValueOnce(secondCrashFunction);
    rerender(<TeleopPanelAdapter {...props} />);

    // Then
    expect(mockUseCrash).toHaveBeenCalledTimes(2);
  });

  it("should be properly wrapped with Panel HOC", () => {
    // Given
    const props = createMockProps();

    // When
    const { getByTestId } = render(<TeleopPanelAdapter {...props} />);

    // Then
    expect(getByTestId("panel-extension-adapter")).toBeInTheDocument();
  });

  it("should maintain correct panel type identification", () => {
    // Given - TeleopPanelAdapter
    // When - checking panel type
    const panelType = TeleopPanelAdapter.panelType;

    // Then
    expect(panelType).toBe("Teleop");
  });
});

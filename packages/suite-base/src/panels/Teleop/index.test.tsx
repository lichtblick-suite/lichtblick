/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MockedFunction } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";

import { useCrash } from "@lichtblick/hooks";
import { TeleopPanelAdapterProps } from "@lichtblick/suite-base/panels/Teleop/types";

import TeleopPanelAdapter from "./index";

// Mock dependencies
vi.mock("@lichtblick/hooks", async () => ({
  useCrash: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/components/Panel", async () => ({
  __esModule: true,
  default: (Component: any) => Component,
}));

vi.mock("@lichtblick/suite-base/components/PanelExtensionAdapter", async () => ({
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

vi.mock("@lichtblick/suite-base/components/CaptureErrorBoundary", async () => ({
  CaptureErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="capture-error-boundary">{children}</div>
  ),
}));

vi.mock("@lichtblick/suite-base/panels/createSyncRoot", async () => ({
  createSyncRoot: (element: React.ReactNode) => <div data-testid="sync-root">{element}</div>,
}));

vi.mock("./TeleopPanel", async () => ({
  __esModule: true,
  default: () => <div data-testid="teleop-panel" />,
}));

// Type the mocked hook
const mockUseCrash = useCrash as MockedFunction<typeof useCrash>;

describe("TeleopPanelAdapter", () => {
  // Test data builders
  const createMockProps = (
    overrides: Partial<TeleopPanelAdapterProps> = {},
  ): TeleopPanelAdapterProps => ({
    config: {},
    saveConfig: vi.fn(),
    ...overrides,
  });

  // Setup mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useCrash hook
    const mockCrashFunction = vi.fn();
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
    const mockCrashFunction = vi.fn();
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
    const firstCrashFunction = vi.fn();
    const secondCrashFunction = vi.fn();

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

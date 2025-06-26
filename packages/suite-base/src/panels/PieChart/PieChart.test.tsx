/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import "@testing-library/jest-dom";

import { PanelExtensionContext } from "@lichtblick/suite";
import { useLegendCount } from "@lichtblick/suite-base/components/SettingsTreeEditor/useLegendCount";

import { PieChart, formatTooltip } from "./PieChart";
import { useSettingsTree } from "./useSettingsTree";

// Jest mock for hooks and context
jest.mock("@lichtblick/suite-base/components/SettingsTreeEditor/useLegendCount", () => ({
  useLegendCount: jest.fn(),
}));
jest.mock("./useSettingsTree", () => ({
  useSettingsTree: jest.fn(),
}));

const mockContext: Partial<PanelExtensionContext> = {
  saveState: jest.fn(),
  setDefaultPanelTitle: jest.fn(),
  updatePanelSettingsEditor: jest.fn(),
  subscribe: jest.fn(),
  unsubscribeAll: jest.fn(),
  onRender: jest.fn(),
  watch: jest.fn(),
};

describe("PieChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLegendCount as jest.Mock).mockReturnValue({ legendCount: 10 });
    (useSettingsTree as jest.Mock).mockReturnValue({
      general: {
        fields: {
          path: { label: "Message path", input: "messagepath", value: "" },
          title: { label: "Title", input: "string", value: "Pie Chart" },
        },
      },
    });
  });

  it("renders the PieChart component with default configuration", () => {
    render(<PieChart context={mockContext as PanelExtensionContext} />);

    // Verify that the title is displayed correctly
    expect(screen.getByText("Pie Chart")).toBeInTheDocument();

    // Verify that the "No data available" message is displayed when there is no data
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("updates the settings editor on render", () => {
    render(<PieChart context={mockContext as PanelExtensionContext} />);

    // Verify that the settings editor is updated correctly
    expect(mockContext.updatePanelSettingsEditor).toHaveBeenCalledWith({
      actionHandler: expect.any(Function),
      nodes: expect.any(Object),
    });
  });

  it("formats tooltip correctly", () => {
    // Verify that the tooltip is formatted correctly
    expect(formatTooltip(10, "Value")).toEqual(["10.00%", "Value"]);
    // @ts-expect-error intentionally passing string for test purposes
    expect(formatTooltip("N/A", "Value")).toEqual(["N/A%", "Value"]);
  });
});

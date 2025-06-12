/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PieChart } from "./PieChart";
import { useLegendCount } from "@lichtblick/suite-base/components/SettingsTreeEditor/useLegendCount";
import { useSettingsTree } from "./useSettingsTree";
import { PanelExtensionContext } from "@lichtblick/suite";

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
    const { formatTooltip } = require("./PieChart");

    // Verify that the tooltip is formatted correctly
    expect(formatTooltip(10, "Value")).toEqual(["10.00%", "Value"]);
    expect(formatTooltip("N/A", "Value")).toEqual(["N/A%", "Value"]);
  });
});

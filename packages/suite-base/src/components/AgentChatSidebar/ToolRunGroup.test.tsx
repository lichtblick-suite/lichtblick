/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import type { ToolRun } from "@lichtblick/suite-base/services/agent/types";

import { ToolRunGroup } from "./ToolRunGroup";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("./ToolRunCard", () => ({
  ToolRunCard: ({ toolRun }: { toolRun: ToolRun }) => (
    <div data-testid="tool-run-card">{toolRun.name}</div>
  ),
}));

function createT(): (key: string, options?: { count?: number }) => string {
  return (key: string, options?: { count?: number }) => {
    switch (key) {
      case "executionProcess":
        return "Execution process";
      case "steps":
        return `${String(options?.count ?? 0)} steps`;
      case "executionRunning":
        return "Running";
      case "executionFailed":
        return "Failed";
      case "executionComplete":
        return "Complete";
      case "executionExpand":
        return "Expand execution process";
      case "executionCollapse":
        return "Collapse execution process";
      default:
        return key;
    }
  };
}

const completedRuns: ToolRun[] = [
  { id: "tool-1", name: "load_skill", status: "succeeded" },
  { id: "tool-2", name: "get_data_catalog", status: "succeeded" },
];

describe("ToolRunGroup", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: createT() });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows one collapsed header with the step count by default", () => {
    render(<ToolRunGroup toolRuns={completedRuns} />);

    expect(screen.getByText("Execution process (2 steps)")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryAllByTestId("tool-run-card")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Expand execution process" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("renders the existing ToolRunCard list after expansion", () => {
    render(<ToolRunGroup toolRuns={completedRuns} />);

    fireEvent.click(screen.getByRole("button", { name: "Expand execution process" }));

    expect(screen.getAllByTestId("tool-run-card")).toHaveLength(2);
    expect(screen.getByText("load_skill")).toBeVisible();
    expect(screen.getByText("get_data_catalog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Collapse execution process" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("auto-expands when a run has an error", () => {
    render(
      <ToolRunGroup
        toolRuns={[
          {
            id: "tool-error",
            name: "load_skill",
            status: "failed",
            error: "Request failed",
          },
        ]}
      />,
    );

    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByTestId("tool-run-card")).toHaveTextContent("load_skill");
  });

  it("shows running state without forcing the group open when tools are added", () => {
    const { rerender } = render(<ToolRunGroup toolRuns={completedRuns} />);

    rerender(
      <ToolRunGroup
        toolRuns={[
          ...completedRuns,
          { id: "tool-running", name: "playback_control", status: "running" },
        ]}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "Running" })).toBeVisible();
    expect(screen.getByText("Running")).toBeVisible();
    expect(screen.queryAllByTestId("tool-run-card")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Expand execution process" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

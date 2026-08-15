/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { ToolRun } from "@lichtblick/suite-base/services/agent/types";

import { ToolRunCard } from "./ToolRunCard";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

function createT(): (key: string, options?: { name?: string }) => string {
  return (key: string, options?: { name?: string }) => {
    switch (key) {
      case "toolExpand":
        return `Expand details for ${options?.name ?? ""}`;
      case "toolCollapse":
        return `Collapse details for ${options?.name ?? ""}`;
      case "toolResultTruncated":
        return "Result truncated; showing the first 4000 characters.";
      case "toolStatus.queued":
        return "Queued";
      case "toolStatus.running":
        return "Running";
      case "toolStatus.succeeded":
        return "Succeeded";
      case "toolStatus.failed":
        return "Failed";
      case "toolStatus.cancelled":
        return "Cancelled";
      case "toolProgress":
        return `Progress for ${options?.name ?? ""}`;
      default:
        return key;
    }
  };
}

function renderToolRun(toolRun: ToolRun): void {
  render(<ToolRunCard toolRun={toolRun} />);
}

describe("ToolRunCard", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: createT() });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("collapses the summary by default while keeping header and progress visible", () => {
    renderToolRun({
      id: "run-1",
      name: "search_records",
      status: "running",
      progress: 40,
      summary: "Searching 3 data sources",
    });

    expect(screen.getByText("search_records")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    const summary = screen.getByText("Searching 3 data sources");
    expect(summary).toBeInTheDocument();
    expect(summary).not.toBeVisible();

    const toggle = screen.getByRole("button", { name: "Expand details for search_records" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("expands and collapses details when the header toggle is clicked", async () => {
    renderToolRun({
      id: "run-2",
      name: "query",
      status: "succeeded",
      summary: "Found 2 records",
    });

    const summary = screen.getByText("Found 2 records");
    expect(summary).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Expand details for query" }));
    expect(summary).toBeVisible();
    expect(screen.getByRole("button", { name: "Collapse details for query" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse details for query" }));
    await waitFor(() => {
      expect(summary).not.toBeVisible();
    });
  });

  it("auto-expands failed runs so the error is visible", () => {
    renderToolRun({
      id: "run-4",
      name: "download",
      status: "failed",
      summary: "Downloading recording",
      error: "Connection refused",
    });

    expect(screen.getByText("Connection refused")).toBeVisible();
    expect(screen.getByText("Downloading recording")).toBeVisible();
  });

  it("renders the tool run result as formatted JSON inside the expanded body", () => {
    const result = { count: 2, items: [{ id: "a" }, { id: "b" }] };
    renderToolRun({
      id: "run-5",
      name: "search",
      status: "succeeded",
      summary: "Done",
      result,
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand details for search" }));

    const pre = screen.getByTestId("tool-run-result");
    const expected = (JSON.stringify(result, null, 2) ?? "").replace(/\s+/g, " ").trim();
    expect(pre.textContent.replace(/\s+/g, " ").trim()).toBe(expected);
  });

  it("truncates results longer than 4000 characters with a notice", () => {
    renderToolRun({
      id: "run-6",
      name: "dump",
      status: "succeeded",
      summary: "Done",
      result: { data: "x".repeat(5000) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand details for dump" }));

    const pre = screen.getByTestId("tool-run-result");
    expect(pre.textContent).toContain("Result truncated; showing the first 4000 characters.");
    expect(pre.textContent).toHaveLength(
      4000 + "\n… Result truncated; showing the first 4000 characters.".length,
    );
    // The tail of the serialized JSON must have been cut off.
    expect(pre.textContent).not.toContain('"\n}');
  });
});

/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { BasicBuilder } from "@lichtblick/test-builders";

import Start from "./Start";

vi.mock("react-i18next", async () => ({
  useTranslation: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/AnalyticsContext", async () => ({
  useAnalytics: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/PlayerSelectionContext", async () => ({
  usePlayerSelection: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", async () => ({
  useWorkspaceActions: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks", async () => ({
  useAppConfigurationValue: vi.fn().mockImplementation(() => [true, vi.fn()]),
}));

vi.mock("@lichtblick/suite-base/components/DataSourceDialog/index.style", async () => ({
  useStyles: () => ({
    classes: {
      grid: "grid",
      header: "header",
      logo: "logo",
      content: "content",
      recentListItemButton: "recentListItemButton",
      recentSourceSecondary: "recentSourceSecondary",
      spacer: "spacer",
      sidebar: "sidebar",
    },
  }),
}));

describe("Start Component", () => {
  const mockLogEvent = vi.fn();
  const mockSelectRecent = vi.fn();
  const mockOpenDialog = vi.fn();

  const mockRecentSources = BasicBuilder.multiple(() => ({
    id: BasicBuilder.string(),
    title: BasicBuilder.string(),
  }));

  beforeEach(() => {
    (useTranslation as Mock).mockReturnValue({
      t: (key: string) => key,
    });

    (useAnalytics as Mock).mockReturnValue({
      logEvent: mockLogEvent,
    });

    (usePlayerSelection as Mock).mockReturnValue({
      recentSources: mockRecentSources,
      selectRecent: mockSelectRecent,
    });

    (useWorkspaceActions as Mock).mockReturnValue({
      dialogActions: {
        dataSource: {
          open: mockOpenDialog,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Start component correctly", () => {
    // GIVEN
    render(<Start />);

    // THEN
    expect(screen.getByText("openDataSource")).toBeInTheDocument();
    expect(screen.getByText("openLocalFiles")).toBeInTheDocument();
    expect(screen.getByText("openConnection")).toBeInTheDocument();
    expect(screen.getByText("recentDataSources")).toBeInTheDocument();
    mockRecentSources.forEach((source) => {
      expect(screen.getByText(source.title)).toBeInTheDocument();
    });
  });

  it("handles 'open-local-file' button click", () => {
    // GIVEN
    render(<Start />);

    // WHEN
    const localFileButton = screen.getByText("openLocalFiles");
    fireEvent.click(localFileButton);

    // THEN
    expect(mockOpenDialog).toHaveBeenCalledWith("file");
  });

  it("handles 'open-connection' button click", () => {
    // GIVEN
    render(<Start />);

    // WHEN
    const connectionButton = screen.getByText("openConnection");
    fireEvent.click(connectionButton);

    // THEN
    expect(mockOpenDialog).toHaveBeenCalledWith("connection");
  });

  it("handles recent source selection", () => {
    // GIVEN
    render(<Start />);

    mockRecentSources.forEach((source) => {
      // WHEN
      fireEvent.click(screen.getByText(source.title));

      // THEN
      expect(mockSelectRecent).toHaveBeenCalledWith(source.id);
    });
  });

  it("does not render recent sources section if there are no recent sources", () => {
    // GIVEN
    (usePlayerSelection as Mock).mockReturnValue({
      recentSources: [],
      selectRecent: mockSelectRecent,
    });

    // WHEN
    render(<Start />);

    // THEN
    expect(screen.queryByText("recentDataSources")).not.toBeInTheDocument();
  });
});

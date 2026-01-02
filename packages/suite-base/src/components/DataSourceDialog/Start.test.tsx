/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { BasicBuilder } from "@lichtblick/test-builders";

import Start from "./Start";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn().mockImplementation(() => [true, jest.fn()]),
}));

jest.mock("@lichtblick/suite-base/components/DataSourceDialog/index.style", () => ({
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
  const mockLogEvent = jest.fn();
  const mockSelectRecent = jest.fn();
  const mockOpenDialog = jest.fn();

  const mockRecentSources = BasicBuilder.multiple(() => ({
    id: BasicBuilder.string(),
    title: BasicBuilder.string(),
  }));

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });

    (useAnalytics as jest.Mock).mockReturnValue({
      logEvent: mockLogEvent,
    });

    (usePlayerSelection as jest.Mock).mockReturnValue({
      recentSources: mockRecentSources,
      selectRecent: mockSelectRecent,
    });

    (useWorkspaceActions as jest.Mock).mockReturnValue({
      dialogActions: {
        dataSource: {
          open: mockOpenDialog,
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    (usePlayerSelection as jest.Mock).mockReturnValue({
      recentSources: [],
      selectRecent: mockSelectRecent,
    });

    // WHEN
    render(<Start />);

    // THEN
    expect(screen.queryByText("recentDataSources")).not.toBeInTheDocument();
  });
});

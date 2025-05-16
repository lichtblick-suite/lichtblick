/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

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

jest.mock("@lichtblick/suite-base/components/DataSourceDialog/style", () => ({
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

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });

    (useAnalytics as jest.Mock).mockReturnValue({
      logEvent: mockLogEvent,
    });

    (usePlayerSelection as jest.Mock).mockReturnValue({
      recentSources: [
        { id: "1", title: "Recent Source 1" },
        { id: "2", title: "Recent Source 2" },
      ],
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
    render(<Start />);

    expect(screen.getByText("openDataSource")).toBeInTheDocument();
    expect(screen.getByText("openLocalFiles")).toBeInTheDocument();
    expect(screen.getByText("openConnection")).toBeInTheDocument();
    expect(screen.getByText("recentDataSources")).toBeInTheDocument();
    expect(screen.getByText("Recent Source 1")).toBeInTheDocument();
    expect(screen.getByText("Recent Source 2")).toBeInTheDocument();
  });

  it("handles 'open-local-file' button click", () => {
    render(<Start />);

    const localFileButton = screen.getByText("openLocalFiles");
    fireEvent.click(localFileButton);

    expect(mockOpenDialog).toHaveBeenCalledWith("file");
  });

  it("handles 'open-connection' button click", () => {
    render(<Start />);

    const connectionButton = screen.getByText("openConnection");
    fireEvent.click(connectionButton);

    expect(mockOpenDialog).toHaveBeenCalledWith("connection");
  });

  it("handles recent source selection", () => {
    render(<Start />);

    const recentSourceButton = screen.getByText("Recent Source 1");
    fireEvent.click(recentSourceButton);

    expect(mockSelectRecent).toHaveBeenCalledWith("1");
  });

  it("does not render recent sources section if there are no recent sources", () => {
    (usePlayerSelection as jest.Mock).mockReturnValue({
      recentSources: [],
      selectRecent: mockSelectRecent,
    });

    render(<Start />);

    expect(screen.queryByText("recentDataSources")).not.toBeInTheDocument();
  });
});

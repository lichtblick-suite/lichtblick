/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import "@testing-library/jest-dom/vitest";

import { LICHTBLICK_DOCUMENTATION_LINK } from "@lichtblick/suite-base/constants/documentation";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/BaseUserContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import SidebarItems from "./SidebarItems";

vi.mock("react-i18next", async () => ({
  useTranslation: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/AnalyticsContext", async () => ({
  useAnalytics: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/BaseUserContext", async () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/components/DataSourceDialog/index.style", async () => ({
  useStyles: () => ({ classes: { button: "mock-button-class" } }),
}));

vi.mock("@lichtblick/suite-base/hooks", async () => ({
  useAppConfigurationValue: vi.fn(),
}));

describe("SidebarItems", () => {
  const mockOnSelectView = vi.fn();
  const mockLogEvent = vi.fn();
  const mockTranslation = {
    t: (key: string) => key,
  };

  beforeEach(() => {
    (useTranslation as Mock).mockReturnValue(mockTranslation);
    (useAnalytics as Mock).mockReturnValue({ logEvent: mockLogEvent });
    (useAppConfigurationValue as Mock).mockReturnValue([true, vi.fn()]);
    vi.clearAllMocks();
  });

  it("renders items for unauthenticated users", () => {
    (useCurrentUser as Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("newToLichtblick")).toBeInTheDocument();
    expect(screen.getByText("newToLichtblickDescription")).toBeInTheDocument();
    expect(screen.getByText("exploreSampleData")).toBeInTheDocument();
    expect(screen.getByText("viewDocumentation")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("renders items for authenticated-free users", () => {
    (useCurrentUser as Mock).mockReturnValue({ currentUserType: "authenticated-free" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("startCollaborating")).toBeInTheDocument();
    expect(screen.getByText("startCollaboratingDescription")).toBeInTheDocument();
    expect(screen.getByText("uploadToDataPlatform")).toBeInTheDocument();
    expect(screen.getByText("shareLayouts")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("renders items for authenticated-team users", () => {
    (useCurrentUser as Mock).mockReturnValue({ currentUserType: "authenticated-team" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("newToLichtblick")).toBeInTheDocument();
    expect(screen.getByText("needHelp")).toBeInTheDocument();
    expect(screen.getByText("needHelpDescription")).toBeInTheDocument();
    expect(screen.getByText("seeTutorials")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("handles button clicks correctly", () => {
    (useCurrentUser as Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    const exploreSampleDataButton = screen.getByText("exploreSampleData");
    fireEvent.click(exploreSampleDataButton);

    expect(mockOnSelectView).toHaveBeenCalledWith("demo");
  });

  it("opens external links correctly", () => {
    (useCurrentUser as Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => window);
    render(<SidebarItems onSelectView={mockOnSelectView} />);

    const documentationButton = screen.getByText("viewDocumentation");
    fireEvent.click(documentationButton);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      LICHTBLICK_DOCUMENTATION_LINK,
      "_blank",
      "noopener,noreferrer",
    );
  });
});

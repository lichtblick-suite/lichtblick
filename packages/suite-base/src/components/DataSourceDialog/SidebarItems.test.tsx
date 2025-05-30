/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import "@testing-library/jest-dom";

import { LICHTBLICK_DOCUMENTATION_LINK } from "@lichtblick/suite-base/constants/documentation";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/BaseUserContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import SidebarItems from "./SidebarItems";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/BaseUserContext", () => ({
  useCurrentUser: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/DataSourceDialog/index.style", () => ({
  useStyles: () => ({ classes: { button: "mock-button-class" } }),
}));

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
}));

describe("SidebarItems", () => {
  const mockOnSelectView = jest.fn();
  const mockLogEvent = jest.fn();
  const mockTranslation = {
    t: (key: string) => key,
  };

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue(mockTranslation);
    (useAnalytics as jest.Mock).mockReturnValue({ logEvent: mockLogEvent });
    (useAppConfigurationValue as jest.Mock).mockReturnValue([true, jest.fn()]);
    jest.clearAllMocks();
  });

  it("renders items for unauthenticated users", () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("newToLichtblick")).toBeInTheDocument();
    expect(screen.getByText("newToLichtblickDescription")).toBeInTheDocument();
    expect(screen.getByText("exploreSampleData")).toBeInTheDocument();
    expect(screen.getByText("viewDocumentation")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("renders items for authenticated-free users", () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUserType: "authenticated-free" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("startCollaborating")).toBeInTheDocument();
    expect(screen.getByText("startCollaboratingDescription")).toBeInTheDocument();
    expect(screen.getByText("uploadToDataPlatform")).toBeInTheDocument();
    expect(screen.getByText("shareLayouts")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("renders items for authenticated-team users", () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUserType: "authenticated-team" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    expect(screen.getByText("newToLichtblick")).toBeInTheDocument();
    expect(screen.getByText("needHelp")).toBeInTheDocument();
    expect(screen.getByText("needHelpDescription")).toBeInTheDocument();
    expect(screen.getByText("seeTutorials")).toBeInTheDocument();
    expect(screen.getByText("dontShowThisAgain")).toBeInTheDocument();
  });

  it("handles button clicks correctly", () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    render(<SidebarItems onSelectView={mockOnSelectView} />);

    const exploreSampleDataButton = screen.getByText("exploreSampleData");
    fireEvent.click(exploreSampleDataButton);

    expect(mockOnSelectView).toHaveBeenCalledWith("demo");
  });

  it("opens external links correctly", () => {
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUserType: "unauthenticated" });

    const windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => window);
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

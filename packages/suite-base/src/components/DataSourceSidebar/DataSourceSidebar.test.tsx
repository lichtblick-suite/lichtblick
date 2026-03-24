/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useCurrentUser } from "@lichtblick/suite-base/context/CurrentUserContext";
import { useEvents } from "@lichtblick/suite-base/context/EventsContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import useAlertCount from "@lichtblick/suite-base/hooks/useAlertCount";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import DataSourceSidebar from "./DataSourceSidebar";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentUserContext", () => ({
  useCurrentUser: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/EventsContext", () => ({
  useEvents: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useAlertCount", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useAppConfigurationValue", () => ({
  useAppConfigurationValue: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/SidebarContent", () => ({
  SidebarContent: ({
    children,
    trailingItems,
  }: React.PropsWithChildren<{ trailingItems?: React.ReactNode }>) => (
    <div>
      {trailingItems}
      {children}
    </div>
  ),
}));

jest.mock("@lichtblick/suite-base/components/TopicList", () => ({
  TopicList: () => <div data-testid="topic-list" />,
}));

jest.mock("@lichtblick/suite-base/components/EventsList", () => ({
  EventsList: () => <div data-testid="events-list" />,
}));

jest.mock("@lichtblick/suite-base/components/WssErrorModal", () => ({
  __esModule: true,
  default: () => <div data-testid="wss-error-modal" />,
}));

jest.mock("../AlertsList", () => ({
  AlertsList: () => <div data-testid="alerts-list" />,
}));

jest.mock("../DataSourceInfoView", () => ({
  DataSourceInfoView: () => <div data-testid="data-source-info-view" />,
}));

describe("DataSourceSidebar - Alerts tab badge", () => {
  const mockUseMessagePipeline = useMessagePipeline as jest.Mock;
  const mockUseAlertCount = useAlertCount as jest.Mock;
  const mockUseCurrentUser = useCurrentUser as jest.Mock;
  const mockUseEvents = useEvents as jest.Mock;
  const mockUseWorkspaceActions = useWorkspaceActions as jest.Mock;
  const mockUseAppConfigurationValue = useAppConfigurationValue as jest.Mock;

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: (key: string) => key });
    mockUseMessagePipeline.mockReturnValue(PlayerPresence.PRESENT);
    mockUseCurrentUser.mockReturnValue({ currentUser: undefined });
    mockUseEvents.mockReturnValue(undefined);
    mockUseWorkspaceActions.mockReturnValue({
      dialogActions: { dataSource: { open: jest.fn() } },
    });
    mockUseAppConfigurationValue.mockReturnValue([true]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should not show the badge when alertCount is 0", () => {
    // Given
    mockUseAlertCount.mockReturnValue({ playerAlerts: [], sessionAlerts: [], alertCount: 0 });

    // When
    render(<DataSourceSidebar />);

    // Then
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should show the badge with count 1 when alertCount is 1", () => {
    // Given
    mockUseAlertCount.mockReturnValue({
      playerAlerts: [{ message: "error", severity: "error" }],
      sessionAlerts: [],
      alertCount: 1,
    });

    // When
    render(<DataSourceSidebar />);

    // Then
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should show the correct count in the badge for multiple alerts", () => {
    // Given
    mockUseAlertCount.mockReturnValue({
      playerAlerts: [
        { message: "error 1", severity: "error" },
        { message: "error 2", severity: "warn" },
      ],
      sessionAlerts: [{ message: "session error", severity: "error" }],
      alertCount: 3,
    });

    // When
    render(<DataSourceSidebar />);

    // Then
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should not render the Alerts tab when playerPresence is NOT_PRESENT", () => {
    // Given
    mockUseAlertCount.mockReturnValue({ playerAlerts: [], sessionAlerts: [], alertCount: 5 });
    mockUseMessagePipeline.mockReturnValue(PlayerPresence.NOT_PRESENT);

    // When
    render(<DataSourceSidebar />);

    // Then
    expect(screen.queryByText("Alerts")).not.toBeInTheDocument();
  });

  it("should not render the Alerts tab when disableToolbar is true", () => {
    // Given
    mockUseAlertCount.mockReturnValue({
      playerAlerts: [{ message: "error", severity: "error" }],
      sessionAlerts: [],
      alertCount: 1,
    });

    // When
    render(<DataSourceSidebar disableToolbar />);

    // Then
    expect(screen.queryByText("Alerts")).not.toBeInTheDocument();
  });
});

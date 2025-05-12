/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SyncInstanceToggle.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";

import "@testing-library/jest-dom";

import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import SyncInstanceToggle from "./SyncInstanceToggle";

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));

jest.mock("./SyncInstanceToggle.style", () => ({
  useStyles: () => ({
    classes: {
      button: "mock-button",
      textWrapper: "mock-text-wrapper",
      syncText: "mock-sync-text",
      onOffText: "mock-onoff-text",
    },
  }),
}));

describe("SyncInstanceToggle", () => {
  const useWorkspaceActionsMock = useWorkspaceActions as jest.Mock;
  const useAppConfigurationValueMock = useAppConfigurationValue as jest.Mock;
  const useWorkspaceStoreMock = useWorkspaceStore as jest.Mock;

  const setSyncInstancesMock = jest.fn();

  beforeEach(() => {
    useWorkspaceActionsMock.mockReturnValue({
      playbackControlActions: { setSyncInstances: setSyncInstancesMock },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns null and disables sync if config is false", () => {
    useAppConfigurationValueMock.mockReturnValue([false]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    const { container } = render(<SyncInstanceToggle />);

    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(false);
    expect(container.firstChild).toBeNull();
  });

  it("renders button with correct text when sync is on", () => {
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    render(<SyncInstanceToggle />);

    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("on")).toBeInTheDocument();
  });

  it("renders button with correct text when sync is off", () => {
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );

    render(<SyncInstanceToggle />);

    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("off")).toBeInTheDocument();
  });

  it("toggles sync state on button click (turn on)", () => {
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementationOnce((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );

    render(<SyncInstanceToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(true);
  });

  it("toggles sync state on button click (turn off", () => {
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementationOnce((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    render(<SyncInstanceToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(false);
  });
});

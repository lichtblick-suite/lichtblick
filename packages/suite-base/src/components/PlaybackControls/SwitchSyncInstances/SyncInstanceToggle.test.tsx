/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
    // GIVEN
    useAppConfigurationValueMock.mockReturnValue([false]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    // WHEN
    const { container } = render(<SyncInstanceToggle />);

    // THEN
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(false);
    expect(container.firstChild).toBeNull();
  });

  it("renders button with correct text when sync is on", () => {
    // GIVEN
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    // WHEN
    render(<SyncInstanceToggle />);

    // THEN
    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("on")).toBeInTheDocument();
  });

  it("renders button with correct text when sync is off", () => {
    // GIVEN
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );

    // WHEN
    render(<SyncInstanceToggle />);

    // THEN
    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("off")).toBeInTheDocument();
  });

  it("toggles sync state on button click (turn on)", () => {
    // GIVEN sync is initially off
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementationOnce((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );

    // WHEN user clicks the button
    render(<SyncInstanceToggle />);
    fireEvent.click(screen.getByRole("button"));

    // THEN sync is turned on
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(true);
  });

  it("toggles sync state on button click (turn off)", () => {
    // GIVEN sync is initially on
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementationOnce((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    // WHEN user clicks the button
    render(<SyncInstanceToggle />);
    fireEvent.click(screen.getByRole("button"));

    // THEN sync is turned off
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(false);
  });

  it("should turn synchronization off when experimental feature is disabled", () => {
    // GIVEN feature is initially enabled
    useAppConfigurationValueMock.mockReturnValue([true]);
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: true } }),
    );

    const { rerender } = render(<SyncInstanceToggle />);
    expect(setSyncInstancesMock).not.toHaveBeenCalled();

    // WHEN feature is disabled and component re-renders
    useAppConfigurationValueMock.mockReturnValue([false]);
    rerender(<SyncInstanceToggle />);

    // THEN syncInstances is explicitly turned off
    expect(setSyncInstancesMock).toHaveBeenCalledTimes(1);
    expect(setSyncInstancesMock).toHaveBeenCalledWith(false);
  });

  it("should not deactivate synchronization when experimental feature is disabled", () => {
    // GIVEN feature is initially disabled
    useAppConfigurationValueMock.mockReturnValue([false]);

    // WHEN sync is off
    useWorkspaceStoreMock.mockImplementation((selector: any) =>
      selector({ playbackControls: { syncInstances: false } }),
    );
    render(<SyncInstanceToggle />);

    // THEN syncInstances is not explicitly turned off
    expect(setSyncInstancesMock).not.toHaveBeenCalled();
  });
});

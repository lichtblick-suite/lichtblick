/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SyncInstanceToggle.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

import SyncInstanceToggle from "./SyncInstanceToggle";

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

  it("renders button with correct text when sync is on", () => {
    // GIVEN
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
});

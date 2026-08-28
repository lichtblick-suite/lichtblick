/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

import { AppSettingsDialog } from "./AppSettingsDialog";

const mockCommitAgentSettings = jest.fn<Promise<boolean>, []>();
const mockAgentSettings = jest.fn(
  ({
    onCommitHandlerChange,
  }: {
    onCommitHandlerChange?: (handler: (() => Promise<boolean>) | undefined) => void;
  }) => {
    useEffect(() => {
      onCommitHandlerChange?.(mockCommitAgentSettings);
      return () => {
        onCommitHandlerChange?.(undefined);
      };
    }, [onCommitHandlerChange]);
    return <input aria-label="API key" />;
  },
);

jest.mock("@lichtblick/suite-base/context/AppContext", () => ({
  useAppContext: () => ({ extensionSettings: <div /> }),
}));
jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: () => undefined,
}));
jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock("./settings", () => ({
  AutoUpdate: () => null,
  ColorSchemeSettings: () => null,
  LanguageSettings: () => null,
  LaunchDefault: () => null,
  MessageFramerate: () => null,
  RosPackagePath: () => null,
  StepSize: () => null,
  TimeFormat: () => null,
  TimezoneSettings: () => null,
}));
jest.mock("./AgentSettings", () => ({
  AgentSettings: (props: unknown) => mockAgentSettings(props as never),
}));

describe("AppSettingsDialog Agent tab", () => {
  beforeEach(() => {
    mockAgentSettings.mockClear();
    mockCommitAgentSettings.mockReset();
    mockCommitAgentSettings.mockResolvedValue(true);
  });

  it("mounts secrets only on the Agent tab and commits before leaving it", async () => {
    const configuration = makeMockAppConfiguration();
    render(
      <AppConfigurationContext.Provider value={configuration}>
        <AppSettingsDialog open activeTab="general" />
      </AppConfigurationContext.Provider>,
    );

    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(mockAgentSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Agent" }));
    expect(await screen.findByLabelText("API key")).toBeInTheDocument();
    expect(mockAgentSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    await waitFor(() => {
      expect(mockCommitAgentSettings).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    });
  });

  it("keeps the Agent tab open when its atomic commit fails", async () => {
    mockCommitAgentSettings.mockResolvedValue(false);
    const configuration = makeMockAppConfiguration();
    render(
      <AppConfigurationContext.Provider value={configuration}>
        <AppSettingsDialog open activeTab="agent" />
      </AppConfigurationContext.Provider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "General" }));

    await waitFor(() => {
      expect(mockCommitAgentSettings).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText("API key")).toBeInTheDocument();
    });
  });

  it("commits the Agent draft before closing the dialog", async () => {
    const onClose = jest.fn();
    const configuration = makeMockAppConfiguration();
    render(
      <AppConfigurationContext.Provider value={configuration}>
        <AppSettingsDialog open activeTab="agent" onClose={onClose} />
      </AppConfigurationContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(mockCommitAgentSettings).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

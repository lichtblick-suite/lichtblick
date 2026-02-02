/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { useSnackbar } from "notistack";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useDataSourceInfo, useMessagesByTopic } from "@lichtblick/suite-base/PanelAPI";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useAppTimeFormat } from "@lichtblick/suite-base/hooks/useAppTimeFormat";
import {
  useDefaultPanelTitle,
  usePanelSettingsTreeUpdate,
} from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import LogPanel from "./index";
import { Config, LogMessageEvent } from "./types";

jest.mock("@lichtblick/suite-base/components/Panel", () => ({
  __esModule: true,
  default: (Component: React.ComponentType<unknown>) => Component,
}));

jest.mock("@lichtblick/suite-base/components/PanelToolbar", () => ({
  __esModule: true,
  default: ({
    additionalIcons,
    children,
  }: {
    additionalIcons?: ReactNode;
    children?: ReactNode;
  }) => (
    <div data-testid="panel-toolbar">
      {additionalIcons}
      {children}
    </div>
  ),
}));

jest.mock("@lichtblick/suite-base/components/PanelToolbar/ToolbarIconButton", () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => (
    <button data-testid="toolbar-icon-button">{children}</button>
  ),
}));

jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: jest.fn(),
  useMessagesByTopic: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  usePanelSettingsTreeUpdate: jest.fn(),
  useDefaultPanelTitle: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useAppTimeFormat", () => ({
  useAppTimeFormat: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("notistack", () => ({
  useSnackbar: jest.fn(),
}));

jest.mock("./LogList", () => ({
  __esModule: true,
  default: ({ items }: { items: unknown[] }) => (
    <div data-testid="log-list">{`count:${items.length}`}</div>
  ),
}));

type LogPanelProps = {
  config: Config;
  saveConfig: jest.Mock;
};

function buildLogMessage(topicName: string, schemaName: string): LogMessageEvent {
  return MessageEventBuilder.messageEvent({
    topic: topicName,
    schemaName,
    message: {
      header: DiagnosticsBuilder.header(),
      level: 2,
      name: BasicBuilder.string(),
      msg: BasicBuilder.string(),
      file: BasicBuilder.string(),
      function: BasicBuilder.string(),
      line: BasicBuilder.number(),
      topics: BasicBuilder.strings(),
    },
  }) as LogMessageEvent;
}

const LogPanelComponent = LogPanel as unknown as React.ComponentType<LogPanelProps>;

describe("LogPanel", () => {
  const mockUseDataSourceInfo = useDataSourceInfo as jest.Mock;
  const mockUseMessagesByTopic = useMessagesByTopic as jest.Mock;
  const mockUsePanelSettingsTreeUpdate = usePanelSettingsTreeUpdate as jest.Mock;
  const mockUseDefaultPanelTitle = useDefaultPanelTitle as jest.Mock;
  const mockUseTranslation = useTranslation as jest.Mock;
  const mockUseSnackbar = useSnackbar as jest.Mock;
  const mockUseAppTimeFormat = useAppTimeFormat as jest.Mock;

  beforeEach(() => {
    mockUsePanelSettingsTreeUpdate.mockReturnValue(jest.fn());
    mockUseDefaultPanelTitle.mockReturnValue([undefined, jest.fn()]);
    mockUseTranslation.mockReturnValue({ t: (key: string) => key });
    mockUseSnackbar.mockReturnValue({ enqueueSnackbar: jest.fn() });
    mockUseAppTimeFormat.mockReturnValue({ timeFormat: "SEC", timeZone: "UTC" });
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  function setup(messages?: LogMessageEvent[]) {
    const topic = PlayerBuilder.topic({ name: "/rosout", schemaName: "rosgraph_msgs/Log" });
    const config: Config = {
      searchTerms: [],
      minLogLevel: 1,
      topicToRender: topic.name,
    };

    mockUseDataSourceInfo.mockReturnValue({
      topics: [topic],
      services: [],
      datatypes: {},
      capabilities: [],
      playerId: BasicBuilder.string(),
    });

    mockUseMessagesByTopic.mockReturnValue({
      [topic.name]: messages ?? [buildLogMessage(topic.name, topic.schemaName ?? "")],
    });

    const saveConfig = jest.fn();

    const ui = (
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <LogPanelComponent config={config} saveConfig={saveConfig} />
        </MockPanelContextProvider>
      </ThemeProvider>
    );

    return {
      ...render(ui),
      saveConfig,
    };
  }

  it("should render the log panel root", () => {
    // Given
    setup();

    // When
    const panelRoot = screen.getByTestId("log-panel-root");

    // Then
    expect(panelRoot).toBeInTheDocument();
  });

  it("should render the log list", () => {
    // Given
    setup([buildLogMessage("/rosout", "rosgraph_msgs/Log")]);

    // When
    const logList = screen.getByTestId("log-list");

    // Then
    expect(logList).toBeInTheDocument();
  });
});

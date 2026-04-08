/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import PublishBuilder from "@lichtblick/suite-base/testing/builders/PublishBuilder";

import Publish from "./index";
import { PublishConfig } from "./types";

const mockPublish = jest.fn();

jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: jest.fn(() => ({
    topics: [],
    datatypes: new Map(),
    capabilities: [],
  })),
  useConfigById: jest.fn(() => [undefined, jest.fn()]),
}));

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  ...jest.requireActual("@lichtblick/suite-base/components/MessagePipeline"),
  useMessagePipeline: jest.fn(() => undefined),
}));

jest.mock("@lichtblick/suite-base/hooks/usePublisher", () => ({
  __esModule: true,
  default: jest.fn(() => mockPublish),
}));

jest.mock("@lichtblick/suite-base/hooks/useCallbackWithToast", () => ({
  __esModule: true,
  default: (fn: unknown) => fn,
}));

jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  ...jest.requireActual("@lichtblick/suite-base/providers/PanelStateContextProvider"),
  usePanelSettingsTreeUpdate: jest.fn(),
  useDefaultPanelTitle: jest.fn(() => ["Publish", jest.fn()]),
}));

jest.mock("./settings", () => ({
  usePublishPanelSettings: jest.fn(),
  defaultConfig: {
    buttonText: "Publish",
    buttonTooltip: "",
    advancedView: true,
    value: "{}",
  },
}));

describe("Publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup(configOverride: Partial<PublishConfig> = {}, capabilities: string[] = []) {
    const config = PublishBuilder.config(configOverride);
    (useDataSourceInfo as jest.Mock).mockReturnValue({
      topics: [],
      datatypes: new Map(),
      capabilities,
    });

    const ui = (
      <PanelSetup>
        <Publish overrideConfig={config} />
      </PanelSetup>
    );

    return { ...render(ui), config };
  }

  describe("when advancedView is enabled", () => {
    it("renders the JSON textarea", () => {
      // Given / When
      setup({ advancedView: true });

      // Then
      expect(screen.getByPlaceholderText("Enter message content as JSON")).toBeInTheDocument();
    });
  });

  describe("when advancedView is disabled", () => {
    it("does not render the JSON textarea", () => {
      // Given / When
      setup({ advancedView: false });

      // Then
      expect(
        screen.queryByPlaceholderText("Enter message content as JSON"),
      ).not.toBeInTheDocument();
    });
  });

  describe("when not connected to a data source with publish capability", () => {
    it("shows a status message to connect to a data source", () => {
      // Given / When
      setup({}, []);

      // Then
      expect(
        screen.getByText("Connect to a data source that supports publishing"),
      ).toBeInTheDocument();
    });
  });

  describe("when connected but topic and datatype are not configured", () => {
    it("shows a status message to configure topic and schema", () => {
      // Given / When
      setup({ topicName: "", datatype: "" }, [PLAYER_CAPABILITIES.advertise]);

      // Then
      expect(
        screen.getByText("Configure a topic and message schema in the panel settings"),
      ).toBeInTheDocument();
    });
  });

  describe("when all publish conditions are met", () => {
    it("enables the publish button", () => {
      // Given / When
      const { config } = setup({ value: '{"data": "hello"}' }, [PLAYER_CAPABILITIES.advertise]);

      // Then
      expect(screen.getByRole("button", { name: config.buttonText })).not.toBeDisabled();
    });

    it("calls publish when the button is clicked", async () => {
      // Given
      const { config } = setup({ value: '{"data": "hello"}' }, [PLAYER_CAPABILITIES.advertise]);

      // When
      await userEvent.click(screen.getByRole("button", { name: config.buttonText }));

      // Then
      expect(mockPublish).toHaveBeenCalledWith({ data: "hello" });
    });
  });

  describe("when the JSON value is invalid", () => {
    it("shows a parse error", () => {
      // Given / When
      setup({ value: "not-json" }, [PLAYER_CAPABILITIES.advertise]);

      // Then
      expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    });
  });
});

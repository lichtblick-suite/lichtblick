/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { buildSettingsTree } from "@lichtblick/suite-base/components/PanelSettings/settingsTree";
import { BuildSettingsTreeProps } from "@lichtblick/suite-base/components/PanelSettings/types";
import { PanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";

jest.mock("@lichtblick/suite-base/util/maybeCast");

describe("buildSettingsTree", () => {
  function setup(): Pick<
    BuildSettingsTreeProps,
    "extensionSettings" | "messagePipelineState" | "config"
  > & { settingsTreeNodes: SettingsTreeNodes; state: PanelStateStore } {
    const config: Record<string, unknown> | undefined = {
      topics: {
        topic1: { someConfig: "valueFromConfig" },
      },
    };
    (maybeCast as jest.Mock).mockReturnValue(config);

    const settingsTreeNodes: SettingsTreeNodes = {
      topics: {
        children: {
          topic1: {},
        },
      },
    };
    const state = {
      settingsTrees: {
        panel1: {
          nodes: settingsTreeNodes,
        },
      },
    };

    const extensionSettings = {
      myPanelType: {
        schema1: {
          settings: jest.fn(
            (_config): SettingsTreeNode => ({
              label: BasicBuilder.string(),
              children: {},
            }),
          ),
          handler: jest.fn(),
        },
      },
    };

    const messagePipelineState = jest.fn().mockReturnValue({
      sortedTopics: PlayerBuilder.topics(),
    } as Pick<MessagePipelineContext, "sortedTopics">);

    return {
      state: state as unknown as PanelStateStore,
      extensionSettings,
      messagePipelineState,
      config,
      settingsTreeNodes,
    };
  }

  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
  });

  it.each<Pick<BuildSettingsTreeProps, "panelType" | "selectedPanelId">>([
    { panelType: undefined, selectedPanelId: "value" },
    { panelType: "value", selectedPanelId: undefined },
  ])(
    "should return undefined if selectedPanelId or panelType is undefined",
    ({ panelType, selectedPanelId }) => {
      const { config, extensionSettings, state, messagePipelineState } = setup();

      const result = buildSettingsTree({
        config,
        extensionSettings,
        panelType,
        selectedPanelId,
        settingsTrees: state.settingsTrees,
        messagePipelineState,
      });
      expect(result).toBeUndefined();
    },
  );

  it("should return undefined if selected panel is not found in state", () => {
    const { config, extensionSettings, state, messagePipelineState } = setup();

    const result = buildSettingsTree({
      config,
      extensionSettings,
      panelType: "myPanelType",
      selectedPanelId: "invalidPanel",
      settingsTrees: state.settingsTrees,
      messagePipelineState,
    });

    expect(result).toBeUndefined();
  });

  it("should return the correct settingsTree when valid panelId and panelType are provided", () => {
    const { config, extensionSettings, state, messagePipelineState, settingsTreeNodes } = setup();

    const result = buildSettingsTree({
      config,
      extensionSettings,
      panelType: "myPanelType",
      selectedPanelId: "panel1",
      settingsTrees: state.settingsTrees,
      messagePipelineState,
    });

    expect(result).toEqual({
      nodes: settingsTreeNodes,
    });
  });

  it("should return the settingsTree even if topics are empty", () => {
    const { config, extensionSettings, messagePipelineState } = setup();
    const { settingsTrees }: Pick<PanelStateStore, "settingsTrees"> = {
      settingsTrees: {
        panel1: {
          nodes: {
            topics: {
              children: {},
            },
          },
          actionHandler: jest.fn(),
        },
      },
    };

    const result = buildSettingsTree({
      config,
      extensionSettings,
      panelType: "myPanelType",
      selectedPanelId: "panel1",
      settingsTrees,
      messagePipelineState,
    });

    expect(result).toEqual(settingsTrees.panel1);
  });

  it("should merge topicsSettings with existing children in the settingsTree", () => {
    const { config, extensionSettings, state, messagePipelineState, settingsTreeNodes } = setup();
    const { children: expectedChildren } = settingsTreeNodes.topics!;

    const result = buildSettingsTree({
      config,
      extensionSettings,
      messagePipelineState,
      panelType: "myPanelType",
      selectedPanelId: "panel1",
      settingsTrees: state.settingsTrees,
    });

    expect(result?.nodes.topics?.children).toEqual(expectedChildren);
  });
});

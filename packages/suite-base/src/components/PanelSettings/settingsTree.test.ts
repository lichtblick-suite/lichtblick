/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { buildSettingsTree } from "@lichtblick/suite-base/components/PanelSettings/settingsTree";
import { BuildSettingsTreeProps } from "@lichtblick/suite-base/components/PanelSettings/types";
import {
  ImmutableSettingsTree,
  PanelStateStore,
} from "@lichtblick/suite-base/context/PanelStateContext";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/util/maybeCast");

describe("buildSettingsTree", () => {
  function setup(): Pick<
    BuildSettingsTreeProps,
    "extensionSettings" | "messagePipelineState" | "config" | "settingsTree"
  > & { settingsTreeNodes: SettingsTreeNodes } {
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
    const settingsTree: ImmutableSettingsTree = {
      nodes: settingsTreeNodes,
      actionHandler: jest.fn(),
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
      settingsTree,
      extensionSettings,
      messagePipelineState,
      config,
      settingsTreeNodes,
    };
  }

  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
  });

  it.each([
    {
      panelType: undefined,
      settingsTree: { nodes: {}, actionHandler: jest.fn() } as ImmutableSettingsTree,
    },
    { panelType: "value", settingsTree: undefined },
  ])(
    "should return undefined if settingsTree or panelType is undefined",
    ({ panelType, settingsTree }) => {
      const { config, extensionSettings, messagePipelineState } = setup();

      const result = buildSettingsTree({
        config,
        extensionSettings,
        panelType,
        settingsTree,
        messagePipelineState,
      });
      expect(result).toBeUndefined();
    },
  );

  it("should return undefined if settingsTree is not found", () => {
    const { config, extensionSettings, messagePipelineState } = setup();

    const result = buildSettingsTree({
      config,
      extensionSettings,
      panelType: "myPanelType",
      settingsTree: undefined,
      messagePipelineState,
    });

    expect(result).toBeUndefined();
  });

  it("should return the correct settingsTree when valid settingsTree and panelType are provided", () => {
    const { config, extensionSettings, settingsTree, messagePipelineState } = setup();

    const result = buildSettingsTree({
      config,
      extensionSettings,
      panelType: "myPanelType",
      settingsTree,
      messagePipelineState,
    });

    expect(result).toEqual(settingsTree);
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
      settingsTree: settingsTrees.panel1,
      messagePipelineState,
    });

    expect(result).toEqual(settingsTrees.panel1);
  });

  it("should merge topicsSettings with existing children in the settingsTree", () => {
    const { config, extensionSettings, settingsTree, messagePipelineState, settingsTreeNodes } =
      setup();
    const { children: expectedChildren } = settingsTreeNodes.topics!;

    const result = buildSettingsTree({
      config,
      extensionSettings,
      messagePipelineState,
      panelType: "myPanelType",
      settingsTree,
    });

    expect(result?.nodes.topics?.children).toEqual(expectedChildren);
  });
});

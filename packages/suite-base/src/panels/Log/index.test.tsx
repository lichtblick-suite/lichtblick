/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  SettingsTreeAction,
  SettingsTreeActionUpdate,
  SettingsTreeActionUpdatePayload,
} from "@lichtblick/suite";
import LogPanelExport, { createActionHandler } from "@lichtblick/suite-base/panels/Log";
import { Config, LogLevel } from "@lichtblick/suite-base/panels/Log/types";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("Log Panel actionHandler", () => {
  describe("update action", () => {
    it.each([
      {
        description: "nameFilter path - preserves full path",
        path: ["nameFilter", "node1", "visible"],
        value: false,
        input: "boolean" as const,
        initialConfig: {
          minLogLevel: 1,
          searchTerms: [],
          nameFilter: { node1: { visible: true } },
        },
        expectedResult: {
          minLogLevel: 1,
          searchTerms: [],
          nameFilter: { node1: { visible: false } },
        },
      },
      {
        description: "non-nameFilter path - removes first element",
        path: ["general", "minLogLevel"],
        value: LogLevel.ERROR,
        input: "number" as const,
        initialConfig: {
          minLogLevel: LogLevel.INFO,
          searchTerms: [],
        },
        expectedResult: {
          minLogLevel: LogLevel.ERROR,
          searchTerms: [],
        },
      },
    ])("should handle $description", ({ path, value, input, initialConfig, expectedResult }) => {
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set<string>());

      const action: SettingsTreeActionUpdate = {
        action: "update",
        payload: { path, input, value } as SettingsTreeActionUpdatePayload,
      };
      actionHandler(action);

      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(updateFn(initialConfig)).toEqual(expectedResult);
    });

    it("should create nested properties for new node visibility entries", () => {
      const nodeName = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set<string>());

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", nodeName, "visible"],
          value: true,
          input: "boolean",
        },
      };
      actionHandler(action);

      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.DEBUG,
        searchTerms: [],
        nameFilter: {},
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[nodeName]?.visible).toBe(true);
    });
  });

  describe("perform-node-action", () => {
    it.each([
      {
        actionId: "show-all",
        expectedVisibility: true,
        description: "sets all nodes to visible",
      },
      {
        actionId: "hide-all",
        expectedVisibility: false,
        description: "sets all nodes to hidden",
      },
    ])("$actionId action $description", ({ actionId, expectedVisibility }) => {
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set(["node1", "node2", "node3"]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: actionId, path: [] },
      };
      actionHandler(action);

      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: !expectedVisibility },
          node2: { visible: expectedVisibility },
        },
      };
      const result = updateFn(initialConfig);
      expect(result.nameFilter).toEqual({
        node1: { visible: expectedVisibility },
        node2: { visible: expectedVisibility },
        node3: { visible: expectedVisibility },
      });
    });

    it("should create nameFilter from scratch when undefined", () => {
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set(["node1", "node2"]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: "show-all", path: [] },
      };
      actionHandler(action);

      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = { minLogLevel: 1, searchTerms: [] };
      const result = updateFn(initialConfig);
      expect(result.nameFilter).toEqual({
        node1: { visible: true },
        node2: { visible: true },
      });
    });

    it("should handle empty seen node set", () => {
      const node1 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set<string>());

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: "show-all", path: [] },
      };
      actionHandler(action);

      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
        nameFilter: { [node1]: { visible: false } },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[node1]?.visible).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(Object.keys(updatedConfig.nameFilter ?? {})).toHaveLength(1);
    });

    it("should preserve other config properties during show-all", () => {
      const node = BasicBuilder.string();
      const topicName = `/${BasicBuilder.string()}`;
      const searchTerm = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set([node]));

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: "show-all", path: [] },
      };
      actionHandler(action);

      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.ERROR,
        searchTerms: [searchTerm],
        topicToRender: topicName,
        nameFilter: { [node]: { visible: false } },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.minLogLevel).toBe(LogLevel.ERROR);
      expect(updatedConfig.searchTerms).toEqual([searchTerm]);
      expect(updatedConfig.topicToRender).toBe(topicName);
      expect(updatedConfig.nameFilter?.[node]?.visible).toBe(true);
    });
  });

  describe("early returns", () => {
    it.each([
      {
        description: "unknown action type",
        action: { action: "unknown-action", payload: {} } as unknown as SettingsTreeAction,
      },
      {
        description: "perform-node-action with unknown id",
        action: {
          action: "perform-node-action",
          payload: { id: "unknown-id", path: [] },
        } as SettingsTreeAction,
      },
    ])("should not call saveConfig for $description", ({ action }) => {
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set<string>());

      actionHandler(action);

      expect(saveConfigMock).not.toHaveBeenCalled();
    });
  });

  describe("complex state transitions", () => {
    it("should handle sequence of multiple updates", () => {
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const actionHandler = createActionHandler(saveConfigMock, new Set<string>());

      const actions: SettingsTreeAction[] = [
        {
          action: "update",
          payload: { path: ["nameFilter", node1, "visible"], value: true, input: "boolean" },
        },
        {
          action: "update",
          payload: { path: ["nameFilter", node2, "visible"], value: false, input: "boolean" },
        },
        {
          action: "update",
          payload: { path: ["general", "minLogLevel"], value: LogLevel.WARN, input: "number" },
        },
      ];
      actions.forEach((action) => {
        actionHandler(action);
      });

      expect(saveConfigMock).toHaveBeenCalledTimes(3);
    });

    it("should handle toggle between show-all and hide-all", () => {
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([BasicBuilder.string(), BasicBuilder.string()]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const showAllAction: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: "show-all", path: [] },
      };
      const hideAllAction: SettingsTreeAction = {
        action: "perform-node-action",
        payload: { id: "hide-all", path: [] },
      };

      actionHandler(showAllAction);
      actionHandler(hideAllAction);

      expect(saveConfigMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Log Panel Export Configuration", () => {
  it("should export panel with correct configuration", () => {
    const panel = LogPanelExport;

    expect(panel.panelType).toBe("RosOut");
    expect(panel.defaultConfig).toEqual({
      searchTerms: [],
      minLogLevel: LogLevel.DEBUG,
    });
  });
});

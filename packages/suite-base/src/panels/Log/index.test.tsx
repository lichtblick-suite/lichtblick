/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeAction } from "@lichtblick/suite";
import LogPanelExport, { createActionHandler } from "@lichtblick/suite-base/panels/Log";
import { Config, LogLevel } from "@lichtblick/suite-base/panels/Log/types";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("Log Panel actionHandler", () => {
  describe("update action with nameFilter path", () => {
    it("should update config without adjusting path when path starts with nameFilter", () => {
      // Given: An initial config with nameFilter and a mock saveConfig
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with an update action for nameFilter path
      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", "node1", "visible"],
          value: false,
          input: "boolean",
        },
      };
      actionHandler(action);

      // Then: saveConfig is called with the updated config using the original path
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(typeof updateFn).toBe("function");

      // Verify the update function works correctly
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: true },
        },
      };
      const result = updateFn(initialConfig);
      expect(result).toEqual({
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: false },
        },
      });
    });

    it("should update config with adjusted path when path does not start with nameFilter", () => {
      // Given: An initial config and a mock saveConfig
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with an update action for non-nameFilter path
      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["general", "minLogLevel"],
          value: 3,
          input: "number",
        },
      };
      actionHandler(action);

      // Then: saveConfig is called with the updated config using adjusted path (first element removed)
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(typeof updateFn).toBe("function");

      // Verify the update function works correctly
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
      };
      const result = updateFn(initialConfig);
      expect(result).toEqual({
        minLogLevel: 3,
        searchTerms: [],
      });
    });
  });

  describe("perform-node-action: show-all", () => {
    it("should set all nodes to visible when show-all action is performed", () => {
      // Given: A config with mixed visibility and seen nodes
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set(["node1", "node2", "node3"]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with show-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };
      actionHandler(action);

      // Then: saveConfig is called with all nodes visible
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(typeof updateFn).toBe("function");

      // Verify the update function works correctly
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: false },
          node2: { visible: true },
        },
      };
      const result = updateFn(initialConfig);
      expect(result.nameFilter).toEqual({
        node1: { visible: true },
        node2: { visible: true },
        node3: { visible: true },
      });
    });

    it("should create nameFilter with all seen nodes visible when nameFilter is undefined", () => {
      // Given: A config without nameFilter
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set(["node1", "node2"]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with show-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };
      actionHandler(action);

      // Then: saveConfig is called with new nameFilter
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(typeof updateFn).toBe("function");

      // Verify the update function works correctly
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
      };
      const result = updateFn(initialConfig);
      expect(result.nameFilter).toEqual({
        node1: { visible: true },
        node2: { visible: true },
      });
    });
  });

  describe("perform-node-action: hide-all", () => {
    it("should set all nodes to hidden when hide-all action is performed", () => {
      // Given: A config with all visible nodes
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set(["node1", "node2"]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with hide-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };
      actionHandler(action);

      // Then: saveConfig is called with all nodes hidden
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      expect(typeof updateFn).toBe("function");

      // Verify the update function works correctly
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: true },
          node2: { visible: true },
        },
      };
      const result = updateFn(initialConfig);
      expect(result.nameFilter).toEqual({
        node1: { visible: false },
        node2: { visible: false },
      });
    });
  });

  describe("actionHandler early returns", () => {
    it("should return early without updating config for non-update and non-perform-node-action", () => {
      // Given: An unknown action type
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with unknown action
      const action = {
        action: "unknown-action",
        payload: {},
      } as unknown as SettingsTreeAction;
      actionHandler(action);

      // Then: saveConfig should not be called
      expect(saveConfigMock).not.toHaveBeenCalled();
    });

    it("should return early without updating config for perform-node-action with unknown id", () => {
      // Given: A perform-node-action with unknown id
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: actionHandler is called with unknown node action id
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "unknown-id",
          path: [],
        },
      };
      actionHandler(action);

      // Then: saveConfig should not be called
      expect(saveConfigMock).not.toHaveBeenCalled();
    });
  });
});

describe("Log Panel Export Configuration", () => {
  describe("given-when-then: panel registration", () => {
    it("should export panel with correct panelType for backwards compatibility", () => {
      // Given / When: Panel export
      const panel = LogPanelExport;

      // Then: Should use legacy RosOut name for backwards compatibility
      expect(panel.panelType).toBe("RosOut");
    });

    it("should export panel with default config", () => {
      // Given / When: Panel export
      const panel = LogPanelExport;

      // Then: Should have correct default configuration
      expect(panel.defaultConfig).toEqual({
        searchTerms: [],
        minLogLevel: 1,
      });
    });

    it("should export panel with DEBUG log level as default", () => {
      // Given / When: Panel default config
      const defaultConfig = LogPanelExport.defaultConfig;

      // Then: Should default to DEBUG level (1)
      expect(defaultConfig.minLogLevel).toBe(LogLevel.DEBUG);
    });

    it("should export panel with empty search terms as default", () => {
      // Given / When: Panel default config
      const defaultConfig = LogPanelExport.defaultConfig;

      // Then: Should have empty search terms array
      expect(defaultConfig.searchTerms).toEqual([]);
    });
  });
});

describe("Log Panel actionHandler Logic", () => {
  describe("given-when-then: update action with various path configurations", () => {
    it("should preserve nameFilter path when updating node visibility", () => {
      // Given: Config with nameFilter and actionHandler
      const nodeName = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", nodeName, "visible"],
          value: false,
          input: "boolean",
        },
      };

      // When: Calling actionHandler with nameFilter update
      actionHandler(action);

      // Then: Path should remain unchanged for nameFilter
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
        nameFilter: {
          [nodeName]: { visible: true },
        },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[nodeName]?.visible).toBe(false);
    });

    it("should adjust path by removing first element for non-nameFilter updates", () => {
      // Given: Config and actionHandler
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["general", "minLogLevel"],
          value: LogLevel.ERROR,
          input: "number",
        },
      };

      // When: Calling actionHandler with non-nameFilter update
      actionHandler(action);

      // Then: First element should be removed and value updated
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.minLogLevel).toBe(LogLevel.ERROR);
    });

    it("should update nested properties correctly", () => {
      // Given: Config and actionHandler
      const nodeName = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", nodeName, "visible"],
          value: true,
          input: "boolean",
        },
      };

      // When: Creating new node visibility entry
      actionHandler(action);

      // Then: New nested property should be created
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
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

  describe("given-when-then: show-all and hide-all actions with node sets", () => {
    it("should make all existing and seen nodes visible with show-all", () => {
      // Given: Config with mixed visibility and a set of seen nodes
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const node3 = BasicBuilder.string();
      const seenNode = BasicBuilder.string();

      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node1, node2, node3, seenNode]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      // When: Processing show-all action
      actionHandler(action);

      // Then: All nodes should be visible including the new seen node
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
        nameFilter: {
          [node1]: { visible: false },
          [node2]: { visible: true },
          [node3]: { visible: false },
        },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[node1]?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.[node2]?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.[node3]?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.[seenNode]?.visible).toBe(true);
    });

    it("should make all existing and seen nodes hidden with hide-all", () => {
      // Given: Config with all visible nodes
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const newNode = BasicBuilder.string();

      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node1, node2, newNode]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };

      // When: Processing hide-all action
      actionHandler(action);

      // Then: All nodes should be hidden
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
        nameFilter: {
          [node1]: { visible: true },
          [node2]: { visible: true },
        },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[node1]?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.[node2]?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.[newNode]?.visible).toBe(false);
    });

    it("should create nameFilter from scratch when undefined", () => {
      // Given: Config without nameFilter
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node1, node2]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      // When: Processing show-all on undefined nameFilter
      actionHandler(action);

      // Then: nameFilter should be created with all seen nodes visible
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.WARN,
        searchTerms: [],
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter).toBeDefined();
      expect(updatedConfig.nameFilter?.[node1]?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.[node2]?.visible).toBe(true);
    });

    it("should handle empty seen node set", () => {
      // Given: Config with existing nameFilter but no new nodes
      const node1 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      // When: Processing show-all with no additional seen nodes
      actionHandler(action);

      // Then: Only existing nodes should be updated
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.INFO,
        searchTerms: [],
        nameFilter: {
          [node1]: { visible: false },
        },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.nameFilter?.[node1]?.visible).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(Object.keys(updatedConfig.nameFilter ?? {})).toHaveLength(1);
    });

    it("should preserve other config properties during show-all", () => {
      // Given: Config with various properties
      const node = BasicBuilder.string();
      const topicName = `/${BasicBuilder.string()}`;
      const searchTerm = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      // When: Processing show-all
      actionHandler(action);

      // Then: Other properties should remain unchanged
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
      const updateFn = saveConfigMock.mock.calls[0]?.[0];
      const initialConfig: Config = {
        minLogLevel: LogLevel.ERROR,
        searchTerms: [searchTerm],
        topicToRender: topicName,
        nameFilter: {
          [node]: { visible: false },
        },
      };
      const updatedConfig = updateFn(initialConfig);
      expect(updatedConfig.minLogLevel).toBe(LogLevel.ERROR);
      expect(updatedConfig.searchTerms).toEqual([searchTerm]);
      expect(updatedConfig.topicToRender).toBe(topicName);
      expect(updatedConfig.nameFilter?.[node]?.visible).toBe(true);
    });
  });

  describe("given-when-then: action validation and early returns", () => {
    it("should return early for unknown action types", () => {
      // Given: An unknown action type
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action = {
        action: BasicBuilder.string(),
        payload: {},
      } as unknown as SettingsTreeAction;

      // When: Processing unknown action
      actionHandler(action);

      // Then: Should not call saveConfig
      expect(saveConfigMock).not.toHaveBeenCalled();
    });

    it("should return early for perform-node-action with unknown id", () => {
      // Given: perform-node-action with unknown id
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: BasicBuilder.string(),
          path: [],
        },
      };

      // When: Processing action with unknown id
      actionHandler(action);

      // Then: Should not call saveConfig
      expect(saveConfigMock).not.toHaveBeenCalled();
    });

    it("should process update action", () => {
      // Given: A valid update action
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["minLogLevel"],
          value: LogLevel.WARN,
          input: "number",
        },
      };

      // When: Processing update action
      actionHandler(action);

      // Then: Should call saveConfig
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
    });

    it("should process show-all perform-node-action", () => {
      // Given: A valid show-all action
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      // When: Processing show-all action
      actionHandler(action);

      // Then: Should call saveConfig
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
    });

    it("should process hide-all perform-node-action", () => {
      // Given: A valid hide-all action
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };

      // When: Processing hide-all action
      actionHandler(action);

      // Then: Should call saveConfig
      expect(saveConfigMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("given-when-then: complex state transitions", () => {
    it("should handle sequence of multiple updates", () => {
      // Given: Initial config and actionHandler
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set<string>();
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: Applying multiple updates in sequence
      const action1: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", node1, "visible"],
          value: true,
          input: "boolean",
        },
      };
      actionHandler(action1);

      const action2: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", node2, "visible"],
          value: false,
          input: "boolean",
        },
      };
      actionHandler(action2);

      const action3: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["general", "minLogLevel"],
          value: LogLevel.WARN,
          input: "number",
        },
      };
      actionHandler(action3);

      // Then: All updates should be applied
      expect(saveConfigMock).toHaveBeenCalledTimes(3);
    });

    it("should handle show-all followed by individual node hide", () => {
      // Given: Config with some hidden nodes
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const node3 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node1, node2, node3]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: First apply show-all
      const showAllAction: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };
      actionHandler(showAllAction);

      // Then hide one specific node
      const hideNodeAction: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["nameFilter", node2, "visible"],
          value: false,
          input: "boolean",
        },
      };
      actionHandler(hideNodeAction);

      // Then: Both actions should be processed
      expect(saveConfigMock).toHaveBeenCalledTimes(2);
    });

    it("should handle toggle between show-all and hide-all", () => {
      // Given: Config with mixed visibility
      const node1 = BasicBuilder.string();
      const node2 = BasicBuilder.string();
      const saveConfigMock = jest.fn();
      const seenNodeNames = new Set([node1, node2]);
      const actionHandler = createActionHandler(saveConfigMock, seenNodeNames);

      // When: Apply show-all
      const showAllAction: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };
      actionHandler(showAllAction);

      // Then apply hide-all
      const hideAllAction: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };
      actionHandler(hideAllAction);

      // Then: Both actions should be processed
      expect(saveConfigMock).toHaveBeenCalledTimes(2);
    });
  });
});

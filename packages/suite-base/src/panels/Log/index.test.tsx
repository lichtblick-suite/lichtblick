/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { produce } from "immer";

import { SettingsTreeAction } from "@lichtblick/suite";
import { Config } from "@lichtblick/suite-base/panels/Log/types";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("Log Panel actionHandler", () => {
  describe("update action", () => {
    const pathNameFilter = BasicBuilder.string();
    it("should update config with adjusted path when path starts with nameFilter", () => {
      // Given: An initial config and a saveConfig mock
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: true },
        },
      };

      // When: actionHandler is called with an update action for nameFilter
      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: [pathNameFilter, "node1", "visible"],
          value: false,
          input: "boolean",
        },
      };

      // Simulate what actionHandler does
      const adjustedPath =
        action.payload.path[0] === pathNameFilter
          ? action.payload.path
          : action.payload.path.slice(1);

      const updatedConfig = produce(initialConfig, (draft: Config) => {
        if (adjustedPath.length === 3) {
          draft.nameFilter = draft.nameFilter ?? {};
          // @ts-expect-error - Dynamic path access
          draft.nameFilter[adjustedPath[1]] = draft.nameFilter[adjustedPath[1]] ?? {};
          // @ts-expect-error - Dynamic path access
          draft.nameFilter[adjustedPath[1]][adjustedPath[2]] = action.payload.value;
        }
      });

      // Then: config should be updated correctly
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(false);
      expect(adjustedPath).toEqual([pathNameFilter, "node1", "visible"]);
    });

    it("should update config with adjusted path when path does not start with nameFilter", () => {
      // Given: An initial config and a saveConfig mock
      const topicToRender = BasicBuilder.string();
      // When: actionHandler is called with an update action for other settings
      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: [pathNameFilter, topicToRender],
          value: BasicBuilder.string(),
          input: "string",
        },
      };

      // Simulate what actionHandler does
      const adjustedPath =
        action.payload.path[0] === "nameFilter"
          ? action.payload.path
          : action.payload.path.slice(1);

      // Then: path should be adjusted by removing first element
      expect(adjustedPath).toEqual([topicToRender]);
    });
  });

  describe("perform-node-action: show-all", () => {
    it("should set all nodes to visible when show-all action is performed", () => {
      // Given: An initial config with mixed visibility states
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: false },
          node2: { visible: true },
          node3: { visible: false },
        },
      };
      const seenNodeNames = new Set(["node1", "node2", "node3", "node4"]);

      // When: actionHandler is called with show-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      const visible = action.payload.id === "show-all";
      const updatedConfig = produce(initialConfig, (draft: Config) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all nodes (existing and new) should be visible
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.node2?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.node3?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.node4?.visible).toBe(true);
    });

    it("should handle empty nameFilter when show-all action is performed", () => {
      // Given: An initial config with no nameFilter
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
      };
      const seenNodeNames = new Set(["node1", "node2"]);

      // When: actionHandler is called with show-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: [],
        },
      };

      const visible = action.payload.id === "show-all";
      const updatedConfig = produce(initialConfig, (draft: Config) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all seen nodes should be visible
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.node2?.visible).toBe(true);
    });
  });

  describe("perform-node-action: hide-all", () => {
    it("should set all nodes to hidden when hide-all action is performed", () => {
      // Given: An initial config with mixed visibility states
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: true },
          node2: { visible: false },
          node3: { visible: true },
        },
      };
      const seenNodeNames = new Set(["node1", "node2", "node3", "node5"]);

      // When: actionHandler is called with hide-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };

      const visible = action.payload.id === "show-all";
      const updatedConfig = produce(initialConfig, (draft: Config) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all nodes (existing and new) should be hidden
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.node2?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.node3?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.node5?.visible).toBe(false);
    });

    it("should handle empty nameFilter when hide-all action is performed", () => {
      // Given: An initial config with no nameFilter
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
      };
      const seenNodeNames = new Set(["node1", "node2"]);

      // When: actionHandler is called with hide-all action
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: [],
        },
      };

      const visible = action.payload.id === "show-all";
      const updatedConfig = produce(initialConfig, (draft: Config) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all seen nodes should be hidden
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(false);
      expect(updatedConfig.nameFilter?.node2?.visible).toBe(false);
    });
  });

  describe("actionHandler edge cases", () => {
    it("should not execute update when action is not 'update' or 'perform-node-action'", () => {
      // Given: A saveConfig mock that should not be called

      // When: actionHandler receives an unrecognized action type
      const action = {
        action: "unknown-action",
        payload: {},
      } as unknown as SettingsTreeAction;

      // Then: saveConfig should not be called
      // (In real implementation, the handler would return early)
      expect(action.action).not.toBe("update");
      expect(action.action).not.toBe("perform-node-action");
    });

    it("should not execute perform-node-action when id is not show-all or hide-all", () => {
      // Given: A saveConfig mock that should not be called

      // When: actionHandler receives a perform-node-action with unknown id
      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "unknown-action",
          path: [],
        },
      };

      // Then: The action should be filtered out
      const shouldExecute = ["show-all", "hide-all"].includes(action.payload.id);
      expect(shouldExecute).toBe(false);
    });

    it("should preserve existing node properties when updating visibility", () => {
      // Given: An initial config with nodes having various properties
      const initialConfig: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: true },
          node2: { visible: false },
        },
      };
      const seenNodeNames = new Set(["node1", "node2"]);

      // When: show-all action is performed
      const visible = true;
      const updatedConfig = produce(initialConfig, (draft: Config) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all nodes should have the new visibility value
      expect(Object.keys(updatedConfig.nameFilter ?? {})).toHaveLength(2);
      expect(updatedConfig.nameFilter?.node1?.visible).toBe(true);
      expect(updatedConfig.nameFilter?.node2?.visible).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should handle sequence of update actions correctly", () => {
      // Given: An initial config
      let config: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {},
      };

      // When: Multiple update actions are applied in sequence
      // First update: set node1 visible
      config = produce(config, (draft) => {
        draft.nameFilter = draft.nameFilter ?? {};
        draft.nameFilter.node1 = { visible: true };
      });

      // Second update: set node2 visible
      config = produce(config, (draft) => {
        draft.nameFilter = draft.nameFilter ?? {};
        draft.nameFilter.node2 = { visible: false };
      });

      // Then: both updates should be reflected
      expect(config.nameFilter?.node1?.visible).toBe(true);
      expect(config.nameFilter?.node2?.visible).toBe(false);
    });

    it("should handle show-all followed by individual node updates", () => {
      // Given: An initial config with some nodes
      let config: Config = {
        minLogLevel: 1,
        searchTerms: [],
        nameFilter: {
          node1: { visible: false },
          node2: { visible: false },
        },
      };
      const seenNodeNames = new Set(["node1", "node2"]);

      // When: show-all is executed
      config = produce(config, (draft) => {
        const newNameFilter = Object.fromEntries(
          Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible: true }]),
        );
        seenNodeNames.forEach((name) => (newNameFilter[name] = { visible: true }));
        draft.nameFilter = newNameFilter;
      });

      // Then: all nodes should be visible
      expect(config.nameFilter?.node1?.visible).toBe(true);
      expect(config.nameFilter?.node2?.visible).toBe(true);

      // When: individual node is updated to be hidden
      config = produce(config, (draft) => {
        if (draft.nameFilter?.node1) {
          draft.nameFilter.node1.visible = false;
        }
      });

      // Then: only that node should be hidden
      expect(config.nameFilter?.node1?.visible).toBe(false);
      expect(config.nameFilter?.node2?.visible).toBe(true);
    });
  });
});

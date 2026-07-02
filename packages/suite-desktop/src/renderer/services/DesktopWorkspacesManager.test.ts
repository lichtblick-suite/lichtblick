// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Namespace } from "@lichtblick/suite-base/src/types";

import { DesktopWorkspacesManager } from "./DesktopWorkspacesManager";
import { Desktop, DesktopWorkspace } from "../../common/types";

function makeDesktopWorkspace(overrides: Partial<DesktopWorkspace> = {}): DesktopWorkspace {
  return {
    id: "id-1",
    name: "Workspace One",
    namespace: "local",
    path: "/home/user/.lichtblick-suite/workspaces/id-1",
    ...overrides,
  };
}

describe("DesktopWorkspacesManager", () => {
  let bridge: jest.Mocked<Desktop>;
  let manager: DesktopWorkspacesManager;

  beforeEach(() => {
    bridge = {
      listWorkspaces: jest.fn(),
      createWorkspace: jest.fn(),
      renameWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
      getCurrentWorkspace: jest.fn(),
      setCurrentWorkspace: jest.fn(),
    } as unknown as jest.Mocked<Desktop>;

    manager = new DesktopWorkspacesManager(bridge);
  });

  describe("list", () => {
    it("should map bridge workspaces to shared workspaces, dropping the on-disk path", async () => {
      // GIVEN the bridge returns desktop workspaces with a path
      const desktopWorkspaces: DesktopWorkspace[] = [
        makeDesktopWorkspace({ id: "a", name: "Alpha", namespace: "local" }),
        makeDesktopWorkspace({ id: "b", name: "Bravo", namespace: "org" }),
      ];
      bridge.listWorkspaces.mockResolvedValue(desktopWorkspaces);

      // WHEN listing workspaces
      const result = await manager.list();

      // THEN each item is mapped without the path field
      expect(bridge.listWorkspaces).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { id: "a", name: "Alpha", namespace: "local" },
        { id: "b", name: "Bravo", namespace: "org" },
      ]);
      expect(result[0]).not.toHaveProperty("path");
    });

    it("should return an empty array when the bridge has no workspaces", async () => {
      // GIVEN the bridge returns no workspaces
      bridge.listWorkspaces.mockResolvedValue([]);

      // WHEN listing workspaces THEN an empty array is returned
      await expect(manager.list()).resolves.toEqual([]);
    });
  });

  describe("create", () => {
    it("should forward the name and namespace and map the result", async () => {
      // GIVEN the bridge creates a workspace
      const created = makeDesktopWorkspace({ id: "new", name: "Created", namespace: "org" });
      bridge.createWorkspace.mockResolvedValue(created);

      // WHEN creating a workspace
      const result = await manager.create("Created", "org");

      // THEN the bridge is called with the same args and the result is mapped
      expect(bridge.createWorkspace).toHaveBeenCalledWith("Created", "org");
      expect(result).toEqual({ id: "new", name: "Created", namespace: "org" });
    });
  });

  describe("rename", () => {
    it("should forward the id and name and map the result", async () => {
      // GIVEN the bridge renames a workspace
      const renamed = makeDesktopWorkspace({ id: "id-1", name: "Renamed", namespace: "local" });
      bridge.renameWorkspace.mockResolvedValue(renamed);

      // WHEN renaming a workspace
      const result = await manager.rename("id-1", "Renamed");

      // THEN the bridge is called with the same args and the result is mapped
      expect(bridge.renameWorkspace).toHaveBeenCalledWith("id-1", "Renamed");
      expect(result).toEqual({ id: "id-1", name: "Renamed", namespace: "local" });
    });
  });

  describe("delete", () => {
    it("should delegate deletion to the bridge", async () => {
      // GIVEN the bridge resolves on delete
      bridge.deleteWorkspace.mockResolvedValue();

      // WHEN deleting a workspace
      await manager.delete("id-1");

      // THEN the bridge deleteWorkspace is called with the id
      expect(bridge.deleteWorkspace).toHaveBeenCalledWith("id-1");
    });
  });

  describe("getCurrent", () => {
    it("should map the current workspace when the bridge returns one", async () => {
      // GIVEN the bridge has a current workspace
      const current = makeDesktopWorkspace({ id: "cur", name: "Current", namespace: "org" });
      bridge.getCurrentWorkspace.mockResolvedValue(current);

      // WHEN reading the current workspace
      const result = await manager.getCurrent();

      // THEN it is mapped to the shared type
      expect(result).toEqual({ id: "cur", name: "Current", namespace: "org" });
    });

    it("should return undefined when the bridge has no current workspace", async () => {
      // GIVEN the bridge returns undefined
      bridge.getCurrentWorkspace.mockResolvedValue(undefined);

      // WHEN reading the current workspace THEN it is undefined
      await expect(manager.getCurrent()).resolves.toBeUndefined();
    });
  });

  describe("setCurrent", () => {
    it.each<string | undefined>(["id-1", undefined])(
      "should forward the selection %p to the bridge",
      async (id) => {
        // GIVEN the bridge resolves on set
        bridge.setCurrentWorkspace.mockResolvedValue();

        // WHEN selecting a workspace (including clearing with undefined)
        await manager.setCurrent(id);

        // THEN the bridge is called with the same id
        expect(bridge.setCurrentWorkspace).toHaveBeenCalledWith(id);
      },
    );

    it("should accept both namespaces round-tripped through create", async () => {
      // GIVEN two namespaces
      const namespaces: Namespace[] = ["local", "org"];

      for (const namespace of namespaces) {
        bridge.createWorkspace.mockResolvedValue(makeDesktopWorkspace({ namespace }));

        // WHEN creating a workspace with the namespace
        const result = await manager.create("Name", namespace);

        // THEN the namespace round-trips
        expect(result.namespace).toBe(namespace);
      }
    });
  });
});

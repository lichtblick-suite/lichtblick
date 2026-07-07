// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join as pathJoin } from "path";

import { WorkspacesManager } from "./WorkspacesManager";
import { WorkspaceNamespace } from "../../common/types";
import {
  WorkspaceConfig,
  WORKSPACES_STATE_FILE,
  WORKSPACE_CONFIG_FILE,
  WORKSPACE_EXTENSIONS_FOLDER,
  WORKSPACE_LAYOUTS_FOLDER,
} from "../../common/workspaces";

jest.mock("@lichtblick/log", () => ({
  getLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe("WorkspacesManager", () => {
  let workspacesRoot: string;
  let manager: WorkspacesManager;

  beforeEach(async () => {
    workspacesRoot = await mkdtemp(pathJoin(tmpdir(), "lichtblick-workspaces-"));
    manager = new WorkspacesManager(workspacesRoot);
  });

  afterEach(async () => {
    await rm(workspacesRoot, { recursive: true, force: true });
  });

  async function readState(): Promise<{ currentWorkspaceId?: string }> {
    const raw = await readFile(pathJoin(workspacesRoot, WORKSPACES_STATE_FILE), {
      encoding: "utf-8",
    });
    return JSON.parse(raw) as { currentWorkspaceId?: string };
  }

  describe("create", () => {
    it.each<WorkspaceNamespace>(["local", "org"])(
      "should persist a config that round-trips through getConfig for the %s namespace",
      async (namespace) => {
        // GIVEN a fresh workspaces root
        // WHEN creating a workspace
        const workspace = await manager.create("My Workspace", namespace);

        // THEN the returned workspace exposes the expected fields and disk path
        expect(workspace.id).toEqual(expect.any(String));
        expect(workspace.name).toBe("My Workspace");
        expect(workspace.namespace).toBe(namespace);
        expect(workspace.path).toBe(pathJoin(workspacesRoot, workspace.id));

        // THEN the persisted config round-trips including the namespace
        const config = await manager.getConfig(workspace.id);
        expect(config).toEqual({
          id: workspace.id,
          name: "My Workspace",
          namespace,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      },
    );

    it("should scaffold the extensions and layouts sub-folders", async () => {
      // GIVEN a fresh workspaces root
      // WHEN creating a workspace
      const workspace = await manager.create("Scaffolded", "local");

      // THEN both per-workspace sub-folders exist on disk
      expect(existsSync(pathJoin(workspace.path, WORKSPACE_EXTENSIONS_FOLDER))).toBe(true);
      expect(existsSync(pathJoin(workspace.path, WORKSPACE_LAYOUTS_FOLDER))).toBe(true);
      expect(existsSync(pathJoin(workspace.path, WORKSPACE_CONFIG_FILE))).toBe(true);
    });

    it("should trim the workspace name before persisting", async () => {
      // GIVEN a padded name
      // WHEN creating the workspace
      const workspace = await manager.create("  Padded Name  ", "local");

      // THEN the stored name is trimmed
      expect(workspace.name).toBe("Padded Name");
    });

    it.each(["", "   "])(
      "should throw when creating a workspace with an empty name (%p)",
      async (name) => {
        // GIVEN an empty/whitespace name
        // WHEN creating a workspace THEN it throws
        await expect(manager.create(name, "local")).rejects.toThrow(
          "Workspace name cannot be empty",
        );
      },
    );

    it("should assign a unique id to each created workspace", async () => {
      // GIVEN two created workspaces
      const first = await manager.create("First", "local");
      const second = await manager.create("Second", "local");

      // THEN their ids differ
      expect(first.id).not.toBe(second.id);
    });
  });

  describe("list", () => {
    it("should return an empty array when the root does not exist", async () => {
      // GIVEN a manager pointed at a non-existent root
      const missingRoot = pathJoin(workspacesRoot, "does-not-exist");
      const missingManager = new WorkspacesManager(missingRoot);

      // WHEN listing workspaces THEN an empty array is returned
      await expect(missingManager.list()).resolves.toEqual([]);
    });

    it("should return workspaces sorted by name", async () => {
      // GIVEN three workspaces created out of alphabetical order
      await manager.create("Charlie", "local");
      await manager.create("alpha", "org");
      await manager.create("Bravo", "local");

      // WHEN listing workspaces
      const workspaces = await manager.list();

      // THEN they are sorted using localeCompare
      expect(workspaces.map((w) => w.name)).toEqual(["alpha", "Bravo", "Charlie"]);
    });

    it("should skip directories without a valid config", async () => {
      // GIVEN one valid workspace and one bogus directory (no config + invalid json)
      const valid = await manager.create("Valid", "local");
      await mkdir(pathJoin(workspacesRoot, "no-config-dir"), { recursive: true });
      const invalidDir = pathJoin(workspacesRoot, "invalid-config-dir");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(pathJoin(invalidDir, WORKSPACE_CONFIG_FILE), "not-json", {
        encoding: "utf-8",
      });

      // WHEN listing workspaces
      const workspaces = await manager.list();

      // THEN only the valid workspace is returned
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]?.id).toBe(valid.id);
    });

    it("should ignore non-directory entries in the root", async () => {
      // GIVEN a valid workspace and a stray file at the root
      const valid = await manager.create("Valid", "local");
      await writeFile(pathJoin(workspacesRoot, "stray.txt"), "hello", { encoding: "utf-8" });

      // WHEN listing workspaces
      const workspaces = await manager.list();

      // THEN only the workspace directory is returned
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]?.id).toBe(valid.id);
    });
  });

  describe("rename", () => {
    it("should update the name and updatedAt while preserving createdAt", async () => {
      // GIVEN an existing workspace
      const workspace = await manager.create("Original", "org");
      const before = await manager.getConfig(workspace.id);

      // WHEN renaming it (after a tick so timestamps can differ)
      await new Promise((resolve) => setTimeout(resolve, 5));
      const renamed = await manager.rename(workspace.id, "  Renamed  ");

      // THEN the returned workspace uses the trimmed new name
      expect(renamed.name).toBe("Renamed");
      expect(renamed.namespace).toBe("org");

      // THEN createdAt is preserved and updatedAt advances
      const after = await manager.getConfig(workspace.id);
      expect(after?.name).toBe("Renamed");
      expect(after?.createdAt).toBe(before?.createdAt);
      expect(after?.updatedAt).not.toBe(before?.updatedAt);
    });

    it("should throw when renaming a missing workspace", async () => {
      // GIVEN a missing workspace id
      const missingId = "missing-workspace-id";

      // WHEN renaming THEN it throws a not-found error
      await expect(manager.rename(missingId, "New Name")).rejects.toThrow(
        `Workspace ${missingId} not found`,
      );
    });

    it.each(["", "   "])("should throw when renaming to an empty name (%p)", async (name) => {
      // GIVEN an existing workspace
      const workspace = await manager.create("Original", "local");

      // WHEN renaming to an empty name THEN it throws
      await expect(manager.rename(workspace.id, name)).rejects.toThrow(
        "Workspace name cannot be empty",
      );
    });

    it.each(["../evil", "foo/bar"])(
      "should reject a path-traversal id (%p)",
      async (traversalId) => {
        // GIVEN a malicious id that escapes the workspaces root
        // WHEN renaming THEN it is rejected before touching disk
        await expect(manager.rename(traversalId, "New Name")).rejects.toThrow(
          `Invalid workspace id: ${traversalId}`,
        );
      },
    );
  });

  describe("delete", () => {
    it("should remove the workspace directory from disk", async () => {
      // GIVEN an existing workspace
      const workspace = await manager.create("To Delete", "local");
      expect(existsSync(workspace.path)).toBe(true);

      // WHEN deleting it
      await manager.delete(workspace.id);

      // THEN the directory is gone
      expect(existsSync(workspace.path)).toBe(false);
    });

    it("should clear currentWorkspaceId when deleting the current workspace", async () => {
      // GIVEN a workspace selected as current
      const workspace = await manager.create("Current", "local");
      await manager.setCurrent(workspace.id);

      // WHEN deleting the current workspace
      await manager.delete(workspace.id);

      // THEN the persisted current workspace id is cleared
      const state = await readState();
      expect(state.currentWorkspaceId).toBeUndefined();
      await expect(manager.getCurrent()).resolves.toBeUndefined();
    });

    it("should not clear currentWorkspaceId when deleting a different workspace", async () => {
      // GIVEN a current workspace and another workspace
      const current = await manager.create("Current", "local");
      const other = await manager.create("Other", "local");
      await manager.setCurrent(current.id);

      // WHEN deleting the other (non-current) workspace
      await manager.delete(other.id);

      // THEN the current workspace selection is untouched
      const state = await readState();
      expect(state.currentWorkspaceId).toBe(current.id);
    });

    it.each(["../evil", "foo/bar"])(
      "should reject a path-traversal id without touching disk (%p)",
      async (traversalId) => {
        // GIVEN a sibling file outside the workspaces root that must not be removed
        const outsideFile = pathJoin(workspacesRoot, "..", "outside-target.txt");
        await writeFile(outsideFile, "keep me", { encoding: "utf-8" });

        try {
          // WHEN deleting with a malicious id THEN it is rejected before any rm
          await expect(manager.delete(traversalId)).rejects.toThrow(
            `Invalid workspace id: ${traversalId}`,
          );

          // THEN nothing outside the root was removed
          expect(existsSync(outsideFile)).toBe(true);
        } finally {
          await rm(outsideFile, { force: true });
        }
      },
    );
  });

  describe("getCurrent", () => {
    it("should return undefined when no current workspace is set", async () => {
      // GIVEN no selection persisted
      // WHEN reading the current workspace THEN it is undefined
      await expect(manager.getCurrent()).resolves.toBeUndefined();
    });

    it("should return the selected workspace when set", async () => {
      // GIVEN a selected workspace
      const workspace = await manager.create("Selected", "org");
      await manager.setCurrent(workspace.id);

      // WHEN reading the current workspace
      const current = await manager.getCurrent();

      // THEN the selected workspace is returned
      expect(current).toEqual(workspace);
    });

    it("should return undefined when the persisted current workspace no longer exists", async () => {
      // GIVEN a persisted current id whose config was deleted out of band
      const workspace = await manager.create("Dangling", "local");
      await manager.setCurrent(workspace.id);
      await rm(workspace.path, { recursive: true, force: true });

      // WHEN reading the current workspace
      // THEN it falls back to undefined (legacy folders)
      await expect(manager.getCurrent()).resolves.toBeUndefined();
    });
  });

  describe("setCurrent", () => {
    it("should persist the current workspace id when it exists", async () => {
      // GIVEN an existing workspace
      const workspace = await manager.create("Pick Me", "local");

      // WHEN selecting it as current
      await manager.setCurrent(workspace.id);

      // THEN the id is persisted to state.json
      const state = await readState();
      expect(state.currentWorkspaceId).toBe(workspace.id);
    });

    it("should clear the current workspace when passed undefined", async () => {
      // GIVEN a current workspace
      const workspace = await manager.create("Pick Me", "local");
      await manager.setCurrent(workspace.id);

      // WHEN clearing the selection
      await manager.setCurrent(undefined);

      // THEN the persisted id is cleared
      const state = await readState();
      expect(state.currentWorkspaceId).toBeUndefined();
    });

    it("should throw when selecting a missing workspace", async () => {
      // GIVEN a missing workspace id
      const missingId = "missing-workspace-id";

      // WHEN selecting it THEN it throws a not-found error
      await expect(manager.setCurrent(missingId)).rejects.toThrow(
        `Workspace ${missingId} not found`,
      );
    });

    it.each(["../evil", "foo/bar"])(
      "should reject a path-traversal id (%p)",
      async (traversalId) => {
        // GIVEN a malicious id that escapes the workspaces root
        // WHEN selecting it THEN it is rejected before any filesystem read
        await expect(manager.setCurrent(traversalId)).rejects.toThrow(
          `Invalid workspace id: ${traversalId}`,
        );
      },
    );
  });

  describe("getConfig", () => {
    it("should return undefined when the config file does not exist", async () => {
      // GIVEN a workspace id with no config on disk
      // WHEN reading the config THEN it is undefined
      await expect(manager.getConfig("unknown-id")).resolves.toBeUndefined();
    });

    it("should return undefined when the config file is not valid json", async () => {
      // GIVEN a workspace directory with a corrupt config
      const id = "corrupt";
      await mkdir(pathJoin(workspacesRoot, id), { recursive: true });
      await writeFile(pathJoin(workspacesRoot, id, WORKSPACE_CONFIG_FILE), "{ not json", {
        encoding: "utf-8",
      });

      // WHEN reading the config THEN it is undefined
      await expect(manager.getConfig(id)).resolves.toBeUndefined();
    });

    it("should read a config written directly to disk", async () => {
      // GIVEN a hand-written config
      const id = "hand-written";
      const config: WorkspaceConfig = {
        id,
        name: "Hand Written",
        namespace: "org",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-02T00:00:00.000Z",
      };
      await mkdir(pathJoin(workspacesRoot, id), { recursive: true });
      await writeFile(
        pathJoin(workspacesRoot, id, WORKSPACE_CONFIG_FILE),
        JSON.stringify(config) ?? "",
        { encoding: "utf-8" },
      );

      // WHEN reading the config THEN it matches what was written
      await expect(manager.getConfig(id)).resolves.toEqual(config);
    });
  });
});

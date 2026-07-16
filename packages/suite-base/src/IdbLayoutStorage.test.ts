/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IDBFactory } from "fake-indexeddb";

import { IdbLayoutStorage } from "@lichtblick/suite-base/IdbLayoutStorage";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutBaseline,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { migrateLayout } from "@lichtblick/suite-base/services/migrateLayout";

const mockLogError = jest.fn();

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    getLogger: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: (...args: unknown[]) => mockLogError(...args),
    }),
  },
}));

jest.mock("@lichtblick/suite-base/services/migrateLayout", () => ({
  __esModule: true,
  migrateLayout: jest.fn((layout: unknown) => layout),
}));

function makeLayout(id: string, name: string): Layout {
  const baseline: LayoutBaseline = {
    data: {
      configById: {},
      globalVariables: {},
      userNodes: {},
      playbackConfig: { speed: 1 },
    },
    savedAt: new Date(10).toISOString() as ISO8601Timestamp,
  };
  return {
    id: id as LayoutID,
    name,
    permission: "CREATOR_WRITE",
    baseline,
    working: undefined,
    syncInfo: undefined,
  };
}

describe("IdbLayoutStorage", () => {
  beforeEach(() => {
    // Reset the shared fake IndexedDB between tests so namespaces don't leak across cases.
    globalThis.indexedDB = new IDBFactory();
    // Reset localStorage so legacy-migration cases start from a clean slate.
    localStorage.clear();
    // Default migrateLayout to an identity so stored layouts round-trip unchanged.
    jest.mocked(migrateLayout).mockImplementation((layout: unknown) => layout as Layout);
    mockLogError.mockClear();
  });

  describe("put and get", () => {
    it("should return the layout that was put when getting it back", async () => {
      // GIVEN a layout stored in a namespace
      const storage = new IdbLayoutStorage();
      const layout = makeLayout("layout-1", "First");
      await storage.put("local", layout);

      // WHEN getting it back by namespace and id
      const result = await storage.get("local", "layout-1" as LayoutID);

      // THEN the stored (migrated) layout is returned
      expect(result).toEqual(layout);
    });

    it("should return undefined when getting a missing id", async () => {
      // GIVEN an empty namespace
      const storage = new IdbLayoutStorage();

      // WHEN getting an id that was never stored
      const result = await storage.get("local", "does-not-exist" as LayoutID);

      // THEN undefined is returned
      expect(result).toBeUndefined();
    });

    it("should isolate layouts with the same id across namespaces", async () => {
      // GIVEN the same id used in two different namespaces
      const storage = new IdbLayoutStorage();
      const localLayout = makeLayout("shared-id", "Local");
      const remoteLayout = makeLayout("shared-id", "Remote");
      await storage.put("local", localLayout);
      await storage.put("remote", remoteLayout);

      // WHEN getting the id from each namespace
      const localResult = await storage.get("local", "shared-id" as LayoutID);
      const remoteResult = await storage.get("remote", "shared-id" as LayoutID);

      // THEN each namespace returns its own layout
      expect(localResult).toEqual(localLayout);
      expect(remoteResult).toEqual(remoteLayout);
    });
  });

  describe("list", () => {
    it("should return all layouts in a namespace", async () => {
      // GIVEN two layouts stored in the same namespace
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("a", "A"));
      await storage.put("local", makeLayout("b", "B"));

      // WHEN listing that namespace
      const result = await storage.list("local");

      // THEN both layouts are returned
      expect(result.map((l) => l.id).sort()).toEqual(["a", "b"]);
    });

    it("should return an empty array for an unknown namespace", async () => {
      // GIVEN a storage with a layout in another namespace
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("a", "A"));

      // WHEN listing an unknown namespace
      const result = await storage.list("unknown");

      // THEN the result is empty
      expect(result).toEqual([]);
    });

    it("should isolate layouts by namespace", async () => {
      // GIVEN layouts in two namespaces
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("a", "A"));
      await storage.put("remote", makeLayout("b", "B"));

      // WHEN listing each namespace
      const localResult = await storage.list("local");
      const remoteResult = await storage.list("remote");

      // THEN each namespace only contains its own layouts
      expect(localResult.map((l) => l.id)).toEqual(["a"]);
      expect(remoteResult.map((l) => l.id)).toEqual(["b"]);
    });

    it("should skip records whose migration throws and log the error", async () => {
      // GIVEN two stored layouts where migrating one of them throws
      const storage = new IdbLayoutStorage();
      const goodLayout = makeLayout("good", "Good");
      const badLayout = makeLayout("bad", "Bad");
      await storage.put("local", goodLayout);
      await storage.put("local", badLayout);
      jest.mocked(migrateLayout).mockImplementation((layout: unknown) => {
        if ((layout as Layout).id === "bad") {
          throw new Error("migration failed");
        }
        return layout as Layout;
      });

      // WHEN listing the namespace
      const result = await storage.list("local");

      // THEN only the good layout is returned and the failure is logged
      expect(result.map((l) => l.id)).toEqual(["good"]);
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should remove a layout so a later get returns undefined", async () => {
      // GIVEN a stored layout
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("a", "A"));

      // WHEN deleting it
      await storage.delete("local", "a" as LayoutID);

      // THEN it can no longer be retrieved
      expect(await storage.get("local", "a" as LayoutID)).toBeUndefined();
    });

    it("should not affect layouts in other namespaces", async () => {
      // GIVEN the same id stored in two namespaces
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("shared", "Local"));
      await storage.put("remote", makeLayout("shared", "Remote"));

      // WHEN deleting from one namespace
      await storage.delete("local", "shared" as LayoutID);

      // THEN the other namespace is untouched
      expect(await storage.get("local", "shared" as LayoutID)).toBeUndefined();
      expect(await storage.get("remote", "shared" as LayoutID)).toEqual(
        makeLayout("shared", "Remote"),
      );
    });
  });

  describe("close", () => {
    it("should resolve without throwing", async () => {
      // GIVEN an open storage instance
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("a", "A"));

      // WHEN closing the connection
      // THEN it resolves without throwing
      await expect(storage.close()).resolves.toBeUndefined();
    });
  });

  describe("database scoping", () => {
    it("should not share data between instances with different database names", async () => {
      // GIVEN two storages backed by differently-scoped databases
      const firstStorage = new IdbLayoutStorage("workspace-1");
      const secondStorage = new IdbLayoutStorage("workspace-2");
      await firstStorage.put("local", makeLayout("a", "A"));

      // WHEN reading from the other database
      const firstResult = await firstStorage.get("local", "a" as LayoutID);
      const secondResult = await secondStorage.get("local", "a" as LayoutID);

      // THEN the layout is only visible in the database it was written to
      expect(firstResult).toEqual(makeLayout("a", "A"));
      expect(secondResult).toBeUndefined();
    });

    it("should share data between the default constructor and an undefined workspace id", async () => {
      // GIVEN a layout written via the default (unscoped) constructor
      const defaultStorage = new IdbLayoutStorage();
      await defaultStorage.put("local", makeLayout("a", "A"));

      // WHEN reading through a storage explicitly constructed with the undefined-scoped name
      const undefinedScopedStorage = new IdbLayoutStorage(undefined);
      const result = await undefinedScopedStorage.get("local", "a" as LayoutID);

      // THEN both share the same underlying database
      expect(result).toEqual(makeLayout("a", "A"));
    });
  });

  describe("importLayouts", () => {
    it("moves layouts whose names are absent in the target namespace", async () => {
      // Given a "Default" layout in the local namespace and an empty target namespace
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("local-default", "Default"));

      // When importing local layouts into the remote namespace
      await storage.importLayouts({
        fromNamespace: "local",
        toNamespace: "remote-default-layouts",
      });

      // Then the layout is moved and the source namespace is emptied
      const target = await storage.list("remote-default-layouts");
      const source = await storage.list("local");
      expect(target.map((l) => l.name)).toEqual(["Default"]);
      expect(source).toHaveLength(0);
    });

    it("does not duplicate a layout whose name already exists in the target namespace", async () => {
      // Given a "Default" in both the local and the remote namespace (the workspace-removed repro)
      const storage = new IdbLayoutStorage();
      await storage.put("local", makeLayout("local-default", "Default"));
      await storage.put("remote-default-layouts", makeLayout("remote-default", "Default"));

      // When importing local layouts into the remote namespace
      await storage.importLayouts({
        fromNamespace: "local",
        toNamespace: "remote-default-layouts",
      });

      // Then the remote namespace still has exactly one "Default" and the source is emptied
      const target = await storage.list("remote-default-layouts");
      const source = await storage.list("local");
      expect(target.filter((l) => l.name === "Default")).toHaveLength(1);
      expect(target.map((l) => l.id)).toEqual(["remote-default"]);
      expect(source).toHaveLength(0);
    });

    it("should be a no-op when importing from an empty source namespace", async () => {
      // GIVEN a layout in the target namespace and an empty source namespace
      const storage = new IdbLayoutStorage();
      await storage.put("remote-default-layouts", makeLayout("remote-default", "Default"));

      // WHEN importing from an empty source namespace
      const importPromise = storage.importLayouts({
        fromNamespace: "local",
        toNamespace: "remote-default-layouts",
      });

      // THEN it resolves without throwing and the target namespace is unchanged
      await expect(importPromise).resolves.toBeUndefined();
      const target = await storage.list("remote-default-layouts");
      expect(target.map((l) => l.id)).toEqual(["remote-default"]);
    });
  });

  describe("migrateUnnamespacedLayouts", () => {
    it("should migrate a legacy localStorage layout into IndexedDB and remove the key", async () => {
      // GIVEN a legacy localStorage entry for a layout with a matching id
      const storage = new IdbLayoutStorage();
      const layout = makeLayout("legacy-id", "Legacy");
      const key = "studio.layouts.local.legacy-id";
      const layoutJson = JSON.stringify(layout)!;
      localStorage.setItem(key, layoutJson);

      // WHEN migrating un-namespaced layouts
      await storage.migrateUnnamespacedLayouts("local");

      // THEN the layout is written into IndexedDB and the legacy key is removed
      expect(await storage.get("local", "legacy-id" as LayoutID)).toEqual(layout);
      expect(localStorage.getItem(key)).toBeNull();
    });

    it("should skip and keep a legacy entry whose stored id does not match the layout id", async () => {
      // GIVEN a legacy entry whose key id differs from the layout id
      const storage = new IdbLayoutStorage();
      const layout = makeLayout("actual-id", "Mismatch");
      const key = "studio.layouts.local.wrong-id";
      const layoutJson = JSON.stringify(layout)!;
      localStorage.setItem(key, layoutJson);

      // WHEN migrating un-namespaced layouts
      await storage.migrateUnnamespacedLayouts("local");

      // THEN the layout is not migrated, the entry is left, and an error is logged
      expect(await storage.list("local")).toEqual([]);
      expect(localStorage.getItem(key)).toBe(layoutJson);
      expect(mockLogError).toHaveBeenCalled();
    });

    it("should resolve without writing anything when there are no legacy keys", async () => {
      // GIVEN no legacy localStorage keys
      const storage = new IdbLayoutStorage();

      // WHEN migrating un-namespaced layouts
      const migratePromise = storage.migrateUnnamespacedLayouts("local");

      // THEN it resolves without throwing and no layouts are written
      await expect(migratePromise).resolves.toBeUndefined();
      expect(await storage.list("local")).toEqual([]);
    });
  });
});

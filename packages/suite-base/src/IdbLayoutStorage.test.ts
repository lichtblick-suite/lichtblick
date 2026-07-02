/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IDBFactory } from "fake-indexeddb";

import { IdbLayoutStorage, layoutDatabaseName } from "@lichtblick/suite-base/IdbLayoutStorage";
import { KEY_WORKSPACE_PREFIX } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutBaseline,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { BasicBuilder } from "@lichtblick/test-builders";

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
  });
});

describe("layoutDatabaseName", () => {
  const DEFAULT_NAME = `${KEY_WORKSPACE_PREFIX}lichtblick-layouts`;

  it("should return the default unscoped database name when workspaceId is undefined", () => {
    // GIVEN no workspace id
    // WHEN computing the database name
    const result = layoutDatabaseName(undefined);

    // THEN the shared, unscoped name is returned with no workspace suffix
    expect(result).toBe(DEFAULT_NAME);
    expect(result).toMatch(/lichtblick-layouts$/);
  });

  it("should match the undefined case when called with no arguments (backward compatibility)", () => {
    // GIVEN no arguments passed
    // WHEN computing the database name
    const result = layoutDatabaseName();

    // THEN it matches the default unscoped name used by existing installs and the web build
    expect(result).toBe(DEFAULT_NAME);
    expect(result).toBe(layoutDatabaseName(undefined));
  });

  it("should scope the database name with the workspace id when one is given", () => {
    // GIVEN a workspace id
    const workspaceId = BasicBuilder.string();

    // WHEN computing the database name
    const result = layoutDatabaseName(workspaceId);

    // THEN the id is appended to the default name after a dash
    expect(result).toBe(`${DEFAULT_NAME}-${workspaceId}`);
  });

  it("should produce different names for different workspace ids", () => {
    // GIVEN two distinct workspace ids
    const firstId = BasicBuilder.string();
    const secondId = BasicBuilder.string();

    // WHEN computing the database name for each
    const firstName = layoutDatabaseName(firstId);
    const secondName = layoutDatabaseName(secondId);

    // THEN the two workspaces resolve to isolated databases
    expect(firstId).not.toBe(secondId);
    expect(firstName).not.toBe(secondName);
  });
});

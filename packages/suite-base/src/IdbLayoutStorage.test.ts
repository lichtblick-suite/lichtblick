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

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import idb from "idb";

import Database from "./Database";
import { updateMetaDatabases, doesDatabaseExist } from "./MetaDatabase";
import { getDatabasesInTests } from "./getDatabasesInTests";

describe("MetaDatabase", () => {
  const MAX = 3;
  const METADATABASE_NAME = "meta";

  beforeEach(() => {
    getDatabasesInTests().clear();
  });

  afterEach(async () => {
    // Clear up metadata.
    await idb.delete(METADATABASE_NAME);
  });

  describe("updateMetadatabases", () => {
    it("deletes databases if over max", async () => {
      async function createAndClose(name: string) {
        const db = await Database.get({ name, version: 1, objectStores: [{ name: "foo" }] });
        db.close();
        await updateMetaDatabases(name, 3, METADATABASE_NAME);
      }
      await createAndClose("foo");
      await createAndClose("bar");
      await createAndClose("baz");
      await createAndClose("biz");
      await createAndClose("boz");
      expect(getDatabasesInTests().size).toEqual(4);
    });

    it("does not delete databases which are still open", async () => {
      const dbs: Database[] = [];
      async function createAndClose(name: string) {
        const db = await Database.get({ name, version: 1, objectStores: [{ name: "foo" }] });
        dbs.push(db);
        await updateMetaDatabases(name, 3, METADATABASE_NAME);
      }
      await createAndClose("foo2");
      await createAndClose("bar2");
      await createAndClose("baz2");
      await createAndClose("biz2");
      await createAndClose("boz2");
      expect(getDatabasesInTests().size).toEqual(6);
      await Promise.all(dbs.map((db) => db.close()));
      await createAndClose("boz3");
      expect(getDatabasesInTests().size).toEqual(4);
      await updateMetaDatabases("baz3", 1, METADATABASE_NAME);
      expect(getDatabasesInTests().size).toEqual(2);
      await Promise.all(dbs.map((db) => db.close()));
    });

    it("does not throw when database deletion throws an error", async () => {
      const spy = jest.spyOn(global.indexedDB, "deleteDatabase").mockImplementation(() => {
        const result = <IDBOpenDBRequest>(<unknown>{
          // This gets overridden by caller
          onerror: (_: Event) => {
            throw new Error("failed to delete");
          },
        });
        setTimeout(() => {
          if (result.onerror) {
            result.onerror(new Event(""));
          }
        }, 10);
        return result;
      });
      await updateMetaDatabases("foo", 1, METADATABASE_NAME);
      await updateMetaDatabases("bar", 1, METADATABASE_NAME);
      spy.mockRestore();
    });

    it("does not delete databases which never fire onblocked calls", async () => {
      const spy = jest.spyOn(global.indexedDB, "deleteDatabase").mockImplementation(() => {
        return {} as IDBOpenDBRequest;
      });
      await updateMetaDatabases("foo", 1, METADATABASE_NAME);
      await updateMetaDatabases("bar", 1, METADATABASE_NAME);
      spy.mockRestore();
    });
  });

  describe("doesDatabaseExist", () => {
    it("returns false for entries that do not yet exist", async () => {
      const isSaved = await doesDatabaseExist("a", METADATABASE_NAME);
      expect(isSaved).toBeFalsy();
    });
    it("returns true for names that already exist", async () => {
      await updateMetaDatabases("a", MAX, METADATABASE_NAME);
      const isSaved = await doesDatabaseExist("a", METADATABASE_NAME);
      expect(isSaved).toBeTruthy();
    });
  });
});

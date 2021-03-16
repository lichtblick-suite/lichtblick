// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import Database from "@foxglove-studio/app/util/indexeddb/Database";

import PerformanceMeasuringClient from "./performanceMeasuringClient";

describe("performanceMeasuringClient", () => {
  let onPlaybackFinished: any;
  let onPlaybackError: any;
  beforeEach(() => {
    (window.indexedDB.databases as any) = () => {
      const dbs = [];
      // until indexedDB.databases() lands in the spec, get the databases on the fake by reaching into it
      // eslint-disable-next-line no-underscore-dangle
      for (const [_, db] of (global.indexedDB as any)._databases) {
        dbs.push(db);
      }
      return dbs;
    };
    onPlaybackFinished = jest.fn();
    onPlaybackError = jest.fn();
    window.addEventListener("playbackFinished", (e: any) => {
      onPlaybackFinished(e.detail);
    });
    window.addEventListener("playbackError", (e: any) => {
      onPlaybackError(e.detail);
    });
  });
  it("emits a 'finishedPlayback' event when finished", async () => {
    const perfClient = new PerformanceMeasuringClient();
    perfClient.start({ bagLengthMs: 1 });
    await perfClient.finish();
    expect(onPlaybackFinished).toHaveBeenCalled();
    expect(onPlaybackError).not.toHaveBeenCalled();
  });
  it("emits an error event when encountered", () => {
    const perfClient = new PerformanceMeasuringClient();
    perfClient.start({ bagLengthMs: 1 });
    const error = new Error("playback_error");
    perfClient.onError(error);
    expect(onPlaybackFinished).not.toHaveBeenCalled();
    expect(onPlaybackError).toHaveBeenCalledWith(error.toString());
  });
  it("collects IndexedDB stats", async () => {
    const db = await Database.open("dummy-db", 1, (openedDb) => {
      openedDb.createObjectStore("bar", { keyPath: "key" });
    });
    for (let i = 0; i < 10; i++) {
      await db.put("bar", { key: i, data: new Uint8Array(10) });
    }
    const perfClient = new PerformanceMeasuringClient();
    perfClient.start({ bagLengthMs: 1 });
    await perfClient.finish();
    const stats = onPlaybackFinished.mock.calls[0][0];
    expect(stats.idb).toEqual(
      expect.objectContaining({
        dbs: [
          {
            name: "dummy-db",
            version: 1,
            objectStoreRowCounts: [{ name: "bar", rowCount: 10 }],
          },
        ],
      }),
    );
  });
});

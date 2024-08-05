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

import { getNewConnection } from "./getNewConnection";

describe("getNewConnection", () => {
  describe("when using a limited cache", () => {
    const defaults = {
      currentRemainingRange: undefined,
      readRequestRange: undefined,
      downloadedRanges: [],
      lastResolvedCallbackEnd: undefined,
      maxRequestSize: 10,
      fileSize: 100,
      continueDownloadingThreshold: 5,
    };

    describe("when there is a read request", () => {
      it("throws when the range exceeds the cache size", () => {
        expect(() =>
          getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 60 },
          }),
        ).toThrow("Range 40-60 exceeds max request size 10 (file size 100)");
      });

      it("throws when the read request range has been fully downloaded already", () => {
        expect(() =>
          getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 50 },
            downloadedRanges: [{ start: 40, end: 50 }],
          }),
        ).toThrow(
          "Range for the first read request is fully downloaded, so it should have been deleted",
        );
      });

      describe("when there is an existing connection", () => {
        it("does not start a new connection when the current connection overlaps the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 45, end: 55 },
            readRequestRange: { start: 40, end: 50 },
          });
          expect(newConnection).toEqual(undefined);
        });

        it("does not start a new connection when the current connection is close enough to the start of the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 40, end: 50 },
            readRequestRange: {
              start: 45,
              /* 40 + continueDownloadingThreshold */
              end: 55,
            },
          });
          expect(newConnection).toEqual(undefined);
        });

        it("does start a new connection when it would take too long to get to the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 40, end: 50 },
            readRequestRange: { start: 46, end: 55 },
          });
          expect(newConnection).toEqual({
            start: 46,
            end: 56,
            /* 46 + maxRequestSize */
          });
        });

        it("does not download already downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 50 },
            downloadedRanges: [{ start: 45, end: 47 }],
          });
          expect(newConnection).toEqual({ start: 40, end: 45 });
        });
      });

      describe("when there is no existing connection", () => {
        it("starts a new connection when there is no existing one", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 45 },
          });
          expect(newConnection).toEqual({
            start: 40,
            end: 50,
            /* read-ahead */
          });
        });

        it("starts a new connection at the first non-downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 45, end: 55 },
            downloadedRanges: [{ start: 40, end: 50 }],
          });
          expect(newConnection).toEqual({ start: 50, end: 55 });
        });

        it("reads ahead a bit as long as it does not evict existing downloaded ranges that we requested", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 48, end: 55 },
            downloadedRanges: [{ start: 40, end: 50 }],
          });
          expect(newConnection).toEqual({
            start: 50,
            end: 58,
            /* readRequestRange.start + maxRequestSize */
          });
        });

        it("does not exceed file size in reading ahead", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 95, end: 100 },
          });
          expect(newConnection).toEqual({ start: 95, end: 100 });
        });
      });
    });

    describe("when there is no read request", () => {
      it("does not start a new connection", () => {
        const newConnection = getNewConnection(defaults);
        expect(newConnection).toEqual(undefined);
      });

      describe("read-ahead", () => {
        it("starts a new connection based on the end position of the last resolved read request", () => {
          const newConnection = getNewConnection({ ...defaults, lastResolvedCallbackEnd: 15 });
          expect(newConnection).toEqual({ start: 15, end: 25 });
        });

        it("skips over already downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            lastResolvedCallbackEnd: 15,
            downloadedRanges: [{ start: 10, end: 20 }],
          });
          expect(newConnection).toEqual({ start: 20, end: 25 });
        });

        it("creates no new connection when the read-ahead range has been fully downloaded", () => {
          const newConnection = getNewConnection({
            ...defaults,
            lastResolvedCallbackEnd: 15,
            downloadedRanges: [{ start: 10, end: 25 }],
          });
          expect(newConnection).toEqual(undefined);
        });
      });
    });
  });

  describe("when using an unlimited cache", () => {
    const defaults = {
      currentRemainingRange: undefined,
      readRequestRange: undefined,
      downloadedRanges: [],
      lastResolvedCallbackEnd: undefined,
      maxRequestSize: 100, // Same or bigger than `fileSize`.
      fileSize: 100,
      continueDownloadingThreshold: 5,
    };

    describe("when there is a read request", () => {
      it("throws when the read request range has been fully downloaded already", () => {
        expect(() =>
          getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 50 },
            downloadedRanges: [{ start: 40, end: 50 }],
          }),
        ).toThrow(
          "Range for the first read request is fully downloaded, so it should have been deleted",
        );
      });

      describe("when there is an existing connection", () => {
        it("does not start a new connection when the current connection overlaps the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 40, end: 100 },
            readRequestRange: { start: 20, end: 50 },
          });
          expect(newConnection).toEqual(undefined);
        });

        it("does not start a new connection when the current connection is close enough to the start of the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 40, end: 100 },
            readRequestRange: {
              start: 45,
              /* 40 + continueDownloadingThreshold */
              end: 55,
            },
          });
          expect(newConnection).toEqual(undefined);
        });

        it("does start a new connection when it would take too long to get to the read request range", () => {
          const newConnection = getNewConnection({
            ...defaults,
            currentRemainingRange: { start: 40, end: 100 },
            readRequestRange: { start: 46, end: 55 },
          });
          expect(newConnection).toEqual({ start: 46, end: 100 });
        });

        it("does not download already downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 20, end: 50 },
            downloadedRanges: [{ start: 30, end: 40 }],
          });
          expect(newConnection).toEqual({ start: 20, end: 30 });
        });
      });

      describe("when there is no existing connection", () => {
        it("starts a new connection when there is no existing one", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 40, end: 45 },
          });
          expect(newConnection).toEqual({ start: 40, end: 100 });
        });

        it("starts a new connection at the first non-downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 45, end: 55 },
            downloadedRanges: [{ start: 40, end: 50 }],
          });
          expect(newConnection).toEqual({ start: 50, end: 100 });
        });
      });
    });

    describe("when there is no read request", () => {
      it("starts downloading the entire file", () => {
        const newConnection = getNewConnection(defaults);
        expect(newConnection).toEqual({ start: 0, end: 100 });
      });

      it("does not download already downloaded ranges", () => {
        const newConnection = getNewConnection({
          ...defaults,
          downloadedRanges: [{ start: 20, end: 30 }],
        });
        expect(newConnection).toEqual({ start: 0, end: 20 });
      });

      it("keeps downloading linearly from start to end", () => {
        const newConnection = getNewConnection({
          ...defaults,
          downloadedRanges: [
            { start: 0, end: 30 },
            { start: 50, end: 70 },
          ],
        });
        expect(newConnection).toEqual({ start: 30, end: 50 });
      });

      it("downloads from the last request if there was one", () => {
        // This can happen if the definition of `downloadedRanges` changes after the file has already
        // been downloaded, e.g. if the user subscribes to a new topic.
        const newConnection = getNewConnection({
          ...defaults,
          lastResolvedCallbackEnd: 30,
        });
        expect(newConnection).toEqual({ start: 30, end: 100 });
      });
    });
  });
});

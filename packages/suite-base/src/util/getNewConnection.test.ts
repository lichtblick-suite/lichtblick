// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

const READ_AHEAD_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB - must match the constant in getNewConnection.ts

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
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead reaches end of file: min(46 + 50MB, 100) = 100
          expect(newConnection).toEqual({
            start: 46,
            end: 100,
            /* min(readRequestRange.start + READ_AHEAD_BUFFER_SIZE, fileSize) */
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
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead reaches end of file: min(40 + 50MB, 100) = 100
          expect(newConnection).toEqual({
            start: 40,
            end: 100,
            /* min(readRequestRange.start + READ_AHEAD_BUFFER_SIZE, fileSize) */
          });
        });

        it("starts a new connection at the first non-downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 45, end: 55 },
            downloadedRanges: [{ start: 40, end: 50 }],
          });
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead reaches end of file: min(45 + 50MB, 100) = 100
          expect(newConnection).toEqual({ start: 50, end: 100 });
        });

        it("reads ahead a bit as long as it does not evict existing downloaded ranges that we requested", () => {
          const newConnection = getNewConnection({
            ...defaults,
            readRequestRange: { start: 48, end: 55 },
            downloadedRanges: [{ start: 40, end: 50 }],
          });
          // With READ_AHEAD_BUFFER_SIZE (50 MB), read-ahead is limited by fileSize (100) in small test files.
          // Math.min(48 + 50MB, 100) = 100, so it reads from 50 to end of file.
          expect(newConnection).toEqual({
            start: 50,
            end: 100,
            /* readRequestRange.start + READ_AHEAD_BUFFER_SIZE, capped by fileSize */
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
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead reaches end of file: min(15 + 50MB, 100) = 100
          expect(newConnection).toEqual({ start: 15, end: 100 });
        });

        it("skips over already downloaded ranges", () => {
          const newConnection = getNewConnection({
            ...defaults,
            lastResolvedCallbackEnd: 10,
            downloadedRanges: [{ start: 10, end: 20 }],
          });
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead reaches end of file: min(10 + 50MB, 100) = 100
          // Skips already downloaded 10-20, starts at 20
          expect(newConnection).toEqual({ start: 20, end: 100 });
        });

        it("creates no new connection when the read-ahead range has been fully downloaded", () => {
          // With READ_AHEAD_BUFFER_SIZE (50 MB) and small fileSize (100),
          // read-ahead would be min(10 + 50MB, 100) = 100
          // To test "fully downloaded", the downloaded range must cover to end of file
          const newConnection = getNewConnection({
            ...defaults,
            lastResolvedCallbackEnd: 10,
            downloadedRanges: [{ start: 10, end: 100 }], // Covers entire read-ahead range
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

  // Tests specific to READ_AHEAD_BUFFER_SIZE behavior
  describe("READ_AHEAD_BUFFER_SIZE constraints", () => {
    it("limits read-ahead to READ_AHEAD_BUFFER_SIZE even with large maxRequestSize", () => {
      const largeFileSize = 200 * 1024 * 1024; // 200 MB
      const newConnection = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: { start: 0, end: 1024 },
        downloadedRanges: [],
        lastResolvedCallbackEnd: undefined,
        maxRequestSize: 100 * 1024 * 1024, // 100 MB cache
        fileSize: largeFileSize,
        continueDownloadingThreshold: 5,
      });

      // Should read ahead READ_AHEAD_BUFFER_SIZE (50 MB), not maxRequestSize (100 MB)
      expect(newConnection).toEqual({ start: 0, end: READ_AHEAD_BUFFER_SIZE });
    });

    it("respects fileSize cap when READ_AHEAD_BUFFER_SIZE exceeds remaining file", () => {
      const smallFileSize = 30 * 1024 * 1024; // 30 MB
      const newConnection = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: { start: 0, end: 1024 },
        downloadedRanges: [],
        lastResolvedCallbackEnd: undefined,
        maxRequestSize: 100 * 1024 * 1024,
        fileSize: smallFileSize,
        continueDownloadingThreshold: 5,
      });

      // Should cap at fileSize (30 MB), not READ_AHEAD_BUFFER_SIZE (50 MB)
      expect(newConnection).toEqual({ start: 0, end: smallFileSize });
    });

    it("applies READ_AHEAD_BUFFER_SIZE when reading from lastResolvedCallbackEnd", () => {
      const largeFileSize = 200 * 1024 * 1024; // 200 MB
      const lastEnd = 10 * 1024 * 1024; // 10 MB
      const newConnection = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: undefined,
        downloadedRanges: [],
        lastResolvedCallbackEnd: lastEnd,
        maxRequestSize: 100 * 1024 * 1024,
        fileSize: largeFileSize,
        continueDownloadingThreshold: 5,
      });

      // Should read ahead READ_AHEAD_BUFFER_SIZE from lastResolvedCallbackEnd
      expect(newConnection).toEqual({
        start: lastEnd,
        end: lastEnd + READ_AHEAD_BUFFER_SIZE,
      });
    });

    it("prevents read-ahead from exceeding file boundary", () => {
      const fileSize = 100 * 1024 * 1024; // 100 MB
      const lastEnd = 80 * 1024 * 1024; // 80 MB
      const newConnection = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: undefined,
        downloadedRanges: [],
        lastResolvedCallbackEnd: lastEnd,
        maxRequestSize: 100 * 1024 * 1024,
        fileSize,
        continueDownloadingThreshold: 5,
      });

      // Should cap at fileSize: min(80 + 50, 100) = 100 MB
      expect(newConnection).toEqual({
        start: lastEnd,
        end: fileSize,
      });
    });

    it("uses READ_AHEAD_BUFFER_SIZE independent of maxRequestSize value", () => {
      const largeFileSize = 200 * 1024 * 1024; // 200 MB

      // Test with small maxRequestSize
      const connection1 = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: { start: 0, end: 1024 },
        downloadedRanges: [],
        lastResolvedCallbackEnd: undefined,
        maxRequestSize: 5 * 1024 * 1024, // 5 MB cache (smaller than read-ahead)
        fileSize: largeFileSize,
        continueDownloadingThreshold: 5,
      });

      // Test with large maxRequestSize
      const connection2 = getNewConnection({
        currentRemainingRange: undefined,
        readRequestRange: { start: 0, end: 1024 },
        downloadedRanges: [],
        lastResolvedCallbackEnd: undefined,
        maxRequestSize: 150 * 1024 * 1024, // 150 MB cache (larger than read-ahead)
        fileSize: largeFileSize,
        continueDownloadingThreshold: 5,
      });

      // Both should use READ_AHEAD_BUFFER_SIZE, not maxRequestSize
      expect(connection1).toEqual({ start: 0, end: READ_AHEAD_BUFFER_SIZE });
      expect(connection2).toEqual({ start: 0, end: READ_AHEAD_BUFFER_SIZE });
    });
  });
});

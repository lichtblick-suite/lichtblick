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
import { isOverlapping } from "intervals-fn";

import { Range, isRangeCoveredByRanges, missingRanges } from "./ranges";

const READ_AHEAD_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB

// Based on a number of properties this function determines if a new connection should be opened or
// not. It can be used for any type of ranges, be it bytes, timestamps, or something else.
export function getNewConnection(options: {
  currentRemainingRange?: Range; // The remaining range that the current connection (if any) is going to download.
  additionalRemainingRanges?: Range[]; // Remaining ranges of any other concurrent connections.

  readRequestRange?: Range; // The range of the read request that we're trying to satisfy.
  downloadedRanges: Range[]; // Array of ranges that have been downloaded already.
  lastResolvedCallbackEnd?: number; // The range.end of the last read request that we resolved. Useful for reading ahead a bit.
  maxRequestSize: number; // The cache size.
  fileSize: number; // Size of the file.
  continueDownloadingThreshold: number; // Amount we're willing to wait downloading before opening a new connection.
  // When false, only the exact requested byte ranges are downloaded and no speculative
  // read-ahead is performed. Used for many-small-file remote sessions to avoid fetching
  // whole files up-front. Defaults to true (legacy behaviour).
  readAheadEnabled?: boolean;
  readAheadBufferBytes?: number;
}): Range | undefined {
  const {
    readRequestRange,
    currentRemainingRange,
    additionalRemainingRanges = [],
    readAheadEnabled = true,
    readAheadBufferBytes = READ_AHEAD_BUFFER_SIZE,
    ...otherOptions
  } = options;
  const allRemainingRanges =
    currentRemainingRange != undefined
      ? [currentRemainingRange, ...additionalRemainingRanges]
      : additionalRemainingRanges;
  if (readRequestRange) {
    return getNewConnectionWithExistingReadRequest({
      readRequestRange,
      allRemainingRanges,
      readAheadEnabled,
      readAheadBufferBytes,
      ...otherOptions,
    });
  } else if (allRemainingRanges.length === 0 && readAheadEnabled) {
    return getNewConnectionWithoutExistingConnection({
      ...otherOptions,
      readAheadBufferBytes,
    });
  }
  return undefined;
}

function getNewConnectionWithExistingReadRequest({
  allRemainingRanges,
  readRequestRange,
  downloadedRanges,
  maxRequestSize,
  fileSize,
  continueDownloadingThreshold,
  readAheadEnabled,
  readAheadBufferBytes,
}: {
  allRemainingRanges: Range[];
  readRequestRange: Range;
  downloadedRanges: Range[];
  lastResolvedCallbackEnd?: number;
  maxRequestSize: number;
  fileSize: number;
  continueDownloadingThreshold: number;
  readAheadEnabled: boolean;
  readAheadBufferBytes: number;
}): Range | undefined {
  // We have a requested range that we're trying to download.
  if (readRequestRange.end - readRequestRange.start > maxRequestSize) {
    // This should have been caught way earlier, but just as a sanity check.
    throw new Error(
      `Range ${readRequestRange.start}-${readRequestRange.end} exceeds max request size ${maxRequestSize} (file size ${fileSize})`,
    );
  }

  // Get the parts of the requested range that have not been downloaded yet.
  const notDownloadedRanges = missingRanges(readRequestRange, downloadedRanges);

  if (!notDownloadedRanges[0]) {
    // If there aren't any, then we should have never passed in `readRequestRange`.
    throw new Error(
      "Range for the first read request is fully downloaded, so it should have been deleted",
    );
  }

  // Skip a new connection if any existing one overlaps the missing range and will reach it soon.
  const hasGoodEnoughConnection = allRemainingRanges.some(
    (remainingRange) =>
      isOverlapping(notDownloadedRanges, [remainingRange]) &&
      !(remainingRange.start + continueDownloadingThreshold < notDownloadedRanges[0]!.start),
  );

  if (hasGoodEnoughConnection) {
    return;
  }
  // When read-ahead is disabled, only download exactly the missing portion of the requested range.
  if (!readAheadEnabled) {
    return notDownloadedRanges[0];
  }
  // No whole-file request even if the cache fits it: proxies would stream it all before the abort.
  if (notDownloadedRanges[0].end === readRequestRange.end) {
    // If we're downloading to the end of our range, do some reading ahead while we're at it.
    // Note that we might have already downloaded parts of this range, but we don't know when
    // they get evicted, so for now we just the entire range again.
    // Use the configured read-ahead buffer to avoid downloading too much data that may not be needed,
    // but never shrink below the actual missing tail of the pending read request.
    return {
      ...notDownloadedRanges[0],
      end: Math.max(
        notDownloadedRanges[0].end,
        Math.min(readRequestRange.start + readAheadBufferBytes, fileSize),
      ),
    };
  }

  // Otherwise, start reading from the first non-downloaded range.
  return notDownloadedRanges[0];
}

function getNewConnectionWithoutExistingConnection({
  downloadedRanges,
  lastResolvedCallbackEnd,
  maxRequestSize,
  fileSize,
  readAheadBufferBytes,
}: {
  downloadedRanges: Range[];
  lastResolvedCallbackEnd?: number;
  maxRequestSize: number;
  fileSize: number;
  readAheadBufferBytes: number;
}): Range | undefined {
  // If we don't have any read requests, and we also don't have an active connection, then start
  // reading ahead as much data as we can!
  let readAheadRange: Range | undefined;
  if (maxRequestSize >= fileSize) {
    // Cap at readAheadBufferBytes (see above), preferring data near the last request.
    const start = lastResolvedCallbackEnd ?? 0;
    const potentialRange = { start, end: Math.min(start + readAheadBufferBytes, fileSize) };
    if (!isRangeCoveredByRanges(potentialRange, downloadedRanges)) {
      readAheadRange = potentialRange;
    } else {
      readAheadRange = { start: 0, end: Math.min(readAheadBufferBytes, fileSize) };
    }
  } else if (lastResolvedCallbackEnd != undefined) {
    if (lastResolvedCallbackEnd >= fileSize) {
      return undefined;
    }
    // Otherwise, if we have a limited cache, we want to read the data right after the last
    // read request, because usually read requests are sequential without gaps.
    // Use the configured read-ahead buffer to avoid downloading too much data that may not be needed.
    readAheadRange = {
      start: lastResolvedCallbackEnd,
      end: Math.min(lastResolvedCallbackEnd + readAheadBufferBytes, fileSize),
    };
  }
  if (readAheadRange) {
    // If we have a range that we want to read ahead, then create a new connection for the range
    // within it that has not already been downloaded.
    return missingRanges(readAheadRange, downloadedRanges)[0];
  }
  return undefined;
}

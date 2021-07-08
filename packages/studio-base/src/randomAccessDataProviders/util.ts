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

import { debounce } from "lodash";

import { ExtensionPoint } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { fromMillis } from "@foxglove/studio-base/util/time";

const STALL_THRESHOLD_MS = 2000;

// Log pauses longer than two seconds. Shorter durations will make more events. We can always filter
// the events, though.
const getMaybeLogStall = (
  extensionPoint: ExtensionPoint,
  stallThresholdMs: number,
): ((arg0: Buffer) => void) => {
  let firstDataReceivedTime: number;
  let lastDataReceivedTime: number;
  let bytesReceived = 0;
  const startOfRequest = Date.now();
  return (buffer: Buffer) => {
    const now = Date.now();
    if (firstDataReceivedTime == undefined) {
      firstDataReceivedTime = now;
    }
    if (lastDataReceivedTime != undefined && now - lastDataReceivedTime > stallThresholdMs) {
      const stallDuration = fromMillis(now - lastDataReceivedTime);
      const requestTimeUntilStall = fromMillis(lastDataReceivedTime - startOfRequest);
      const transferTimeUntilStall = fromMillis(lastDataReceivedTime - firstDataReceivedTime);
      const bytesReceivedBeforeStall = bytesReceived;

      extensionPoint.reportMetadataCallback({
        type: "data_provider_stall",
        stallDuration,
        requestTimeUntilStall,
        transferTimeUntilStall,
        bytesReceivedBeforeStall,
      });
    }
    lastDataReceivedTime = now;
    bytesReceived += buffer.length;
  };
};

// Used when we want to limit some log rate, but the log contents depend on the combined contents
// of each event (like a sum).
export const debounceReduce = <A, T>({
  action,
  // Debounced function
  wait,
  reducer,
  // Combining/mapping function for action's argument
  initialValue,
}: {
  action: (arg0: A) => void;
  wait: number;
  reducer: (arg0: A, arg1: T) => A;
  initialValue: A;
}): ((arg0: T) => void) => {
  let current = initialValue;
  const debounced = debounce(
    () => {
      action(current);
      current = initialValue;
    },
    wait,
    { leading: true, trailing: true },
  );
  return (next: T) => {
    current = reducer(current, next);
    debounced();
  };
};

const getLogThroughput = (extensionPoint: ExtensionPoint): ((arg0: Buffer) => void) => {
  return debounceReduce({
    action: (bytes) => extensionPoint.reportMetadataCallback({ type: "received_bytes", bytes }),
    wait: 10,
    reducer: (bytesSoFar, buffer) => bytesSoFar + buffer.length,
    initialValue: 0,
  });
};

export const getReportMetadataForChunk = (
  extensionPoint: ExtensionPoint,
  stallThresholdMs: number = STALL_THRESHOLD_MS,
): ((arg0: Buffer) => void) => {
  const maybeLogStall = getMaybeLogStall(extensionPoint, stallThresholdMs);
  const logThroughput = getLogThroughput(extensionPoint);
  return (buffer: Buffer) => {
    maybeLogStall(buffer);
    logThroughput(buffer);
  };
};

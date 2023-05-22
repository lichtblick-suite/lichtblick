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

// No time functions that require `moment` should live in this file.
import log from "@foxglove/log";
import { Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { MarkerArray, StampedMessage } from "@foxglove/studio-base/types/Messages";

export type TimestampMethod = "receiveTime" | "headerStamp";

export function formatTimeRaw(stamp: Time): string {
  if (stamp.sec < 0 || stamp.nsec < 0) {
    log.error("Times are not allowed to be negative");
    return "(invalid negative time)";
  }
  return `${stamp.sec}.${stamp.nsec.toFixed().padStart(9, "0")}`;
}

const DURATION_20_YEARS_SEC = 20 * 365 * 24 * 60 * 60;

// Values "too small" to be absolute epoch-based times are probably relative durations.
export function isAbsoluteTime(time: Time): boolean {
  return time.sec > DURATION_20_YEARS_SEC;
}

export function formatFrame({ sec, nsec }: Time): string {
  return `${sec}.${String.prototype.padStart.call(nsec, 9, "0")}`;
}

export function getTimestampForMessageEvent(
  messageEvent: MessageEvent,
  timestampMethod?: TimestampMethod,
): Time | undefined {
  return timestampMethod === "headerStamp"
    ? getTimestampForMessage(messageEvent.message)
    : messageEvent.receiveTime;
}

export function getTimestampForMessage(message: unknown): Time | undefined {
  if ((message as Partial<StampedMessage>).header != undefined) {
    // This message has a "header" field
    const stamp = (message as Partial<StampedMessage>).header?.stamp;
    if (stamp != undefined && "sec" in stamp && "nsec" in stamp) {
      return stamp;
    }
  } else if ((message as Partial<MarkerArray>).markers?.[0]?.header != undefined) {
    // This is a marker array message with a "markers" array and at least one entry
    const stamp = (message as MarkerArray).markers[0]?.header.stamp;
    if (stamp != undefined && "sec" in stamp && "nsec" in stamp) {
      return stamp;
    }
  }

  return undefined;
}

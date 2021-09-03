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
import { Time, add, isLessThan, fromNanoSec, clampTime, interpolate } from "@foxglove/rostime";
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

export function formatFrame({ sec, nsec }: Time): string {
  return `${sec}.${String.prototype.padStart.call(nsec, 9, "0")}`;
}

// Functions and types for specifying and applying player initial seek time intentions.
// When loading from a copied URL, the exact unix time is used.
type AbsoluteSeekToTime = Readonly<{ type: "absolute"; time: Time }>;
// If no seek time is specified, we default to 299ms from the start of the bag. Finer control is
// exposed for use-cases where it's needed.
type RelativeSeekToTime = Readonly<{ type: "relative"; startOffset: Time }>;
// Currently unused: We may expose interactive seek controls before the bag duration is known, and
// store the seek state as a fraction of the eventual bag length.
type SeekFraction = Readonly<{ type: "fraction"; fraction: number }>;
export type SeekToTimeSpec = AbsoluteSeekToTime | RelativeSeekToTime | SeekFraction;

// Amount to seek into the bag from the start when loading the player, to show
// something useful on the screen. Ideally this is less than BLOCK_SIZE_NS from
// MemoryCacheDataProvider so we still stay within the first block when fetching
// initial data.
export const SEEK_ON_START_NS = BigInt(99 * 1e6); /* ms */

export function getSeekToTime(): SeekToTimeSpec {
  const defaultResult: SeekToTimeSpec = {
    type: "relative",
    startOffset: fromNanoSec(SEEK_ON_START_NS),
  };
  return defaultResult;
}

export function getSeekTimeFromSpec(spec: SeekToTimeSpec, start: Time, end: Time): Time {
  const rawSpecTime =
    spec.type === "absolute"
      ? spec.time
      : spec.type === "relative"
      ? add(isLessThan(spec.startOffset, { sec: 0, nsec: 0 }) ? end : start, spec.startOffset)
      : interpolate(start, end, spec.fraction);
  return clampTime(rawSpecTime, start, end);
}

export function getTimestampForMessageEvent(
  messageEvent: MessageEvent<unknown>,
  timestampMethod?: TimestampMethod,
): Time | undefined {
  return timestampMethod === "headerStamp"
    ? getTimestampForMessage(messageEvent.message)
    : messageEvent.receiveTime;
}

export function getTimestampForMessage(message: unknown): Time | undefined {
  if ((message as Partial<StampedMessage>).header != undefined) {
    // This message has a "header" field
    const stamp = (message as StampedMessage).header.stamp;
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

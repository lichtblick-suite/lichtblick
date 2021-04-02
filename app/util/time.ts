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
import { Time, TimeUtil } from "rosbag";

import { cast, Bobject, Message } from "@foxglove-studio/app/players/types";
import { BinaryTime } from "@foxglove-studio/app/types/BinaryMessages";
import { deepParse } from "@foxglove-studio/app/util/binaryObjects";
import {
  SEEK_TO_FRACTION_QUERY_KEY,
  SEEK_TO_RELATIVE_MS_QUERY_KEY,
  SEEK_TO_UNIX_MS_QUERY_KEY,
} from "@foxglove-studio/app/util/globalConstants";
import log from "@foxglove/log";

type BatchTimestamp = {
  seconds: number;
  nanoseconds: number;
};

export type TimestampMethod = "receiveTime" | "headerStamp";

export function isTime(obj?: unknown): obj is Time {
  return (
    typeof obj === "object" &&
    !!obj &&
    "sec" in obj &&
    "nsec" in obj &&
    Object.getOwnPropertyNames(obj).length === 2
  );
}

export function formatTimeRaw(stamp: Time) {
  if (stamp.sec < 0 || stamp.nsec < 0) {
    log.error("Times are not allowed to be negative");
    return "(invalid negative time)";
  }
  return `${stamp.sec}.${stamp.nsec.toFixed().padStart(9, "0")}`;
}

const isNum = /^\d+\.?\d*$/;

// converts a string in Seconds to a time
// we use a string because nano-second precision cannot be stored
// in a JavaScript number for large nanoseconds (unix stamps)
export function fromSecondStamp(stamp: string): Time {
  if (!isNum.test(stamp)) {
    throw new Error(`Could not parse time from ${stamp}`);
  }
  const [secondString = "0", nanoString = "0"] = stamp.split(".");
  const nanosecond = nanoString.length <= 9 ? nanoString.padEnd(9, "0") : nanoString.slice(0, 9);

  return { sec: parseInt(secondString), nsec: parseInt(nanosecond) };
}

// note: sub-millisecond precision is lost
export function toDate(stamp: Time): Date {
  const { sec, nsec } = stamp;
  return new Date(sec * 1000 + nsec / 1e6);
}

export function fromDate(date: Date): Time {
  const millis = date.getTime();
  const remainder = millis % 1000;
  return { sec: Math.floor(millis / 1000), nsec: remainder * 1e6 };
}

// returns the percentage of target in the range between start & end
// e.g. start = { sec: 0 }, end = { sec: 10 }, target = { sec: 5 } = 50
export function percentOf(start: Time, end: Time, target: Time) {
  const totalDuration = subtractTimes(end, start);
  const targetDuration = subtractTimes(target, start);
  return (toSec(targetDuration) / toSec(totalDuration)) * 100;
}

export function interpolateTimes(start: Time, end: Time, fraction: number): Time {
  const duration = subtractTimes(end, start);
  return TimeUtil.add(start, fromNanoSec(fraction * toNanoSec(duration)));
}

function fixTime(t: Time): Time {
  // Equivalent to fromNanoSec(toNanoSec(t)), but no chance of precision loss.
  // nsec should be non-negative, and less than 1e9.
  let { sec, nsec } = t;
  while (nsec >= 1e9) {
    nsec -= 1e9;
    sec += 1;
  }
  while (nsec < 0) {
    nsec += 1e9;
    sec -= 1;
  }
  return { sec, nsec };
}

export function subtractTimes(
  { sec: sec1, nsec: nsec1 }: Time,
  { sec: sec2, nsec: nsec2 }: Time,
): Time {
  return fixTime({ sec: sec1 - sec2, nsec: nsec1 - nsec2 });
}

// WARNING! This will not be a precise integer for large time values due to JS only supporting
// 53-bit integers. Best to only use this when the time represents a relatively small duration
// (at max a few weeks).
export function toNanoSec({ sec, nsec }: Time) {
  return sec * 1e9 + nsec;
}

// WARNING! Imprecise float; see above.
export function toMicroSec({ sec, nsec }: Time) {
  return (sec * 1e9 + nsec) / 1000;
}

// WARNING! Imprecise float; see above.
export function toSec({ sec, nsec }: Time): number {
  return sec + nsec * 1e-9;
}

export function fromSec(value: number): Time {
  // From https://github.com/ros/roscpp_core/blob/indigo-devel/rostime/include/ros/time.h#L153
  let sec = Math.trunc(value);
  let nsec = Math.round((value - sec) * 1e9);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

export function fromNanoSec(nsec: number): Time {
  // From https://github.com/ros/roscpp_core/blob/86720717c0e1200234cc0a3545a255b60fb541ec/rostime/include/ros/impl/time.h#L63
  // and https://github.com/ros/roscpp_core/blob/7583b7d38c6e1c2e8623f6d98559c483f7a64c83/rostime/src/time.cpp#L536
  return { sec: Math.trunc(nsec / 1e9), nsec: nsec % 1e9 };
}

export function toMillis(time: Time, roundUp: boolean = true): number {
  const secondsMillis = time.sec * 1e3;
  const nsecMillis = time.nsec / 1e6;
  return roundUp ? secondsMillis + Math.ceil(nsecMillis) : secondsMillis + Math.floor(nsecMillis);
}

export function fromMillis(value: number): Time {
  let sec = Math.trunc(value / 1000);
  let nsec = Math.round((value - sec * 1000) * 1e6);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

export function fromMicros(value: number): Time {
  let sec = Math.trunc(value / 1e6);
  let nsec = Math.round((value - sec * 1e6) * 1e3);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

export function findClosestTimestampIndex(
  currentTime: Time,
  frameTimestamps: string[] = [],
): number {
  const currT = toSec(currentTime);
  const timestamps = frameTimestamps.map(Number);
  const maxIdx = frameTimestamps.length - 1;
  if (frameTimestamps.length === 0) {
    return -1;
  }
  let [l, r] = [0, maxIdx];
  if (currT <= timestamps[0]!) {
    return 0;
  } else if (currT >= timestamps[maxIdx]!) {
    return maxIdx;
  }

  while (l <= r) {
    const m = l + Math.floor((r - l) / 2);
    const prevT = timestamps[m]!;
    const nextT = timestamps[m + 1]!;

    if (prevT <= currT && currT < nextT) {
      return m;
    } else if (prevT < currT && nextT <= currT) {
      l = m + 1;
    } else {
      r = m - 1;
    }
  }
  return -1;
}

export function getNextFrame(
  currentTime: Time,
  timestamps: string[] = [],
  goLeft?: boolean,
): Time | undefined {
  if (!timestamps.length) {
    return undefined;
  }
  const effectiveIdx = findClosestTimestampIndex(currentTime, timestamps);
  if (effectiveIdx === -1) {
    return undefined;
  }
  let nextIdx = 0;
  const maxIdx = timestamps.length - 1;
  if (effectiveIdx === -1) {
    nextIdx = goLeft ? maxIdx : 0;
  } else {
    nextIdx = effectiveIdx + (goLeft ? -1 : 1);
    if (nextIdx < 0) {
      nextIdx = maxIdx;
    } else if (nextIdx > maxIdx) {
      nextIdx = 0;
    }
  }
  const nextFrame = timestamps[nextIdx];
  if (nextFrame == undefined) {
    return undefined;
  }
  return fromSecondStamp(nextFrame);
}

export function formatFrame({ sec, nsec }: Time): string {
  return `${sec}.${String.prototype.padStart.call(nsec, 9, "0")}`;
}

export function transformBatchTimestamp({ seconds, nanoseconds }: BatchTimestamp): string {
  return formatFrame({ sec: seconds, nsec: nanoseconds });
}

export function clampTime(time: Time, start: Time, end: Time): Time {
  if (TimeUtil.compare(start, time) > 0) {
    return start;
  }
  if (TimeUtil.compare(end, time) < 0) {
    return end;
  }
  return time;
}

export const isTimeInRangeInclusive = (time: Time, start: Time, end: Time) => {
  if (TimeUtil.compare(start, time) > 0 || TimeUtil.compare(end, time) < 0) {
    return false;
  }
  return true;
};

export function parseRosTimeStr(str: string): Time | undefined {
  if (/^\d+\.?$/.test(str)) {
    // Whole number with optional "." at the end.
    return { sec: parseInt(str, 10) || 0, nsec: 0 };
  }
  if (!/^\d+\.\d+$/.test(str)) {
    // Not digits.digits -- invalid.
    return undefined;
  }
  const partials = str.split(".");
  if (partials.length === 0) {
    return undefined;
  }

  const [first, second] = partials;
  if (first === undefined || second === undefined) {
    return undefined;
  }

  // There can be 9 digits of nanoseconds. If the fractional part is "1", we need to add eight
  // zeros. Also, make sure we round to an integer if we need to _remove_ digits.
  const digitsShort = 9 - second.length;
  const nsec = Math.round(parseInt(second, 10) * 10 ** digitsShort);
  // It's possible we rounded to { sec: 1, nsec: 1e9 }, which is invalid, so fixTime.
  return fixTime({ sec: parseInt(first, 10) || 0, nsec });
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
export const SEEK_ON_START_NS = 99 * 1e6; /* ms */

export function getSeekToTime(): SeekToTimeSpec {
  const params = new URLSearchParams(window.location.search);
  const absoluteSeek = params.get(SEEK_TO_UNIX_MS_QUERY_KEY);
  const defaultResult: SeekToTimeSpec = {
    type: "relative",
    startOffset: fromNanoSec(SEEK_ON_START_NS),
  };
  if (absoluteSeek != undefined) {
    return isNaN(+absoluteSeek)
      ? defaultResult
      : { type: "absolute", time: fromMillis(parseInt(absoluteSeek)) };
  }
  const relativeSeek = params.get(SEEK_TO_RELATIVE_MS_QUERY_KEY);
  if (relativeSeek != undefined) {
    return isNaN(+relativeSeek)
      ? defaultResult
      : { type: "relative", startOffset: fromMillis(parseInt(relativeSeek)) };
  }
  const seekFraction = params.get(SEEK_TO_FRACTION_QUERY_KEY);
  if (seekFraction != undefined) {
    return isNaN(+seekFraction)
      ? defaultResult
      : { type: "fraction", fraction: parseFloat(seekFraction) };
  }
  return defaultResult;
}

export function getSeekTimeFromSpec(spec: SeekToTimeSpec, start: Time, end: Time): Time {
  const rawSpecTime =
    spec.type === "absolute"
      ? spec.time
      : spec.type === "relative"
      ? TimeUtil.add(
          TimeUtil.isLessThan(spec.startOffset, { sec: 0, nsec: 0 }) ? end : start,
          spec.startOffset,
        )
      : interpolateTimes(start, end, spec.fraction);
  return clampTime(rawSpecTime, start, end);
}

export function getTimestampForMessage(
  message: Message,
  timestampMethod?: TimestampMethod,
): Time | undefined {
  if (timestampMethod === "headerStamp") {
    if (
      message.message.header?.stamp?.sec != undefined &&
      message.message.header?.stamp?.nsec != undefined
    ) {
      return message.message.header.stamp;
    }
    return undefined;
  }
  return message.receiveTime;
}

export const compareBinaryTimes = (a: BinaryTime, b: BinaryTime) => {
  return a.sec() - b.sec() || a.nsec() - b.nsec();
};

// Descriptive -- not a real type
type MaybeStampedBobject = Readonly<{
  header?: () => Readonly<{ stamp?: () => unknown }>;
}>;

export const maybeGetBobjectHeaderStamp = (message: Bobject | undefined): Time | undefined => {
  if (message == undefined) {
    return undefined;
  }
  const maybeStamped = cast<MaybeStampedBobject>(message);
  const header = maybeStamped.header?.();
  const stamp = header?.stamp && deepParse(header.stamp());
  if (isTime(stamp)) {
    return stamp;
  }
  return undefined;
};

export const getRosTimeFromString = (text: string) => {
  if (!text.length || isNaN(+text)) {
    return;
  }
  const textAsNum = Number(text);
  return { sec: Math.floor(textAsNum), nsec: textAsNum * 1e9 - Math.floor(textAsNum) * 1e9 };
};

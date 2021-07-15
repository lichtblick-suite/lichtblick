// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";

const DIGITS_WITHOUT_DECIMAL_POINT_RE = /^\d+$/;
const DIGITS_WITH_DECIMAL_POINT_RE = /^(?!\.$)(\d*)\.(\d*)$/;
const THOUSAND_YEARS_IN_NANOSEC = 1000n * 365n * 24n * 60n * 60n * BigInt(1e9);

/**
 * Parses a ROS time (UNIX timestamp) containing a whole or floating point number of seconds. If
 * more than 9 digits of nanoseconds are given, the rest will be truncated.
 *
 * Parsing is lenient: if the numeric value given is too large and contains no decimal point, assume
 * it is ms, µs, ns instead of seconds (or a smaller unit, in powers of 1000).
 */
export default function parseFuzzyRosTime(stamp: string): Time | undefined {
  const trimmedStamp = stamp.trim();
  if (DIGITS_WITHOUT_DECIMAL_POINT_RE.test(trimmedStamp)) {
    // Start by assuming the input is in seconds, and convert to nanoseconds.
    let nanos = BigInt(trimmedStamp) * BigInt(1e9);
    while (nanos > THOUSAND_YEARS_IN_NANOSEC) {
      nanos /= 1000n;
    }
    return { sec: Number(nanos / BigInt(1e9)), nsec: Number(nanos % BigInt(1e9)) };
  }

  const match = DIGITS_WITH_DECIMAL_POINT_RE.exec(trimmedStamp);
  if (match?.[1] != undefined && match[2] != undefined) {
    // There can be at most 9 digits of nanoseconds. Truncate any others.
    return { sec: Number(match[1]), nsec: Number(match[2].substr(0, 9).padEnd(9, "0")) };
  }

  return undefined;
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Time = bigint;
export type Duration = bigint;

export function compareTime(a: Time, b: Time): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function toSec(time: Time): number {
  const sec = Math.trunc(Number(time / BigInt(1e9)));
  const nsec = Number(time % BigInt(1e9));
  return sec + nsec * 1e-9;
}

export function fromSec(value: number): Time {
  let sec = Math.trunc(value);
  let nsec = Math.round((value - sec) * 1e9);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return BigInt(sec) * BigInt(1e9) + BigInt(nsec);
}

export function percentOf(start: Time, end: Time, target: Time): number {
  const totalDuration = end - start;
  const targetDuration = target - start;
  return toSec(targetDuration) / toSec(totalDuration);
}

export function interpolate(start: Time, end: Time, fraction: number): Time {
  const duration = end - start;
  return start + fromSec(fraction * toSec(duration));
}

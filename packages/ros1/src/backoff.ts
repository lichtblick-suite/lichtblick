// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Implements truncated exponential backoff with jitter. Each retry, the backoff
// time is increased by 2^retries plus a random amount of jitter. The maximum
// time returned by this method is capped at `maxMs`.
export function backoffTime(
  retries: number,
  maxMs: number = 10000,
  maxJitterMs: number = 1000,
  rng: () => number = Math.random,
): number {
  const randomMs = rng() * maxJitterMs;
  return Math.min(Math.pow(2, retries) + randomMs, maxMs);
}

// Wait for a period of time determined by the truncated exponential backoff
// with jitter algorithm implemented in `backoffTime()`.
export async function backoff(
  retries: number,
  maxMs: number = 10000,
  maxJitterMs: number = 1000,
  rng: () => number = Math.random,
): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, backoffTime(retries, maxMs, maxJitterMs, rng)),
  );
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time, compare } from "@lichtblick/rostime";

// Time conversion constants
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const NANOSECONDS_PER_SECOND = 1_000_000_000;

// Window size constants (in milliseconds)
const DEFAULT_WINDOW_MS = 500;
const MIN_WINDOW_MS = 100;
const MAX_WINDOW_MS = 30 * 1000; // 30 seconds
const WINDOW_CAP_MS = 60 * 1000; // 1 minute

// Adaptive window calculation constants
const DEFAULT_TARGET_MESSAGES = 10;
const DEFAULT_MAX_WINDOWS = 4;
const WINDOW_GROWTH_FACTOR = 5;

/**
 * Subtracts milliseconds from a Time, handling nanosecond overflow correctly.
 */
export function subtractMilliseconds(time: Time, milliseconds: number): Time {
  // Round to ensure we get integer values (milliseconds may be floating point from calculations)
  const nanoseconds = Math.round(milliseconds * NANOSECONDS_PER_MILLISECOND);
  let nsec = time.nsec - nanoseconds;
  let sec = time.sec;

  // Handle nanosecond underflow
  while (nsec < 0) {
    nsec += NANOSECONDS_PER_SECOND;
    sec -= 1;
  }

  // Ensure nsec is an integer (avoid floating point precision issues)
  return { sec, nsec: Math.round(nsec) };
}

/**
 * Converts Time to seconds (decimal).
 */
export function timeToSec(time: Time): number {
  return time.sec + time.nsec / NANOSECONDS_PER_SECOND;
}

/**
 * Calculates an optimal time window size for finding messages based on topic statistics.
 * Returns the window size in milliseconds.
 */
export function calculateOptimalWindowMs(params: {
  numMessages: number;
  firstMessageTime: Time;
  lastMessageTime: Time;
  targetMessagesInWindow?: number;
}): number {
  const {
    numMessages,
    firstMessageTime,
    lastMessageTime,
    targetMessagesInWindow = DEFAULT_TARGET_MESSAGES,
  } = params;

  const totalDurationSec = timeToSec(lastMessageTime) - timeToSec(firstMessageTime);

  if (totalDurationSec <= 0 || numMessages <= 0) {
    return DEFAULT_WINDOW_MS;
  }

  const messagesPerSecond = numMessages / totalDurationSec;

  if (messagesPerSecond === 0) {
    return MAX_WINDOW_MS;
  }

  const estimatedWindowSec = targetMessagesInWindow / messagesPerSecond;

  // Clamp between min and max window sizes
  const windowMs = Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, estimatedWindowSec * 1000));

  return windowMs;
}

/**
 * Creates a sequence of progressively larger time windows for adaptive search.
 */
export function createWindowSizes(
  initialWindowMs: number,
  maxWindows: number = DEFAULT_MAX_WINDOWS,
): number[] {
  const windows: number[] = [initialWindowMs];

  for (let i = 1; i < maxWindows; i++) {
    const nextWindow = initialWindowMs * Math.pow(WINDOW_GROWTH_FACTOR, i);
    windows.push(Math.min(nextWindow, WINDOW_CAP_MS));
  }

  return windows;
}

/**
 * Checks if a time window would reach before a boundary time.
 */
export function wouldReachBoundary(
  currentTime: Time,
  windowMs: number,
  boundaryTime: Time | undefined,
): boolean {
  if (!boundaryTime) {
    return false;
  }

  const windowStart = subtractMilliseconds(currentTime, windowMs);
  return compare(windowStart, boundaryTime) <= 0;
}

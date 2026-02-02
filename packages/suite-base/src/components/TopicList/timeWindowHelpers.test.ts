/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";

import {
  calculateOptimalWindowMs,
  createWindowSizes,
  subtractMilliseconds,
  timeToSec,
  wouldReachBoundary,
} from "./timeWindowHelpers";

describe("timeWindowHelpers", () => {
  describe("subtractMilliseconds", () => {
    it("subtracts milliseconds without underflow", () => {
      const time: Time = { sec: 10, nsec: 500_000_000 };
      const result = subtractMilliseconds(time, 100);

      expect(result).toEqual({ sec: 10, nsec: 400_000_000 });
    });

    it("handles nanosecond underflow", () => {
      const time: Time = { sec: 10, nsec: 50_000_000 };
      const result = subtractMilliseconds(time, 100);

      // 50ms - 100ms = -50ms, which should wrap to previous second
      expect(result).toEqual({ sec: 9, nsec: 950_000_000 });
    });

    it("handles large millisecond subtraction", () => {
      const time: Time = { sec: 100, nsec: 0 };
      const result = subtractMilliseconds(time, 5000); // 5 seconds

      expect(result).toEqual({ sec: 95, nsec: 0 });
    });
  });

  describe("timeToSec", () => {
    it("converts Time to seconds", () => {
      const time: Time = { sec: 10, nsec: 500_000_000 };
      const result = timeToSec(time);

      expect(result).toBe(10.5);
    });

    it("handles zero time", () => {
      const time: Time = { sec: 0, nsec: 0 };
      const result = timeToSec(time);

      expect(result).toBe(0);
    });

    it("handles time with only nanoseconds", () => {
      const time: Time = { sec: 0, nsec: 250_000_000 };
      const result = timeToSec(time);

      expect(result).toBe(0.25);
    });
  });

  describe("calculateOptimalWindowMs", () => {
    it("calculates window for dense topic (100 msg/s)", () => {
      const firstMessageTime: Time = { sec: 0, nsec: 0 };
      const lastMessageTime: Time = { sec: 10, nsec: 0 }; // 10 seconds
      const numMessages = 1000; // 100 msg/s

      const windowMs = calculateOptimalWindowMs({
        numMessages,
        firstMessageTime,
        lastMessageTime,
        targetMessagesInWindow: 10,
      });

      // Expecting ~100ms window (10 messages at 100 msg/s)
      expect(windowMs).toBe(100);
    });

    it("calculates window for sparse topic (1 msg/s)", () => {
      const firstMessageTime: Time = { sec: 0, nsec: 0 };
      const lastMessageTime: Time = { sec: 100, nsec: 0 }; // 100 seconds
      const numMessages = 100; // 1 msg/s

      const windowMs = calculateOptimalWindowMs({
        numMessages,
        firstMessageTime,
        lastMessageTime,
        targetMessagesInWindow: 10,
      });

      // Expecting ~10,000ms window (10 messages at 1 msg/s)
      expect(windowMs).toBe(10000);
    });

    it("clamps minimum to 100ms", () => {
      const firstMessageTime: Time = { sec: 0, nsec: 0 };
      const lastMessageTime: Time = { sec: 1, nsec: 0 };
      const numMessages = 10000; // Very dense topic

      const windowMs = calculateOptimalWindowMs({
        numMessages,
        firstMessageTime,
        lastMessageTime,
        targetMessagesInWindow: 10,
      });

      expect(windowMs).toBe(100); // Clamped to minimum
    });

    it("clamps maximum to 30000ms", () => {
      const firstMessageTime: Time = { sec: 0, nsec: 0 };
      const lastMessageTime: Time = { sec: 1000, nsec: 0 };
      const numMessages = 10; // Very sparse topic

      const windowMs = calculateOptimalWindowMs({
        numMessages,
        firstMessageTime,
        lastMessageTime,
        targetMessagesInWindow: 10,
      });

      expect(windowMs).toBe(30000); // Clamped to maximum
    });

    it("returns default 500ms for zero duration", () => {
      const time: Time = { sec: 10, nsec: 0 };
      const windowMs = calculateOptimalWindowMs({
        numMessages: 100,
        firstMessageTime: time,
        lastMessageTime: time, // Same time
        targetMessagesInWindow: 10,
      });

      expect(windowMs).toBe(500);
    });

    it("returns default 500ms for zero messages", () => {
      const firstMessageTime: Time = { sec: 0, nsec: 0 };
      const lastMessageTime: Time = { sec: 10, nsec: 0 };

      const windowMs = calculateOptimalWindowMs({
        numMessages: 0,
        firstMessageTime,
        lastMessageTime,
        targetMessagesInWindow: 10,
      });

      expect(windowMs).toBe(500);
    });
  });

  describe("createWindowSizes", () => {
    it("creates progressive window sizes", () => {
      const windows = createWindowSizes(100, 4);

      expect(windows).toEqual([
        100, // Initial
        500, // 100 * 5^1
        2500, // 100 * 5^2
        12500, // 100 * 5^3
      ]);
    });

    it("caps windows at 60000ms", () => {
      const windows = createWindowSizes(10000, 5);

      expect(windows).toEqual([
        10000, // Initial
        50000, // 10000 * 5^1
        60000, // Capped (would be 250000)
        60000, // Capped
        60000, // Capped
      ]);
    });

    it("creates default 4 windows", () => {
      const windows = createWindowSizes(500);

      expect(windows).toHaveLength(4);
      expect(windows[0]).toBe(500);
    });
  });

  describe("wouldReachBoundary", () => {
    it("returns false when no boundary", () => {
      const currentTime: Time = { sec: 100, nsec: 0 };

      const result = wouldReachBoundary(currentTime, 1000, undefined);

      expect(result).toBe(false);
    });

    it("returns true when window would reach boundary", () => {
      const currentTime: Time = { sec: 100, nsec: 0 };
      const boundaryTime: Time = { sec: 99, nsec: 600_000_000 }; // 99.6 seconds

      // Window of 500ms would go to 99.5s, which is before boundary at 99.6s
      const result = wouldReachBoundary(currentTime, 500, boundaryTime);

      expect(result).toBe(true);
    });

    it("returns false when window would not reach boundary", () => {
      const currentTime: Time = { sec: 100, nsec: 0 };
      const boundaryTime: Time = { sec: 99, nsec: 0 }; // 99 seconds

      // Window of 500ms would go to 99.5s, which is after boundary at 99s
      const result = wouldReachBoundary(currentTime, 500, boundaryTime);

      expect(result).toBe(false);
    });

    it("returns true when window exactly reaches boundary", () => {
      const currentTime: Time = { sec: 100, nsec: 0 };
      const boundaryTime: Time = { sec: 99, nsec: 500_000_000 }; // 99.5 seconds

      // Window of 500ms would go to 99.5s, exactly at boundary
      const result = wouldReachBoundary(currentTime, 500, boundaryTime);

      expect(result).toBe(true);
    });
  });
});

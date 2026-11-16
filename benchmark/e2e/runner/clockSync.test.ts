// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { estimateClockOffset, nodeMonotonicNow, syncPageClock, toPageClock } from "./clockSync";

describe("estimateClockOffset", () => {
  it("should take the offset of the round trip with the smallest RTT", () => {
    // Given: page clock 500 ms ahead; the 2nd round trip is the tightest
    const samples = [
      { sentMs: 1000, pageMs: 1900, receivedMs: 1400 }, // rtt 400, page read late (queued)
      { sentMs: 2000, pageMs: 2510, receivedMs: 2020 }, // rtt 20
      { sentMs: 3000, pageMs: 3700, receivedMs: 3100 }, // rtt 100
    ];

    // When
    const offset = estimateClockOffset(samples);

    // Then
    expect(offset).toEqual({ rttMs: 20, offsetMs: 500 });
  });

  it("should be undefined without samples", () => {
    // Given / When / Then
    expect(estimateClockOffset([])).toBeUndefined();
  });
});

describe("toPageClock", () => {
  it("should add the offset to the Node time", () => {
    // Given / When / Then
    expect(toPageClock(10_000, { offsetMs: -2.5 })).toBe(9997.5);
  });
});

describe("syncPageClock", () => {
  it("should take sequential round trips and keep the tightest", async () => {
    // Given: a fake Node clock and a page that is 1000 ms ahead with varying delays
    let now = 0;
    const delays = [300, 10, 80];
    let round = 0;
    const readPageNow = jest.fn(async () => {
      const delayMs = delays[round++]!;
      now += delayMs / 2;
      const pageMs = now + 1000;
      now += delayMs / 2;
      return pageMs;
    });

    // When
    const offset = await syncPageClock({ readPageNow, nodeNow: () => now, rounds: 3 });

    // Then
    expect(readPageNow).toHaveBeenCalledTimes(3);
    expect(offset).toEqual({ rttMs: 10, offsetMs: 1000 });
  });

  it("should reject without rounds", async () => {
    // Given / When
    const sync = syncPageClock({ readPageNow: async () => 0, nodeNow: () => 0, rounds: 0 });

    // Then
    await expect(sync).rejects.toThrow("at least one round");
  });
});

describe("nodeMonotonicNow", () => {
  it("should be epoch-anchored like Date.now()", () => {
    // Given / When
    const now = nodeMonotonicNow();

    // Then
    expect(Math.abs(now - Date.now())).toBeLessThan(1000);
  });
});

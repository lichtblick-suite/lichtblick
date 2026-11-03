// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader } from "@mcap/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  OVERHEAD_FIXTURE_DATA_MARGIN_MS,
  OVERHEAD_FIXTURES_DIR,
  OVERHEAD_STEADY_POLLS,
  OVERHEAD_WARMUP_MS,
  SAMPLE_INTERVAL_MS,
} from "./constants";
import {
  overheadAutoPauseMs,
  overheadFixtureOptions,
  overheadFixtureSet,
  overheadToggleAutoPauseMs,
  overheadToggleFixtureSet,
} from "./overheadFixtures";
import { getScenarioUnderTest } from "./scenariosUnderTest";
import { DEFAULT_MCAP_FIXTURE_OPTIONS } from "../fixtures/constants";
import { generateMcapFixtures } from "../fixtures/generateMcapFixtures";

const NS_PER_MS = 1_000_000n;

/** Last steady poll, ms after the page is ready: warm-up, priming poll, then `polls` slots. */
const STEADY_WINDOW_END_MS = OVERHEAD_WARMUP_MS + OVERHEAD_STEADY_POLLS * SAMPLE_INTERVAL_MS;

describe("overheadAutoPauseMs", () => {
  it("should grow by one interval per steady poll", () => {
    // Given / When / Then: 3 s + polls × 1 s + 2 s
    expect(overheadAutoPauseMs(5)).toBe(10_000);
    expect(overheadAutoPauseMs(20)).toBe(25_000);
  });
});

describe("overheadToggleAutoPauseMs", () => {
  it("should cover the warm-up, every block of every quartet and the margin", () => {
    // Given / When / Then: 10 s + quartets × 4 × block + 2 s
    expect(overheadToggleAutoPauseMs(10, 3000)).toBe(132_000);
    expect(overheadToggleAutoPauseMs(4, 3000)).toBe(60_000);
    expect(overheadToggleAutoPauseMs(4, 1000)).toBe(28_000);
  });

  it("should add the profiled period after the blocks", () => {
    // Given / When / Then: 10 s + 4 × 4 × 3 s + 10 s + 2 s
    expect(overheadToggleAutoPauseMs(4, 3000, 10_000)).toBe(70_000);
  });
});

describe("overheadToggleFixtureSet", () => {
  it("should size the fixtures to the toggle auto-pause plus the data margin", () => {
    // Given / When
    const smoke = overheadToggleFixtureSet(4, 3000);
    const defaults = overheadToggleFixtureSet(10, 3000);

    // Then: 60 s + 5 s and 132 s + 5 s (rounded up), each in its own directory
    expect(smoke.options.durationSec).toBe(65);
    expect(smoke.dir).toBe(path.join(OVERHEAD_FIXTURES_DIR, "65s"));
    expect(smoke.urlPath).toBe("/fixtures/overhead/65s");
    expect(defaults.options.durationSec).toBe(137);
    expect(defaults.urlPath).toBe("/fixtures/overhead/137s");
  });

  it("should span the profiled period too", () => {
    // Given / When
    const profiled = overheadToggleFixtureSet(4, 3000, 10_000);

    // Then: 70 s + 5 s
    expect(profiled.options.durationSec).toBe(75);
  });
});

describe("overheadFixtureSet", () => {
  it("should cache each duration in its own directory, served under the same path", () => {
    // Given / When
    const defaultSet = overheadFixtureSet(OVERHEAD_STEADY_POLLS);
    const longSet = overheadFixtureSet(20);

    // Then: 20 s for 10 polls, 30 s (25 s auto-pause + 5 s) for 20 polls
    expect(defaultSet.options.durationSec).toBe(20);
    expect(defaultSet.dir).toBe(path.join(OVERHEAD_FIXTURES_DIR, "20s"));
    expect(defaultSet.urlPath).toBe("/fixtures/overhead/20s");
    expect(longSet.options.durationSec).toBe(30);
    expect(longSet.dir).toBe(path.join(OVERHEAD_FIXTURES_DIR, "30s"));
    expect(longSet.urlPath).toBe("/fixtures/overhead/30s");
  });
});

describe("overheadFixtureOptions", () => {
  it("should outlast the page auto-pause by the data margin (real constants: 20 s ≥ 15 s + 5 s)", () => {
    // Given
    const autoPauseMs = overheadAutoPauseMs(OVERHEAD_STEADY_POLLS);

    // When
    const { durationSec } = overheadFixtureOptions(OVERHEAD_STEADY_POLLS);

    // Then
    expect(autoPauseMs).toBe(15_000);
    expect(durationSec).toBe(20);
    expect(durationSec! * 1000).toBeGreaterThanOrEqual(
      autoPauseMs + OVERHEAD_FIXTURE_DATA_MARGIN_MS,
    );
  });

  it("should cover the steady window that the scenario fixtures end before", () => {
    // Given
    const scenarioFixtureMs = DEFAULT_MCAP_FIXTURE_OPTIONS.durationSec * 1000;
    const scenario = getScenarioUnderTest("mcap-multi-ingest");

    // When
    const overheadFixtureMs = overheadFixtureOptions(OVERHEAD_STEADY_POLLS).durationSec! * 1000;

    // Then: 10 s of scenario data end inside the 13 s window; the overhead data reach past it
    expect(scenario.usesMcapFixtures).toBe(true);
    expect(STEADY_WINDOW_END_MS).toBe(13_000);
    expect(scenarioFixtureMs).toBeLessThan(STEADY_WINDOW_END_MS);
    expect(overheadFixtureMs).toBeGreaterThanOrEqual(
      STEADY_WINDOW_END_MS + OVERHEAD_FIXTURE_DATA_MARGIN_MS,
    );
  });

  it("should make the generator write data spanning the overhead duration", async () => {
    // Given: the overhead duration at a low rate (fast to write)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-overhead-fixtures-"));
    const options = {
      ...overheadFixtureOptions(OVERHEAD_STEADY_POLLS),
      fileCount: 1,
      rateHz: 10,
      payloadBytes: 8,
    };

    try {
      // When
      const [name] = await generateMcapFixtures(dir, options);
      const bytes = new Uint8Array(fs.readFileSync(path.join(dir, name!)));
      const reader = await McapIndexedReader.Initialize({
        readable: {
          size: async () => BigInt(bytes.byteLength),
          read: async (offset: bigint, length: bigint) =>
            bytes.subarray(Number(offset), Number(offset + length)),
        },
      });

      // Then: 200 messages, first to last 19.9 s (199 periods of 100 ms)
      const { messageStartTime = 0n, messageEndTime = 0n, messageCount } = reader.statistics ?? {};
      expect(messageCount).toBe(200n);
      expect((messageEndTime - messageStartTime) / NS_PER_MS).toBe(19_900n);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

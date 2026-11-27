// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CpuProfileBuilder } from "./builders/CpuProfileBuilder";
import { DIRECT_ATTRIBUTION_TELEMETRY_SOURCES } from "./constants";
import {
  attributeCpuProfile,
  buildDirectAttribution,
  directAttributionVerdict,
  isTelemetrySource,
  sampleDurationsUs,
} from "./directAttribution";

const SINK = "packages/suite-base/src/util/telemetry/BufferedTelemetrySink.ts";
const COLLECTOR = "benchmark/src/telemetry/collectors/FrameCollector.ts";
const PANEL = "packages/suite-base/src/panels/ThreeDeeRender/Renderer.ts";
const TARGET = 0.02;

const { mapped, native, unmapped, unmappedIn, external } = CpuProfileBuilder;

describe("isTelemetrySource", () => {
  it("should match files under a directory prefix and exact helper files only", () => {
    // Given
    const sources = DIRECT_ATTRIBUTION_TELEMETRY_SOURCES;

    // When / Then
    expect(isTelemetrySource(SINK, sources)).toBe(true);
    expect(isTelemetrySource(COLLECTOR, sources)).toBe(true);
    expect(
      isTelemetrySource("packages/suite-base/src/hooks/usePanelLifecycleTelemetry.ts", sources),
    ).toBe(true);
    expect(isTelemetrySource("packages/suite-base/src/hooks/usePanelLifecycle.ts", sources)).toBe(
      false,
    );
    expect(isTelemetrySource("packages/suite-base/src/util/telemetryX.ts", sources)).toBe(false);
    expect(isTelemetrySource(PANEL, sources)).toBe(false);
  });
});

describe("sampleDurationsUs", () => {
  it("should last each sample until the next one and the last until the profile end", () => {
    // Given samples at 0, 100, 350 µs and the end at 400 µs
    const profile = {
      nodes: [{ id: 1, callFrame: native("(root)") }],
      startTime: 1000,
      endTime: 1400,
      samples: [1, 1, 1],
      timeDeltas: [0, 100, 250],
    };

    // When
    const durations = sampleDurationsUs(profile);

    // Then
    expect(durations).toEqual([100, 250, 50]);
  });

  it("should return no durations for a profile without samples", () => {
    // Given
    const profile = { nodes: [], startTime: 0, endTime: 100 };

    // When / Then
    expect(sampleDurationsUs(profile)).toEqual([]);
  });
});

describe("attributeCpuProfile", () => {
  it("should count the outermost telemetry frame once per sample (no double counting)", () => {
    // Given a panel calling the sink, which calls a collector helper (nested telemetry frames)
    const profile = CpuProfileBuilder.profile([
      { stack: [mapped(PANEL, "render"), mapped(SINK, "record", 39)], durationUs: 300 },
      {
        stack: [mapped(PANEL, "render"), mapped(SINK, "record", 39), mapped(COLLECTOR, "now")],
        durationUs: 200,
      },
      { stack: [mapped(PANEL, "render")], durationUs: 500 },
    ]);

    // When
    const attribution = attributeCpuProfile(
      profile,
      CpuProfileBuilder.resolver(),
      DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    );

    // Then: 0.5 ms telemetry, all of it in the sink's `record` (line 40, 1-based)
    expect(attribution.jsMs).toBeCloseTo(1, 9);
    expect(attribution.telemetryMs).toBeCloseTo(0.5, 9);
    expect(attribution.telemetryFunctions).toEqual([
      { source: SINK, line: 40, name: "record", ms: 0.5 },
    ]);
  });

  it("should split idle, program and GC from JS and keep them out of telemetry", () => {
    // Given
    const profile = CpuProfileBuilder.profile([
      { stack: [native("(idle)")], durationUs: 1000 },
      { stack: [native("(program)")], durationUs: 400 },
      { stack: [native("(garbage collector)")], durationUs: 100 },
      { stack: [mapped(COLLECTOR, "onFrame")], durationUs: 50 },
      { stack: [mapped(PANEL, "render")], durationUs: 450 },
    ]);

    // When
    const attribution = attributeCpuProfile(
      profile,
      CpuProfileBuilder.resolver(),
      DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    );

    // Then
    expect(attribution).toMatchObject({
      durationMs: 2,
      samples: 5,
      idleMs: 1,
      programMs: 0.4,
      gcMs: 0.1,
      jsMs: 0.5,
      telemetryMs: 0.05,
      unresolvedMs: 0,
    });
  });

  it("should count JS with an unmapped bundle frame as unresolved unless a telemetry frame is on the stack", () => {
    // Given
    const profile = CpuProfileBuilder.profile([
      { stack: [unmapped(), mapped(PANEL, "render")], durationUs: 200 },
      { stack: [unmapped(), mapped(SINK, "record")], durationUs: 100 },
      { stack: [external(), mapped(PANEL, "render")], durationUs: 300 },
      { stack: [native("JSON.stringify")], durationUs: 400 },
    ]);

    // When
    const attribution = attributeCpuProfile(
      profile,
      CpuProfileBuilder.resolver(),
      DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    );

    // Then: external and native frames are resolved (not telemetry)
    expect(attribution.jsMs).toBeCloseTo(1, 9);
    expect(attribution.unresolvedMs).toBeCloseTo(0.2, 9);
    expect(attribution.telemetryMs).toBeCloseTo(0.1, 9);
  });

  it("should count an unmapped frame as unresolved only when its script's map lists a telemetry source", () => {
    // Given vendor code without mappings in a vendor chunk and in a chunk with a telemetry module
    const vendorChunk = ["node_modules/lodash/lodash.js"];
    const telemetryChunk = ["node_modules/lodash/lodash.js", SINK];
    const profile = CpuProfileBuilder.profile([
      { stack: [mapped(PANEL, "render"), unmappedIn(vendorChunk)], durationUs: 300 },
      { stack: [mapped(PANEL, "render"), unmappedIn(telemetryChunk)], durationUs: 200 },
      { stack: [unmappedIn(vendorChunk), unmapped()], durationUs: 100 },
    ]);

    // When
    const attribution = attributeCpuProfile(
      profile,
      CpuProfileBuilder.resolver(),
      DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    );

    // Then: the vendor chunk cannot hide telemetry, the telemetry chunk and a map-less script can
    expect(attribution.jsMs).toBeCloseTo(0.6, 9);
    expect(attribution.unresolvedMs).toBeCloseTo(0.3, 9);
    expect(attribution.telemetryMs).toBe(0);
  });

  it("should fall back to the profile's function name, then to (anonymous)", () => {
    // Given two telemetry functions without an original name, one of them anonymous
    const profile = CpuProfileBuilder.profile([
      { stack: [mapped(SINK, "flush", 9)], durationUs: 100 },
      { stack: [mapped(COLLECTOR, "", 4)], durationUs: 300 },
    ]);

    // When
    const attribution = attributeCpuProfile(
      profile,
      CpuProfileBuilder.resolver(),
      DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    );

    // Then: sorted by time, descending
    expect(attribution.telemetryFunctions.map(({ name, line }) => `${name}:${line}`)).toEqual([
      "(anonymous):5",
      "flush:10",
    ]);
  });
});

describe("directAttributionVerdict", () => {
  it.each([
    { relative: 0.03, upper: 0.05, expected: "exceeds" },
    { relative: 0.005, upper: 0.01, expected: "within" },
    { relative: 0.02, upper: 0.02, expected: "within" },
    { relative: 0.01, upper: 0.03, expected: "inconclusive" },
    { relative: undefined, upper: undefined, expected: "inconclusive" },
  ])("should give $expected for relative $relative with upper bound $upper", ({
    relative,
    upper,
    expected,
  }) => {
    // Given / When
    const verdict = directAttributionVerdict(relative, upper, TARGET);

    // Then
    expect(verdict).toBe(expected);
  });
});

describe("buildDirectAttribution", () => {
  it("should report ms per second relative to the off-block CPU", () => {
    // Given 2 s profiled: 1 s JS of which 20 ms telemetry and 10 ms unresolved, 100 ms GC, 30 % off
    const profile = CpuProfileBuilder.profile([
      { stack: [mapped(SINK, "record")], durationUs: 20_000 },
      { stack: [unmapped()], durationUs: 10_000 },
      { stack: [mapped(PANEL, "render")], durationUs: 970_000 },
      { stack: [native("(garbage collector)")], durationUs: 100_000 },
      { stack: [native("(idle)")], durationUs: 900_000 },
    ]);

    // When
    const section = buildDirectAttribution({
      capture: { status: "captured", profile },
      resolve: CpuProfileBuilder.resolver(),
      config: CpuProfileBuilder.config(),
      offCpuPercent: 30,
      target: TARGET,
    });

    // Then: 10 ms/s telemetry ÷ 300 ms/s ≈ 3.3 % > 2 % → exceeds
    if (section.status !== "measured") {
      throw new Error("expected a measured section");
    }
    expect(section.durationMs).toBe(2000);
    expect(section.jsMsPerSec).toBeCloseTo(500, 9);
    expect(section.telemetryMsPerSec).toBeCloseTo(10, 9);
    expect(section.unresolvedMsPerSec).toBeCloseTo(5, 9);
    expect(section.resolvedShare).toBeCloseTo(0.99, 9);
    expect(section.gcMsPerSec).toBeCloseTo(50, 9);
    expect(section.gcShare).toBeCloseTo(50 / 550, 9);
    expect(section.offCpuMsPerSec).toBe(300);
    expect(section.relative).toBeCloseTo(10 / 300, 9);
    expect(section.relativeUpperBound).toBeCloseTo(15 / 300, 9);
    expect(section.topFunctions).toEqual([
      { source: SINK, line: 1, name: "record", msPerSec: expect.closeTo(10, 9) },
    ]);
    expect(section.verdict).toBe("exceeds");
  });

  it("should keep only the top telemetry functions", () => {
    // Given 7 telemetry functions
    const profile = CpuProfileBuilder.profile(
      Array.from({ length: 7 }, (_, index) => ({
        stack: [mapped(SINK, `fn${index}`, index)],
        durationUs: 100 * (index + 1),
      })),
    );

    // When
    const section = buildDirectAttribution({
      capture: { status: "captured", profile },
      resolve: CpuProfileBuilder.resolver(),
      config: CpuProfileBuilder.config(),
      offCpuPercent: 30,
      target: TARGET,
    });

    // Then
    expect(section.status === "measured" && section.topFunctions.map((fn) => fn.name)).toEqual([
      "fn6",
      "fn5",
      "fn4",
      "fn3",
      "fn2",
    ]);
  });

  it("should be inconclusive without an off-block baseline", () => {
    // Given
    const profile = CpuProfileBuilder.profile([
      { stack: [mapped(PANEL, "render")], durationUs: 1000 },
    ]);

    // When
    const section = buildDirectAttribution({
      capture: { status: "captured", profile },
      resolve: CpuProfileBuilder.resolver(),
      config: CpuProfileBuilder.config(),
      offCpuPercent: undefined,
      target: TARGET,
    });

    // Then
    expect(section).toMatchObject({ status: "measured", verdict: "inconclusive" });
    expect(section).not.toHaveProperty("relative");
    expect(section).not.toHaveProperty("offCpuMsPerSec");
  });

  it("should record an unsupported profiler with its reason and no verdict", () => {
    // Given
    const config = CpuProfileBuilder.config({ profileMs: 5000 });

    // When
    const section = buildDirectAttribution({
      capture: { status: "unsupported", reason: "No CDP session" },
      resolve: CpuProfileBuilder.resolver(),
      config,
      offCpuPercent: 30,
      target: TARGET,
    });

    // Then
    expect(section).toEqual({ status: "unsupported", config, reason: "No CDP session" });
  });
});

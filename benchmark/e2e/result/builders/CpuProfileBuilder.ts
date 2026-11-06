// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DIRECT_ATTRIBUTION_TELEMETRY_SOURCES } from "../constants";
import type {
  CpuProfile,
  CpuProfileCallFrame,
  CpuProfileNode,
  DirectAttributionConfigV3,
  DirectAttributionV3,
  FrameResolver,
} from "../directAttribution.types";

/** URL prefix of a fake frame that `CpuProfileBuilder.resolver` maps to the source after it. */
const MAPPED_URL = "src:";
/** URL prefix of a fake bundle frame without a mapping. */
const UNMAPPED_URL = "unmapped:";
/** URL prefix of a fake unmapped frame of a script whose map lists the sources after it (`,`). */
const UNMAPPED_IN_URL = "unmapped-in:";

/** One sample of `CpuProfileBuilder.profile`: its stack (outermost first) and duration. */
export type ProfileSample = { stack: CpuProfileCallFrame[]; durationUs: number };

/** Deterministic CDP profiles, a fake frame resolver and direct attribution sections. */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CpuProfileBuilder {
  /** A frame of original `source` (resolved by `resolver`), 0-based function start `line`. */
  public static mapped(source: string, functionName: string, line = 0): CpuProfileCallFrame {
    return { functionName, url: `${MAPPED_URL}${source}`, lineNumber: line, columnNumber: 0 };
  }

  /** A bundle frame that `resolver` cannot map. */
  public static unmapped(functionName = "a"): CpuProfileCallFrame {
    return { functionName, url: `${UNMAPPED_URL}main.js`, lineNumber: 0, columnNumber: 0 };
  }

  /**
   * A bundle frame without a mapping in a script whose source map lists `scriptSources`
   * (e.g. vendor code: `["node_modules/lodash/lodash.js"]`).
   */
  public static unmappedIn(
    scriptSources: readonly string[],
    functionName = "a",
  ): CpuProfileCallFrame {
    return {
      functionName,
      url: `${UNMAPPED_IN_URL}${scriptSources.join(",")}`,
      lineNumber: 0,
      columnNumber: 0,
    };
  }

  /** A frame of a script outside the bundle (e.g. a Playwright evaluation script). */
  public static external(functionName = "evaluate"): CpuProfileCallFrame {
    return { functionName, url: "about:playwright", lineNumber: 0, columnNumber: 0 };
  }

  /** A V8 pseudo frame or native function (`(idle)`, `(program)`, `(garbage collector)`, …). */
  public static native(functionName: string): CpuProfileCallFrame {
    return { functionName, url: "", lineNumber: -1, columnNumber: -1 };
  }

  /**
   * Fake resolver: `src:<source>` → mapped (`line` = `lineNumber + 1`, no original name),
   * `unmapped:` → unmapped, `unmapped-in:<sources>` → unmapped with those script sources, anything
   * else → external.
   */
  public static resolver(): FrameResolver {
    return (frame) => {
      if (frame.url.startsWith(MAPPED_URL)) {
        return {
          kind: "mapped",
          source: frame.url.slice(MAPPED_URL.length),
          line: frame.lineNumber + 1,
        };
      }
      if (frame.url.startsWith(UNMAPPED_IN_URL)) {
        return {
          kind: "unmapped",
          scriptSources: frame.url.slice(UNMAPPED_IN_URL.length).split(","),
        };
      }
      return frame.url.startsWith(UNMAPPED_URL) ? { kind: "unmapped" } : { kind: "external" };
    };
  }

  /**
   * A profile of `samples` in order, starting at `startTime` µs: one node per distinct stack
   * prefix under a `(root)` node, `timeDeltas` such that each sample lasts its `durationUs` (the
   * last one up to `endTime`).
   */
  public static profile(samples: readonly ProfileSample[], startTime = 1_000_000): CpuProfile {
    const root: CpuProfileNode = { id: 1, callFrame: CpuProfileBuilder.native("(root)") };
    const nodes: CpuProfileNode[] = [root];
    const byPath = new Map<string, CpuProfileNode>();
    const nodeOf = (stack: readonly CpuProfileCallFrame[]): CpuProfileNode => {
      let parent = root;
      let key = "";
      for (const frame of stack) {
        key += `>${frame.url}|${frame.functionName}|${frame.lineNumber}`;
        let node = byPath.get(key);
        if (node == undefined) {
          node = { id: nodes.length + 1, callFrame: frame };
          nodes.push(node);
          byPath.set(key, node);
          parent.children = [...(parent.children ?? []), node.id];
        }
        parent = node;
      }
      return parent;
    };
    const sampleIds = samples.map(({ stack }) => nodeOf(stack).id);
    // Sample i starts at the sum of the previous durations.
    const timeDeltas = samples.map((_, index) =>
      index === 0 ? 0 : samples[index - 1]!.durationUs,
    );
    const totalUs = samples.reduce((sum, { durationUs }) => sum + durationUs, 0);
    return {
      nodes,
      startTime,
      endTime: startTime + totalUs,
      samples: sampleIds,
      timeDeltas,
    };
  }

  public static config(
    overrides: Partial<DirectAttributionConfigV3> = {},
  ): DirectAttributionConfigV3 {
    return {
      profileMs: 10_000,
      samplingIntervalUs: 100,
      telemetrySources: DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
      ...overrides,
    };
  }

  /** A measured section: 0.2 ms/s of telemetry out of 300 ms/s CPU (within). */
  public static measured(
    overrides: Partial<Extract<DirectAttributionV3, { status: "measured" }>> = {},
  ): DirectAttributionV3 {
    return {
      status: "measured",
      config: CpuProfileBuilder.config(),
      durationMs: 10_000,
      samples: 50_000,
      jsMsPerSec: 120,
      telemetryMsPerSec: 0.2,
      unresolvedMsPerSec: 0.1,
      resolvedShare: 0.999,
      gcMsPerSec: 6,
      gcShare: 0.05,
      offCpuPercent: 30,
      offCpuMsPerSec: 300,
      relative: 0.2 / 300,
      relativeUpperBound: 0.3 / 300,
      topFunctions: [
        {
          source: "packages/suite-base/src/util/telemetry/BufferedTelemetrySink.ts",
          line: 40,
          name: "record",
          msPerSec: 0.15,
        },
        {
          source: "benchmark/src/telemetry/collectors/FrameCollector.ts",
          line: 12,
          name: "onFrame",
          msPerSec: 0.05,
        },
      ],
      verdict: "within",
      ...overrides,
    };
  }

  public static unsupported(reason = "No CDP session for the page"): DirectAttributionV3 {
    return { status: "unsupported", config: CpuProfileBuilder.config(), reason };
  }
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryRecordBuilder } from "./builders/TelemetryRecordBuilder";
import { PIPELINE_METRICS } from "./constants";
import { pipelineRateWindow, summarizePipeline } from "./pipelineSummary";

const WINDOW = { startTs: 1000, endTs: 5500 };
const SOURCE = { sourceId: "src" };

const counter = TelemetryRecordBuilder.counterSeries;
const gauge = TelemetryRecordBuilder.gaugeSeries;

describe("summarizePipeline", () => {
  it("should summarize totals, window rates, fanout, peaks, cache ratios and memory peaks", () => {
    // Given a run whose renderer publishes every second from 1500 to 5500 (window end 5500), with
    // a last counter publish during teardown (6500), plus two worker realms
    const samples = [
      ...counter(PIPELINE_METRICS.messagesReceived, [
        [1500, 100],
        [2500, 300],
        [3500, 500],
        [4500, 700],
        [6500, 750],
      ]),
      ...counter(PIPELINE_METRICS.messagesReceivedBytes, [
        [1500, 1000],
        [2500, 3000],
        [3500, 5000],
        [4500, 7000],
        [6500, 7500],
      ]),
      ...counter(PIPELINE_METRICS.messagesDelivered, [[6500, 1500]]),
      ...gauge(PIPELINE_METRICS.subscribersCount, [
        [1500, 1],
        [2500, 2],
        [3500, 2],
        [4500, 3],
        [5500, 3],
      ]),
      ...gauge(PIPELINE_METRICS.subscriptionsCount, [
        [1500, 2],
        [5500, 4],
      ]),
      ...TelemetryRecordBuilder.observationSeries(PIPELINE_METRICS.listenerDispatchDurationMs, [
        [1500, 100, 200, 2],
        [2500, 100, 300, 6],
        [3500, 100, 100, 4],
      ]),
      ...gauge(PIPELINE_METRICS.blockCacheBytes, [
        [1500, 10],
        [2500, 50],
        [3500, 30],
      ]),
      ...gauge(PIPELINE_METRICS.blockCacheMaxBytes, [
        [1500, 100],
        [2500, 100],
      ]),
      ...counter(PIPELINE_METRICS.blockCacheEvictions, [
        [2500, 1],
        [4500, 3],
      ]),
      ...counter(PIPELINE_METRICS.sourceCacheHits, [[2500, 30]]),
      ...counter(PIPELINE_METRICS.sourceCacheMisses, [[1500, 10]]),
      ...gauge(PIPELINE_METRICS.sourceCacheBytes, [
        [1500, 64],
        [2500, 128],
      ]),
      ...counter(PIPELINE_METRICS.remoteReadRequests, [[1500, 4]], { realm: "worker:1" }),
      ...counter(PIPELINE_METRICS.remoteReadRequests, [[1600, 6]], { realm: "worker:2" }),
      ...counter(PIPELINE_METRICS.remoteBytesRead, [[1500, 4096]], { realm: "worker:1" }),
      ...gauge(
        PIPELINE_METRICS.sourcesTotal,
        [
          [1500, 3],
          [2500, 3],
        ],
        { realm: "worker:1" },
      ),
      ...gauge(
        PIPELINE_METRICS.sourcesRelevant,
        [
          [1500, 1],
          [2500, 2],
        ],
        { realm: "worker:1" },
      ),
      ...gauge(
        "pipeline.memory.bufferedMessages",
        [
          [1500, 5],
          [2500, 20],
          [3500, 10],
        ],
        { labels: SOURCE },
      ),
      ...gauge("pipeline.memory.preloadedMessages", [[1500, 100]], { labels: SOURCE }),
    ];

    // When
    const pipeline = summarizePipeline(samples, WINDOW);

    // Then totals cover the whole run, rates the window snapped to the last publish (1000 → 5500)
    expect(pipeline).toEqual({
      messagesReceived: 750,
      bytesReceived: 7500,
      rateWindowMs: 4500,
      messagesPerSec: expect.closeTo(700 / 4.5, 6),
      bytesPerSec: expect.closeTo(7000 / 4.5, 6),
      deliveredFanout: 2,
      subscribersMax: 3,
      subscriptionsMax: 4,
      // Σsum / Σcount = 600 / 300; window maxima 2, 6, 4
      listenerDispatchMeanMs: 2,
      listenerDispatchMaxMs: 6,
      listenerDispatchP90WindowMaxMs: 6,
      blockCachePeakBytes: 50,
      blockCacheMaxBytes: 100,
      blockCacheEvictions: 3,
      sourceCacheHits: 30,
      sourceCacheMisses: 10,
      sourceCacheHitRatio: 0.75,
      sourceCachePeakBytes: 128,
      remoteReadRequests: 10,
      remoteBytesRead: 4096,
      sourcesTotal: 3,
      sourcesRelevant: 2,
      memoryPeakBytes: { "bufferedMessages/src": 20, "preloadedMessages/src": 100 },
    });
  });

  it("should omit fields without data and return undefined without pipeline telemetry", () => {
    // Given a run with only received messages (no deliveries, caches, remote or memory data)
    const samples = counter(PIPELINE_METRICS.messagesReceived, [
      [2000, 10],
      [3000, 20],
    ]);

    // When
    const pipeline = summarizePipeline(samples, WINDOW);

    // Then
    expect(pipeline).toEqual({
      messagesReceived: 20,
      rateWindowMs: 2000,
      messagesPerSec: 10,
    });
    expect(summarizePipeline([], WINDOW)).toBeUndefined();
    expect(
      summarizePipeline(
        [TelemetryRecordBuilder.sample({ metric: "renderer.fps", value: 60 })],
        WINDOW,
      ),
    ).toBeUndefined();
  });

  it("should omit the fanout and the hit ratio when there is nothing to divide by", () => {
    // Given counters published with zero totals
    const samples = [
      ...counter(PIPELINE_METRICS.messagesReceived, [[2000, 0]]),
      ...counter(PIPELINE_METRICS.messagesDelivered, [[2000, 0]]),
      ...counter(PIPELINE_METRICS.sourceCacheHits, [[2000, 0]]),
      ...counter(PIPELINE_METRICS.sourceCacheMisses, [[2000, 0]]),
    ];

    // When
    const pipeline = summarizePipeline(samples, WINDOW);

    // Then
    expect(pipeline?.deliveredFanout).toBeUndefined();
    expect(pipeline?.sourceCacheHitRatio).toBeUndefined();
    expect(pipeline).toMatchObject({ messagesReceived: 0, sourceCacheHits: 0, messagesPerSec: 0 });
  });

  it("should omit rates when no publish of the producing realm falls into the window", () => {
    // Given received counters published only after the window
    const samples = counter(PIPELINE_METRICS.messagesReceived, [[6000, 10]]);

    // When
    const pipeline = summarizePipeline(samples, WINDOW);

    // Then
    expect(pipeline).toEqual({ messagesReceived: 10 });
  });
});

describe("pipelineRateWindow", () => {
  it("should snap both window edges to the publish grid of the producing realms", () => {
    // Given renderer publishes before and inside the window, worker publishes elsewhere
    const received = counter(PIPELINE_METRICS.messagesReceived, [[900, 1]]);
    const all = [
      ...received,
      ...gauge(PIPELINE_METRICS.subscribersCount, [
        [1900, 1],
        [2900, 1],
      ]),
      ...gauge(PIPELINE_METRICS.sourcesTotal, [[5400, 1]], { realm: "worker:1" }),
    ];

    // When
    const snapped = pipelineRateWindow(received, all, WINDOW);

    // Then the worker publish at 5400 is not part of the renderer grid
    expect(snapped).toEqual({ startTs: 900, endTs: 2900 });
  });
});

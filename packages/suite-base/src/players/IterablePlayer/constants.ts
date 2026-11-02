// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Tolerance when summing preloaded fraction ranges (block boundaries are float divisions).
export const FULLY_PRELOADED_EPSILON = 1e-9;

// Cadence at which worker telemetry is pulled into the main-thread sink (matches the sink's
// default 1 Hz publish cadence).
export const TELEMETRY_DRAIN_INTERVAL_MS = 1000;

// Telemetry: prefix of the `pipeline.memory.<lowerCamelCaseKey>` gauges derived from
// `progress.memoryInfo` keys (see memoryMetricName).
export const MEMORY_METRIC_PREFIX = "pipeline.memory.";

// Telemetry (scope "pipeline", no labels: the BlockLoader has no stable id of its own).
export const BLOCK_CACHE_METRICS = {
  /** gauge (bytes): preloaded bytes, emitted with every progress report */
  bytes: "pipeline.blockCache.bytes",
  /** gauge (bytes): configured cache budget, emitted with every progress report */
  maxBytes: "pipeline.blockCache.maxBytes",
  /** gauge (ratio 0..1): share of blocks fully loaded for the current topics */
  loadedFraction: "pipeline.blockCache.loadedFraction",
  /** counter (count): blocks trimmed by an over-budget eviction pass */
  evictions: "pipeline.blockCache.evictions",
} as const;

// Telemetry for CachingIterableSource (scope "pipeline", no labels: the cache has no
// stable id of its own).
//
// - hits / misses count block lookups in messageIterator(), never messages: each time the read
//   head is resolved either to a cached block (hit, served from memory) or to a gap that must be
//   read from the underlying source (miss).
// - evictions counts blocks evicted to stay within the total size budget.
// - bytes is gauged on cache changes: block finalized (size cap or end of a source read), eviction,
//   topic-change purge and terminate. While a block is being filled it is not re-gauged per
//   message; the per-tick value is exported by IterablePlayer as `pipeline.memory.bufferedMessages`.
export const SOURCE_CACHE_METRICS = {
  bytes: "pipeline.sourceCache.bytes",
  hits: "pipeline.sourceCache.hits",
  misses: "pipeline.sourceCache.misses",
  evictions: "pipeline.sourceCache.evictions",
} as const;

# Lichtblick Benchmarking

The `benchmark/` package is a standalone build of Lichtblick (web and Electron) used to measure
performance and memory under repeatable scenarios:

- **The benchmark app** (`benchmark/src`, `benchmark/desktop`): Lichtblick plus synthetic data sources,
  scenario bootstrapping (`?scenario=<id>`) and an in-page telemetry API (`window.lichtblickTelemetry`).

Telemetry exists **only in the benchmark build**. The product app keeps its no-op telemetry sink.

## Quick start

```sh
# Manual (old way): open a benchmark URL from benchmarks.txt and read the developer console
yarn benchmark:serve                                   # dev build on http://localhost:8080
yarn benchmark:build:prod && npx serve -p 8080 benchmark/.webpack
```

## Scenarios

`?scenario=<id>` selects a layout and a data source and starts playback automatically
(`benchmark/src/scenarios/registry.ts`).

| Scenario              | Pipeline  | Notes                                                                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `sinewave`            | synthetic | Plot of synthetic sine waves                                                                                                       |
| `pointcloud`          | synthetic | Multiple 3D panels with point clouds                                                                                               |
| `transform`           | synthetic | Multiple 3D panels with transforms                                                                                                 |
| `transformpreloading` | synthetic | Transform preloading                                                                                                               |
| `mcap-ingest`         | real      | Remote NuScenes file (network-dependent, large)                                                                                      |

Real-pipeline scenarios receive their inputs through `?ds.<param>=<value>` overrides. Example:
`?scenario=mcap-ingest&ds.url=<url>` (a repeated `ds.url` is joined with `,`).

A scenario with `durationMs` pauses itself at that deadline. While a scenario is active, the page
also exposes `window.lichtblickScenario.closeDataSource()`. It closes the player without leaving
the page, so the `datasource.close` events and the final pool counters can still be drained.

## Telemetry contract

Types: `packages/suite-base/src/util/telemetry/types.ts`. Page API:
`benchmark/src/telemetry/types.ts`.

```ts
window.lichtblickTelemetry: {
  isEnabled(): boolean;          // false with ?telemetry=off (the API is still present)
  now(): number;                 // monotonic page clock (see below)
  drain(maxRecords?): TelemetryBatch; // { realm, records, dropped }
}

TelemetrySample = { kind: "sample", realm, sequence, monotonicTs, metric, value, unit, scope,
                    metricType: "gauge" | "counter", delta?, labels? }
TelemetryEvent  = { kind: "event", realm, sequence, monotonicTs, name, phase: "start"|"end"|"instant",
                    scope, labels? }
```

- **Clock.** `monotonicTs` is `performance.timeOrigin + performance.now()` in ms. It is monotonic
  within a realm and comparable across realms (main thread and workers) on the same machine. Wall
  time is never used in records. The runner timestamps host samples with the page's `now()`, so
  every series in a result shares the renderer timeline.
- **Realms and sequence.** Each sink stamps a per-realm `sequence`, starting at 0. The main
  thread is `renderer`. Worker sinks are bridged into the renderer sink as `worker:<n>`. The
  runner's own samples use the realm `runner`. Missing sequence numbers show up as
  `sequenceGaps[realm]` in the result (loss and reorder detection).
- **Counters vs gauges.** Gauges carry the current value (last value wins). Counters carry the
  cumulative `value` plus `delta` since the previous publish. Each sink publishes its series every
  1 s. A counter whose delta is 0 is skipped after its first publish, but the next published
  `value` still covers the whole history.
- **Observations (histogram-lite).** Use `observe(metric, value, unit, scope, labels?)` for
  per-occurrence values such as durations, where a gauge would keep only the last value of each
  second. The sink aggregates `count`, `sum` and `max` per series over each publish window. If the
  window has at least one observation, the publish emits three plain samples with the same labels
  and scope, then resets the window:
  - `<metric>.count`: counter, unit `count`, cumulative `value`, `delta` = observations in the
    window;
  - `<metric>.sum`: counter, the metric's unit, cumulative `value`, `delta` = sum of the window;
  - `<metric>.max`: gauge, the metric's unit, max within the window.

  Empty windows emit nothing. The window mean is `sum.delta / count.delta`. Values must be finite
  and `>= 0`; anything else is rejected as `invalidValue`. Label rules and the series cap apply to
  `<metric>` as for gauges and counters. A pending window is flushed when the sink is disposed.

- **Bounded cardinality.** Allowed label keys: `sourceId, poolId, panelId, panelType, processType,
pid, platform, scenarioId, realm, reason, iteratorId`. There are at most 64 series per metric.
  Records that break these rules are rejected and counted in `telemetry.rejectedRecords{reason}`.
- **Buffer and drops.** Each sink is a ring buffer with 8192 records. On overflow the oldest
  records are dropped and counted in `telemetry.droppedRecords{realm}` and in
  `TelemetryBatch.dropped`. These counts end up in the result's `dropped`.
- **Activation.** Telemetry is installed only by the benchmark app. `?telemetry=off` disables it
  (telemetry-off runs). The legacy frame-time hook
  (`window.recordFrameTimes`) works with telemetry on or off.

### What is collected

| Layer                    | Source                                                                                                                                                                                                                                         | Metrics / events                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer (main thread)   | benchmark renderer collectors, 1 Hz                                                                                                                                                                                                            | `renderer.jsHeap.{usedBytes,totalBytes,limitBytes}`, `renderer.fps`, `renderer.lateFrames`, `renderer.longTasks.{count,durationMs}`, `renderer.uaSpecificMemory.bytes` (cross-origin isolated only, at most every 10 s)                                                             |
| Frame / message dispatch | legacy `window.recordFrameTimes`                                                                                                                                                                                                               | `listenerDispatchDurationMs` (gauge, realm/scope `renderer`)                                                                                                                                                                                                                        |
| Cross-realm              | worker sinks bridged into the renderer                                                                                                                                                                                                         | everything a worker records, realm `worker:<n>`; `telemetry.*` self-metrics per realm                                                                                                                                                                                               |
| Pipeline / pool          | `HydratedSourcePool` (worker), label `{poolId}`                                                                                                                                                                                                | prefix `pipeline.hydratedSourcePool.`. Gauges: `residentCount, residentBytes, pinnedEntries, activePins, overBudget, highWater*`. Counters: `acquires, releases, terminatedPins, opens, rehydrations, admits, closes, evictions, failures, overBudgetPeriods, overBudgetDurationMs` |
| Phase events             | app and player                                                                                                                                                                                                                                 | `app.ready`, `datasource.open` (start/end), `datasource.firstMessage`, `frame.firstUseful`, `preload` (start/end), `playback` (start/end), `seek.requested`, `datasource.close` (start/end)                                                                                         |

Caveats:

- **`performance.memory` (`renderer.jsHeap.*`) covers only the JS heap of the current realm.** It
  is never total memory. It excludes workers, DOM, GPU and native allocations. Without
  `--enable-precise-memory-info`, Chromium quantizes the values, and Electron reports a constant
  31.2 MB.

#### Panels and pipeline

| Layer                       | Source                                                                                                                                                             | Metrics / events                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panels                      | `Panel` (all panels), `PanelExtensionAdapter`, MessagePipeline subscribers; labels `{panelId, panelType}` (`panelId` = layout id, e.g. `Plot!3x9a`), scope `panel` | Events: `panel.mount`, `panel.unmount`, `panel.firstRender` (adapter panels only); `layout.applied` (scope `app`). Counters: `panel.messages.{delivered,deliveredBytes}`, `panel.rangeMessages.{delivered,deliveredBytes}`, `panel.render.{count,skipped}`. Observation: `panel.render.durationMs` (→ `.count`/`.sum`/`.max`)                                     |
| Pipeline (MessagePipeline)  | `MessagePipeline` (renderer), scope `pipeline`                                                                                                                     | Counters: `pipeline.messages.{received,receivedBytes,delivered,deliveredBytes}`. Gauges: `pipeline.subscribers.count`, `pipeline.subscriptions.count`. Observation: `pipeline.listenerDispatchDurationMs` (→ `.count`/`.sum`/`.max`)                                                                                                                              |
| Pipeline (player / sources) | `BlockLoader`, `MultiIterableSource`, `CachingIterableSource`, `RemoteFileReadable`, `IterablePlayer`; scope `pipeline`                                            | Gauges: `pipeline.blockCache.{bytes,maxBytes,loadedFraction}`, `pipeline.sources.{total,relevant}`, `pipeline.sourceCache.bytes`, `pipeline.memory.<key>` (bytes, label `{sourceId}`, one per `progress.memoryInfo` entry). Counters: `pipeline.blockCache.evictions`, `pipeline.sourceCache.{hits,misses,evictions}`, `pipeline.remote.{readRequests,bytesRead}` |

What the panel counters mean:

- `panel.messages.delivered[Bytes]`: for **built-in panels** (PanelAPI hooks), the messages the
  MessagePipeline buckets for the panel on each tick, summed across the panel's subscribers,
  whether or not the panel rendered them. For **extension-API panels** (`PanelExtensionAdapter`),
  only the messages of rendered frames; skipped frames are excluded (counted in
  `panel.render.skipped` instead).
- `panel.rangeMessages.delivered[Bytes]`: preloaded (range) deliveries, i.e. the
  `useSubscribeMessageRange` batches plus the new tail of `renderState.allFrames`.
- `panel.render.*` and `panel.firstRender` exist only for extension-API (adapter) panels.

The panel and MessagePipeline names are defined in `PANEL_TELEMETRY_METRICS`
(`packages/suite-base/src/components/PanelExtensionAdapter/constants.ts`) and
`PIPELINE_TELEMETRY_METRICS` (`packages/suite-base/src/components/MessagePipeline/constants.ts`).

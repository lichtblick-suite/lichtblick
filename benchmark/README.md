# Lichtblick Benchmarking

The `benchmark/` package is a standalone build of Lichtblick (web and Electron) used to measure
performance and memory under repeatable scenarios. It has two parts:

- **The benchmark app** (`benchmark/src`, `benchmark/desktop`): Lichtblick plus synthetic data sources,
  scenario bootstrapping (`?scenario=<id>`) and an in-page telemetry API (`window.lichtblickTelemetry`).
- **The benchmark E2E runner** (`benchmark/e2e`): a Playwright suite that drives every scenario on
  **Electron** and **web (headless Chromium)**. It collects host process metrics, in-app telemetry,
  phase events and frame times, and writes JSON artifacts plus a markdown summary.

Telemetry exists **only in the benchmark build**. The product app keeps its no-op telemetry sink.

## Quick start

```sh
# Manual (old way): open a benchmark URL from benchmarks.txt and read the developer console
yarn benchmark:serve                                   # dev build on http://localhost:8080
yarn benchmark:build:prod && npx serve -p 8080 benchmark/.webpack

# Automated: Electron suite
yarn benchmark:desktop:build:prod
yarn test:e2e:benchmark                                # Playwright project "electron"

# Automated: web suite (headless Chromium)
yarn benchmark:build:prod
yarn playwright install chromium                       # once
yarn test:e2e:benchmark:web                            # Playwright project "web"

# Markdown summary of benchmark/.artifacts and benchmark/e2e/reports
yarn test:e2e:benchmark:summary

# Interim offline HTML report: benchmark/.artifacts/report/index.html (see "Viewing results")
yarn test:e2e:benchmark:viewer --open
```

To run a single spec or scenario, use the usual Playwright filters. Examples:
`yarn test:e2e:benchmark:web scenarios -g mcap` and `yarn test:e2e:benchmark overhead`.
CI variants (`test:e2e:benchmark:ci`, `test:e2e:benchmark:web:ci`) set `CI=true` and write
`benchmark/e2e/reports/results-<platform>.json`. They take the same filters; the workflow passes
`scenarios` on push and the chosen spec on manual runs (see [CI](#ci)).

The unit tests for the runner's pure logic (static server, fixture generator, schema builder and
validator, collector parsing, overhead, crash detection, summary, HTML viewer) run under the `benchmark-e2e` Jest project:
`yarn jest --selectProjects benchmark-e2e`.

## Specs: scenarios vs overhead

The suite has two Playwright specs. Both run on Electron and web through the same `runScenario`,
but they answer different questions:

|                                   | `scenarios.benchmark.spec.ts`                                                                          | `overhead.benchmark.spec.ts`                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Question                          | How does Lichtblick perform per scenario (telemetry on)?                                               | What does the benchmark telemetry itself cost (off vs on)? Targets ≤ 2 % CPU, ≤ 20 MiB (`OVERHEAD_TARGETS`)                                                                                      |
| Scenarios                         | All [scenarios under test](#scenarios) (`SCENARIOS_UNDER_TEST`)                                        | `OVERHEAD_SCENARIOS`: `sinewave`, `mcap-multi-ingest`, `pointcloud`                                                                                                                              |
| How it runs                       | One launch per scenario, 1 Hz sampling for 5 s (`mcap-multi-ingest`: 10 s)                             | CPU: toggle quartets in one launch + direct (JS only) profile; memory: relaunch A/B. Optional UA-off (`BENCHMARK_OVERHEAD_UA_ARM`) and FPS-probe (`BENCHMARK_OVERHEAD_FRAME_PROBE_ARM`) variants |
| Output                            | `*.benchmark-result.v1.json` + screenshots → Overview, [Scorecard](#kpi-scorecard), By group, Coverage | `overhead-<platform>-<scenario>-<ts>.json` (schema 3) → [Telemetry overhead](#telemetry-overhead-report-only); its runs (`run.mode: "overhead"`) stay out of KPIs and Runs                       |
| Duration (defaults, one platform) | ≈ 10–15 s per scenario                                                                                 | ≈ 35–40 min (per scenario: ≈ 2.5–3 min toggle + 17 relaunch runs ≈ 8–10 min); `BENCHMARK_OVERHEAD_METHOD=toggle` ≈ 10 min                                                                        |
| When to run                       | Every change; runs in CI on pushes to `develop`/`main`                                                 | When telemetry, its collectors or the overhead runner change; manual only (locally or a manual CI run)                                                                                           |
| Command                           | `yarn test:e2e:benchmark[:web] scenarios`                                                              | `yarn test:e2e:benchmark[:web] overhead`                                                                                                                                                         |

On push, [CI](#ci) runs only the scenarios spec: the workflow passes the `scenarios` filter to the
`:ci` scripts. Run the overhead spec manually with the command above, or as a manual CI run
(`suite: overhead`). It is report only unless
`BENCHMARK_OVERHEAD_GATE=1`; methods, variants and env knobs are in
[Telemetry overhead](#telemetry-overhead-report-only).

## Scenarios

`?scenario=<id>` selects a layout and a data source and starts playback automatically
(`benchmark/src/scenarios/registry.ts`). The runner's list is in
`benchmark/e2e/runner/scenariosUnderTest.ts`.

| Scenario              | Pipeline  | Notes                                                                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `sinewave`            | synthetic | Plot of synthetic sine waves                                                                                                       |
| `pointcloud`          | synthetic | Multiple 3D panels with point clouds                                                                                               |
| `transform`           | synthetic | Multiple 3D panels with transforms                                                                                                 |
| `transformpreloading` | synthetic | Transform preloading                                                                                                               |
| `mcap-multi-ingest`   | real      | Several time-overlapping MCAP files through the real worker pipeline (MultiIterableSource + HydratedSourcePool), `durationMs` 10 s |
| `mcap-ingest`         | real      | Remote NuScenes file; **not run by the suite** (network-dependent, large)                                                          |

Real-pipeline scenarios receive their inputs through `?ds.<param>=<value>` overrides. Examples:
`?scenario=mcap-multi-ingest&ds.url=<url1>,<url2>` (a repeated `ds.url` is joined with `,`).
`mcap-multi-ingest` sets `maxHydratedSources=1`. With several overlapping files, merged iteration
pins more sources than the budget allows, so the pool goes **over budget** and evicts and
re-hydrates sources. This is the scenario that demonstrates the pool telemetry.

A scenario with `durationMs` pauses itself at that deadline. While a scenario is active, the page
also exposes `window.lichtblickScenario.closeDataSource()`. It closes the player without leaving
the page, so the `datasource.close` events and the final pool counters can still be drained.

### What each scenario exercises

Each scenario describes itself (`run.scenario` in the result: description, group, tags, layout,
data source, player, redacted params and declared panels). The pipeline components are **observed**:
they are derived from the telemetry the run emitted (`result/exercised.ts`).

| Scenario              | Group                  | Tags                                                  | Layout panels           | Player                                            | Observed pipeline components                                                                                                                  |
| --------------------- | ---------------------- | ----------------------------------------------------- | ----------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `sinewave`            | `time-series`          | plot, synthetic                                       | Plot ×1                 | SinewavePlayer                                    | MessagePipeline                                                                                                                               |
| `pointcloud`          | `3d-rendering`         | 3d, pointcloud, synthetic                             | 3D ×6                   | PointcloudPlayer                                  | MessagePipeline                                                                                                                               |
| `transform`           | `3d-rendering`         | 3d, tf, synthetic                                     | 3D ×6                   | TransformPlayer                                   | MessagePipeline                                                                                                                               |
| `transformpreloading` | `preloading`           | 3d, raw-messages, tf, preloading, synthetic           | RawMessages ×1, 3D ×1   | TransformPreloadingPlayer                         | MessagePipeline                                                                                                                               |
| `mcap-multi-ingest`   | `real-pipeline-ingest` | real-pipeline, mcap, multi-source, raw-messages, plot | RawMessages ×1, Plot ×1 | IterablePlayer + McapIterableSource (worker)      | MessagePipeline, MultiIterableSource, HydratedSourcePool, BlockLoader, CachingIterableSource, RemoteFileReadable, IterablePlayer (memoryInfo) |
| `mcap-ingest`         | `real-pipeline-ingest` | real-pipeline, mcap                                   | none (`empty`)          | IterablePlayer + McapIterableSource (main thread) | not run by the suite                                                                                                                          |

Only `PanelExtensionAdapter` panels (3D, ...) emit render telemetry. Plot and Raw Messages report
delivered messages only, so a declared panel without any panel telemetry is flagged
"⚠ no telemetry" in the viewer.

### MCAP fixtures (generated, not committed)

`benchmark/e2e/fixtures/generateMcapFixtures.ts` writes the fixtures for `mcap-multi-ingest`
**deterministically at test time** into `benchmark/.artifacts/fixtures/` (gitignored):

- 4 indexed, chunked files (`@mcap/core` `McapWriter`), each covering the **same** 10 s range
- topic `/benchmark/multi`, `jsonschema`/`json` encoding, 200 Hz per file
- each message is `{ value: sin(t·k) + fileIndex, seq, payload: <1 KiB string> }`, about 2.2 MB per file

The generator is idempotent: it skips work when `manifest.json` matches the options hash. Because
no binary fixtures are committed, there are no licensing questions. The data is produced by
MPL-2.0 code in this repository.

The runner serves the fixtures from a local static server at
`http://127.0.0.1:<port>/fixtures/<file>`. Electron loads them cross-origin from its `file://`
page, which is why the server sends CORS and CORP headers.

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
  `TelemetryBatch.dropped`. These counts end up in the result's `dropped`, taking the max
  per realm: a worker realm can be reported both by its own sink and by the renderer's ingest.
- **Activation.** Telemetry is installed only by the benchmark app. `?telemetry=off` disables it,
  which is used as the baseline in the overhead A/B. The legacy frame-time hook
  (`window.recordFrameTimes`) works with telemetry on or off.

### What is collected

| Layer                    | Source                                                                                                                                                                                                                                         | Metrics / events                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host / process           | **Electron**: `app.getAppMetrics()` through `window.lichtblickBenchmark.getMemoryMetrics()`. **Web**: CDP `SystemInfo.getProcessInfo` (process list, CPU time) plus `ps -o pid=,rss=` (RSS). If CDP fails, the browser process tree from `ps` (memory only). | `process.workingSetBytes`, `process.peakWorkingSetBytes`, `process.privateBytes` (Electron on Windows only), `process.cpuPercent` (per-core sum, 100 = one core), labels `{processType: browser\|renderer\|gpu\|utility\|…, pid}`, realm `runner`, scope `process`                  |
| Renderer (main thread)   | benchmark renderer collectors, 1 Hz                                                                                                                                                                                                            | `renderer.jsHeap.{usedBytes,totalBytes,limitBytes}`, `renderer.fps`, `renderer.lateFrames`, `renderer.longTasks.{count,durationMs}`, `renderer.uaSpecificMemory.bytes` (cross-origin isolated only, at most every 10 s)                                                             |
| Frame / message dispatch | legacy `window.recordFrameTimes`                                                                                                                                                                                                               | `listenerDispatchDurationMs` (gauge, realm/scope `renderer`)                                                                                                                                                                                                                        |
| Cross-realm              | worker sinks bridged into the renderer                                                                                                                                                                                                         | everything a worker records, realm `worker:<n>`; `telemetry.*` self-metrics per realm                                                                                                                                                                                               |
| Pipeline / pool          | `HydratedSourcePool` (worker), label `{poolId}`                                                                                                                                                                                                | prefix `pipeline.hydratedSourcePool.`. Gauges: `residentCount, residentBytes, pinnedEntries, activePins, overBudget, highWater*`. Counters: `acquires, releases, terminatedPins, opens, rehydrations, admits, closes, evictions, failures, overBudgetPeriods, overBudgetDurationMs` |
| Phase events             | app and player                                                                                                                                                                                                                                 | `app.ready`, `datasource.open` (start/end), `datasource.firstMessage`, `frame.firstUseful`, `preload` (start/end), `playback` (start/end), `seek.requested`, `datasource.close` (start/end)                                                                                         |

Caveats:

- **`performance.memory` (`renderer.jsHeap.*`) covers only the JS heap of the current realm.** It
  is never total memory. It excludes workers, DOM, GPU and native allocations. Both projects
  launch with `--enable-precise-memory-info`. Without it, Chromium quantizes the values, and
  Electron reports a constant 31.2 MB. Use the
  host/process metrics for totals.
- Process working set (RSS) **double-counts shared pages** across processes. Treat the "total" as
  an upper bound that is good for comparing runs, not as exact memory usage.
- `pipeline.hydratedSourcePool.closes` counts **completed** closes only: a `close()` that throws
  is logged and not counted (there is no separate close-failure counter).
- `seek.requested` is emitted when a seek is requested. The seek may be deferred until
  initialization completes or be a no-op (already at, or already seeking to, that time).
- There is **one `preload` phase per player**. An end with a `reason` label (`cancelled`, `error`)
  is final and is not restarted by a later full subscription. `phases.preloadDurationMs` is
  reported only for a completed end; otherwise `phases.preloadEndReason` holds the reason.
- **`app.ready` is not "app usable".** It fires once on the first commit of the benchmark root
  (`benchmark/src/Root.tsx`): providers and `StudioApp` are mounted, but the layout is not applied,
  no data source is open and no panel has rendered yet. It is the earliest point all scenarios
  share, which is why synthetic runs measure their phases from it. For "usable", use
  `layout.applied` (`phases.layoutAppliedMs`), `panel.firstRender` / `panel.mount`
  (`phases.panelsReadyMs`) or `datasource.firstMessage` (`phases.firstMessageMs`).
- `run.environment.hostCpuSource` says where process CPU came from: `cdp` (web, CPU time between
  polls), `app-metrics` (Electron, CPU since the previous poll) or `ps` (web, CDP failed). With
  `ps` the run has **no CPU**: `pcpu` is ps' own lifetime (Linux) or decaying (macOS) average, not
  CPU per poll, so it is not recorded, and `summary.process.medianTotalCpuPercent`, `cpuSeconds`,
  `byType.*.medianCpuPercent` and `kpis.cpu` stay empty instead of mixing it with interval CPU.
  Older results lack the field.
- Web runs in headless Chromium use **SwiftShader** (software GL). That makes the `gpu` process
  CPU very high (hundreds of percent) and makes CPU noisy. Compare web CPU only to other web
  runs.
- `process.cpuPercent` is a **per-core sum** on both platforms (100 % = one full core, so a
  process can exceed 100 %). Electron's `percentCPUUsage` is divided by the number of logical CPUs,
  so the Electron collector multiplies it by `run.environment.logicalCpus`
  (`os.availableParallelism()` of the runner, which runs on the same host; see
  `runner/hostCpus.ts`). Results written before this conversion understate Electron CPU by that
  factor (they lack `logicalCpus`).
- In scenario runs, host polling and drains run through `page.evaluate`. Under heavy rendering
  (`pointcloud`, `transform` on web), the 1 Hz loop can get only 3–4 polls in a 5 s window. The
  overhead steady window polls without page calls (see "Telemetry overhead").
- On Windows the web collector cannot read RSS (no `ps`), so only CPU is reported. It logs a
  warning once.

#### Panels and pipeline

| Layer                       | Source                                                                                                                                                             | Metrics / events                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panels                      | `Panel` (all panels), `PanelExtensionAdapter`, MessagePipeline subscribers; labels `{panelId, panelType}` (`panelId` = layout id, e.g. `Plot!3x9a`), scope `panel` | Events: `panel.mount`, `panel.unmount`, `panel.firstRender` (adapter panels only); `layout.applied` (scope `app`). Counters: `panel.messages.{delivered,deliveredBytes,rendered,renderedBytes}`, `panel.rangeMessages.{delivered,deliveredBytes}`, `panel.render.{count,skipped}`. Observation: `panel.render.durationMs` (→ `.count`/`.sum`/`.max`)              |
| Pipeline (MessagePipeline)  | `MessagePipeline` (renderer), scope `pipeline`                                                                                                                     | Counters: `pipeline.messages.{received,receivedBytes,delivered,deliveredBytes}`. Gauges: `pipeline.subscribers.count`, `pipeline.subscriptions.count`. Observation: `pipeline.listenerDispatchDurationMs` (→ `.count`/`.sum`/`.max`)                                                                                                                              |
| Pipeline (player / sources) | `BlockLoader`, `MultiIterableSource`, `CachingIterableSource`, `RemoteFileReadable`, `IterablePlayer`; scope `pipeline`                                            | Gauges: `pipeline.blockCache.{bytes,maxBytes,loadedFraction}`, `pipeline.sources.{total,relevant}`, `pipeline.sourceCache.bytes`, `pipeline.memory.<key>` (bytes, label `{sourceId}`, one per `progress.memoryInfo` entry). Counters: `pipeline.blockCache.evictions`, `pipeline.sourceCache.{hits,misses,evictions}`, `pipeline.remote.{readRequests,bytesRead}` |

What the panel counters mean:

- `panel.messages.delivered[Bytes]`: for **every panel**, the messages the MessagePipeline
  buckets for the panel on each tick, summed across the panel's subscribers, whether or not the
  panel rendered them.
- `panel.messages.rendered[Bytes]`: **extension-API panels** (`PanelExtensionAdapter`) only, the
  messages of the frames actually handed to `onRender`. A skipped frame is counted in
  `panel.render.skipped`, and its messages are counted as rendered only if a later render hands
  the same frame over. `delivered - rendered` is the work the panel never rendered.
- `panel.rangeMessages.delivered[Bytes]`: preloaded (range) deliveries, i.e. the
  `useSubscribeMessageRange` batches plus the new tail of `renderState.allFrames`.
- `panel.render.*` and `panel.firstRender` exist only for extension-API (adapter) panels.

The panel and MessagePipeline names are defined in `PANEL_TELEMETRY_METRICS`
(`packages/suite-base/src/components/PanelExtensionAdapter/constants.ts`) and
`PIPELINE_TELEMETRY_METRICS` (`packages/suite-base/src/components/MessagePipeline/constants.ts`),
which the benchmark summaries (`e2e/result/`) import.

## The E2E runner

```
benchmark/e2e/
├── playwright.config.ts          projects "electron" and "web"
├── scenarios.benchmark.spec.ts   one test per scenario under test (+ web crossOriginIsolated check)
├── overhead.benchmark.spec.ts    telemetry off/on A/B, repeated and order-balanced (report only)
├── fixtures/                     Playwright fixtures, Electron/web targets, MCAP generator
├── server/staticServer.ts        Node http static server (Range, COOP/COEP/CORP/CORS, SPA fallback)
├── runner/                       runScenario, overheadMeasurement, host collectors, artifacts, overhead, crashDetection, scenariosUnderTest
├── result/schemaV1.ts            benchmark-result.v1 types, builder and validator
├── report/summaryMarkdown.ts     markdown tables for the summary
└── ci-helpers/generate-benchmark-summary.ts
```

`runScenario(target, scenario, opts)` does the same thing on both platforms:

1. Installs `recordFrameTimes` with `page.exposeFunction`.
2. Navigates to `?scenario=<id>[&telemetry=off][&ds.url=…]`.
3. Waits for the telemetry API.
4. Runs a 1 Hz loop for the scenario's `durationMs`, or 5 s by default. Each tick reads the page
   clock, collects host metrics stamped with that clock, and drains page telemetry until it is
   empty (capped per tick).
5. With screenshots in mode `all` (`BENCHMARK_SCREENSHOTS=all`, not the default), waits for a
   `loaded`/`mid` screenshot still in flight (see [Screenshots](#screenshots)). Both are taken in
   the background during step 4.
6. **For real pipelines** it waits for the scenario's own auto-pause (the "Play" button appears),
   then calls `window.lichtblickScenario.closeDataSource()` and polls for `datasource.close` end
   (up to 10 s). It does not click Pause, because that click would race the auto-pause and
   restart playback. It clicks "Pause" only as a fallback when no auto-pause shows up.
7. Waits for one more publish interval and does a final drain.
8. Builds the results, then (with `screenshots: true`) takes the `end` screenshot.
9. Fails the run if the renderer crashed, an Electron process died or the page reloaded (see
   [Crash detection](#crash-detection)). The v1 result is written first.
10. Fails the run if any panel or the app rendered an error boundary (see
    [Error-boundary guard](#error-boundary-guard)).

The web target serves `benchmark/.webpack` and the fixtures from the static server. Every response
carries these headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Resource-Policy: cross-origin`
- the CORS headers, including exposed `Content-Range`

With these, `crossOriginIsolated === true` in the page and its workers. A web test asserts this.

The Electron target launches `benchmark/.webpack-desktop` once per test. Its page is `file://`,
and it fetches the fixtures from the same static server.

The Electron WebGL switches depend on the host OS (`fixtures/electronLaunchArgs.ts`, verified with
Electron 44.4.5):

- **Linux (CI, xvfb):** `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, the
  same as `e2e/fixtures/electron.ts`. Without them WebGL context creation fails (Mesa llvmpipe).
- **macOS:** no GL switches. The SwiftShader switches make every WebGL context fail ("Error
  creating WebGL context." in all 3D panels), so Electron uses ANGLE Metal on the host GPU instead.
  Local macOS Electron 3D numbers are therefore hardware-GPU numbers and not comparable to CI.
- Never `--in-process-gpu` / `--single-process`: with the SwiftShader switches on macOS arm64
  Electron aborts at startup (`EXC_BREAKPOINT` in `Chrome_InProcGpuThread`).

### Artifacts (`benchmark/.artifacts/`)

| File                                                                        | Content                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<scenarioId>-<ts>.json` (Electron), `<scenarioId>-web-<ts>.json` (web)     | Legacy `BenchmarkArtifact` (unchanged shape). On web, `memorySamples[].metrics` are ProcessMetric-like `{pid, type, memory:{workingSetSize, peakWorkingSetSize} (KB), cpu:{percentCPUUsage}}` (memory is 0 when unavailable). `percentCPUUsage` is raw: divided by the logical CPUs on Electron, a per-core sum on web |
| `<scenarioId>-<platform>[-telemetry-off]-<ts>.benchmark-result.v1.json`     | Result schema v1 (below). The overhead spec writes one per measured run, tagged `-overhead` (`run.mode: "overhead"`): `-telemetry-off-overhead` for the baseline, `-overhead-ua-memory-off` for the UA arm                                                                                                             |
| `overhead-<platform>-<scenarioId>-<ts>.json`                                | Overhead A/B report, schema 3 (other schema versions are skipped with a warning; see [Telemetry overhead](#telemetry-overhead-report-only))                                                                                                                                                                            |
| `screenshots/<scenarioId>-<platform>[-telemetry-off]-<ts>-<checkpoint>.png` | Viewport screenshots of the scenarios spec runs, `<checkpoint>` = `end` by default, plus `loaded` and `mid` with `BENCHMARK_SCREENSHOTS=all` (see [Screenshots](#screenshots))                                                                                                                                         |
| `fixtures/`                                                                 | Generated MCAP fixtures. CI does not upload these                                                                                                                                                                                                                                                                      |

`<ts>` is the epoch ms at the start of the run, shared by all files of one run (legacy artifact,
v1 result and screenshots), so they can be matched up.

#### Screenshots

The scenarios spec captures viewport PNGs (`page.screenshot()`, not full page) per scenario and
platform so a reviewer can check what the app actually showed. By default only `end` is captured,
on every platform, so no capture happens inside the sampling window:

| Checkpoint | When                                                                                                                                                                                                                          | Default | `all` |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- |
| `loaded`   | Once the runner has drained the scenario's "loaded" event (`datasource.firstMessage` for real pipelines, `app.ready` for synthetic ones), or after a 5 s fallback (capped to the window), plus 500 ms for the panels to paint | no      | yes   |
| `mid`      | Halfway through the sampling window                                                                                                                                                                                           | no      | yes   |
| `end`      | After all measurement (sampling window, pause/close, final drain) and after the result is built, before the app is closed. For real pipelines it shows the app after the data source was closed                               | yes     | yes   |

`BENCHMARK_SCREENSHOTS` (case-insensitive) selects the mode for the scenarios spec, the same on
every platform:

| Value                        | Checkpoints                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| unset (or any other value)   | `end` only. Not part of any metric                                                    |
| `all`                        | `loaded` + `mid` + `end`. For visual debugging only: **distorts metrics** (see below) |
| `0` / `false` / `off` / `no` | None, e.g. `BENCHMARK_SCREENSHOTS=0 yarn test:e2e:benchmark:web`                      |

- Why `all` distorts metrics: on heavy 3D scenarios an in-window `page.screenshot()` can take
  several seconds, because Playwright makes several page round trips per capture, and it blocks
  the renderer inside the window, which distorts fps and long tasks. This hits the web 3D
  scenarios (`pointcloud`, `transform`, SwiftShader at about 1–3 fps) and Electron `pointcloud`.
  Web `pointcloud` dropped from about 3.7–3.9 to about 1.3–1.6 median fps, with 3× or more the
  long tasks. Electron 3D numbers vary a lot from run to run, so no Electron figure is given. Other
  captures take about 0.1 s.
- `loaded` and `mid` are taken by background tasks next to the 1 Hz sampling loop. The loop keeps
  its own wall-clock deadline, so the window length doesn't change. A capture can delay one tick's
  page calls; the next tick then starts sooner. The "loaded" check only looks at records the loop
  already drained, so its precision is about one tick. Captures are serialized and time out after
  10 s.
- A `loaded` or `mid` capture that would **start after the sampling window deadline is skipped**
  (logged with `console.debug`). A capture already in flight at the deadline finishes, and the
  runner waits for it before pause/close.
- `end` is taken after the final drain and after `endMonotonicTs`, the v1 result and the legacy
  artifact are built, so it is not part of any metric in the artifacts. `loaded` and `mid` fall
  inside the window and do cost renderer work there. For clean trend numbers, set
  `BENCHMARK_SCREENSHOTS=0`.
- A failed screenshot logs a `console.warn` and never fails the test.
- Each screenshot is also attached to the Playwright report as soon as it is taken (so it's there
  even if the test fails later). Open the local HTML report with `yarn test:e2e:benchmark:report`.
  In CI, download the `benchmark-results-electron` / `benchmark-results-web` artifact, which
  includes `benchmark/.artifacts/screenshots/`.
- The overhead spec never takes screenshots. A capture costs renderer, GPU and browser CPU and
  memory, which would add noise to the telemetry off/on comparison of host process metrics.
- Playwright's own `screenshot: "only-on-failure"` is set too. It covers the web pages and the
  Electron window (a failing test gets `benchmark/test-results/<test>/test-failed-1.png`) and
  complements the checkpoint screenshots.

#### Error-boundary guard

After measurement (after the `end` screenshot), `runScenario` looks for rendered error
boundaries: the titles "This panel encountered an unexpected error" (`PanelErrorBoundary`) and
"The app encountered an unexpected error" (app `ErrorBoundary`), plus the error message shown
below them (`runner/errorBoundaries.ts`). If there is any, the run **throws**, so the test fails
with a message like
`electron/pointcloud: 6 error boundaries rendered, …: 6× This panel encountered an unexpected error: Error creating WebGL context.`
No JSON artifact is written for that run; screenshots taken so far stay attached. Boundaries stay
rendered until dismissed, so this one check catches a crash from any point of the run, and it
runs for every spec (overhead too), without affecting any metric.

#### Crash detection

`runner/crashDetection.ts` attaches its listeners before the runner's first navigation.
`runScenario` stops it once measurement is over, which is the start of the runner's own closing,
and stores what it saw as `runnerEvents` in the v1 result:

| `type`            | Source                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderer.crash`  | `page.on("crash")` (web and Electron)                                                                                                                                                                                        |
| `process.gone`    | Electron only: main-process `app.on("render-process-gone")` (`processType: "renderer"`) and `app.on("child-process-gone")` (`processType` = `details.type`), with `reason` and `exitCode`. `reason: "clean-exit"` is ignored |
| `renderer.reload` | Main-frame `framenavigated` to a **new document** after the app was ready                                                                                                                                                    |

- The Electron listeners write to a global array in the main process. The runner drains it with
  `electronApp.evaluate` at the end, and also right away after a renderer crash.
- The runner's own navigations are excluded. Reload detection is armed only after the runner's
  `page.goto(?scenario=…)` and once `window.lichtblickTelemetry` exists. Arming marks the current
  document with a per-run token. `framenavigated` also fires for same-document navigations, such
  as the app's `history.replaceState` URL sync during playback, so each armed main-frame
  navigation checks the token. If the token is still there, it was the same document and nothing
  is reported. If it is missing, the page loaded a new document, which counts as a reload.
- Events from the runner's own shutdown are ignored. `stop()` records when closing starts.
  Events stamped at or after that time are dropped, and nothing is collected after
  `stop()`, while the fixture closes the app.
- `monotonicTs` uses `performance.timeOrigin + performance.now()` of the process that saw the
  event: the runner (Node) for page events and the Electron main process for `*-process-gone`.
  The page clock is not available while the page crashes or reloads. These clocks use the same
  formula and Unix-epoch anchor as the page clock, so they are on the host samples' timeline up
  to a few ms of skew.
- Any event fails the run, **after** the v1 result has been written to `benchmark/.artifacts/`
  as evidence. If the event broke the run early (for example `Target crashed`), the runner waits
  1 s for racing events. It then writes a partial result with everything sampled so far, and the
  thrown error keeps the original failure as `cause`. If there are no events, an error is
  rethrown unchanged.
- `summary.runnerEvents` counts the events by type. Every type is listed, with 0 if there were
  none.

#### `benchmark-result.v1`

```
{ schemaVersion: 1,
  run: { scenarioId, pipeline, platform, telemetryEnabled, startedAtWall, finishedAtWall (ISO),
         startMonotonicTs, endMonotonicTs, windowEndMonotonicTs?, sampleIntervalMs,
         scenario: { scenarioId, description, group, tags, layout, dataSource: { factoryId,
                     displayName? }, player, params (redacted), durationMs?,
                     panels: { id, type, title? }[] },
         environment: { os, arch, ci, userAgent?, electronVersion?, chromiumVersion?, cpuModel,
                        logicalCpus, totalMemBytes, crossOriginIsolated?, webBrowser?,
                        hostCpuSource?: "cdp" | "app-metrics" | "ps",
                        fpsCeiling, glRenderer, lateFrameThresholdMs } },   // render calibration
  samples: TelemetrySample[],   // page + worker + host process + listenerDispatchDurationMs, sorted by monotonicTs
  events: TelemetryEvent[],
  dropped: Record<realm, number>,
  sequenceGaps: Record<realm, number>,
  runnerEvents?: { type: "renderer.crash" | "process.gone" | "renderer.reload", monotonicTs,
                   reason?, processType?, exitCode?, url? }[],   // see Crash detection; [] = none
  summary: {
    process: { sampleCount, peakTotalWorkingSetBytes, meanTotalWorkingSetBytes, medianTotalCpuPercent?,
               totalWorkingSetSlopeMiBPerMin?, cpuSeconds?,
               byType: Record<processType, { peakWorkingSetBytes, medianCpuPercent? }> },
    renderer: { peakJsHeapUsedBytes?, lastUaSpecificMemoryBytes?, medianFps?, totalFrames?,
                lateFrames?, longTasks?, longTaskTotalMs? },
    listenerDispatchDurationMs?: { count, p50, p90, max },
    hydratedSourcePool?: { pools: Record<"<realm>/<poolId>", { realm, poolId, acquires, releases,
        terminatedPins, activePinsFinal, invariantHolds, overBudgetPeriods, overBudgetDurationMs,
        evictions, rehydrations, highWaterResidentCount, highWaterActivePins }> },
    phases: { origin?: "datasource.open" | "app.ready", firstMessageMs?, firstUsefulFrameMs?,
              openDurationMs?, preloadDurationMs?, preloadEndReason?, layoutAppliedMs?,
              panelsReadyMs?, panelsReadyCoverage?: { mounted, firstRendered } },
    panels?: Record<panelId, { panelType, mountedAtMs?, unmountedAtMs?, firstRenderMs?, mounts,
              messages, messageBytes, rangeMessages, rangeBytes, renderedMessages?,
              renderedBytes?, renders?, renderMeanMs?, renderMaxMs?, renderP90WindowMaxMs?,
              skipped? }>,
    pipeline?: { messagesReceived?, bytesReceived?, rateWindowMs?, messagesPerSec?, bytesPerSec?,
              deliveredFanout?, subscribersMax?, subscriptionsMax?, listenerDispatchMeanMs?,
              listenerDispatchMaxMs?, listenerDispatchP90WindowMaxMs?, blockCachePeakBytes?,
              blockCacheMaxBytes?, blockCacheEvictions?, sourceCacheHits?, sourceCacheMisses?,
              sourceCacheHitRatio?, sourceCachePeakBytes?, remoteReadRequests?, remoteBytesRead?,
              sourcesTotal?, sourcesRelevant?, memoryPeakBytes?: Record<key, number> },
    runnerEvents?: { "renderer.crash", "process.gone", "renderer.reload" },   // counts
    kpis: RunKpisV1 } }   // see "KPI scorecard"
```

- Process totals are summed per poll, across all processes of that poll. Peak and mean are taken
  over polls. CPU is a per-core sum (100 = one core) on both platforms, so the total can exceed 100. Percentiles use a sorted
  nearest rank.
- `invariantHolds` checks `acquires − releases − terminatedPins === activePins` at every published
  `activePins` snapshot and at the final values. Pools are keyed by realm, because pool ids are
  only unique within a worker.
- `phases` and the panel times are measured in ms from `datasource.open` start, or from
  `app.ready` when the run has no `datasource.open` (synthetic players). `phases.origin` says which.
  `app.ready` is the root's first commit, not a usable app (see the caveats under "What is
  collected"), so a synthetic run's `layoutAppliedMs` and `panelsReadyMs` include the app's own
  startup after mount.
- `panelsReadyMs` is the latest `panel.firstRender` among the panels that emitted one, else the
  latest `panel.mount`. Only `PanelExtensionAdapter` panels emit `panel.firstRender`, so check
  `panelsReadyCoverage`.
- Panel and pipeline totals come from the counters' last cumulative value per series. Rates use the
  measured window (`startMonotonicTs` to `windowEndMonotonicTs`). Render and listener-dispatch
  durations are `observe()` series (`.count`/`.sum`/`.max` per 1 Hz window): mean = Σsum / Σcount,
  max = max of `.max`, and `*P90WindowMaxMs` = p90 of the per-window `.max` (a spike indicator).
  Fields without data are omitted.
- **Memory slope** (`totalWorkingSetSlopeMiBPerMin`): least squares over the polls of the steady
  window only. The window starts at the later of the end of a 20 % warm-up
  (`STEADY_STATE_WARMUP_FRACTION`) and the end of startup (origin + max(`panelsReadyMs`,
  `firstMessageMs`)), and ends with the measured window. The slope is reported only when that
  window is ≥ 10 s (`MIN_SLOPE_WINDOW_MS`) and has ≥ 3 polls; otherwise it is omitted. Short
  scenarios (5–10 s) therefore report no slope instead of the startup ramp.
- `cpuSeconds` integrates the total CPU % / 100 over the polls (trapezoid).
- **Required in v1**: `run.scenario`, `run.environment.logicalCpus`, the render calibration
  (`run.environment.fpsCeiling`, `glRenderer`, `lateFrameThresholdMs`) and `summary.kpis`. `validateResultV1(obj, "strict")`
  (what the runner and the scenarios spec use) returns a list of problems; the spec asserts it is
  empty.
- The validator also checks the window order in both modes: `startMonotonicTs ≤
  windowEndMonotonicTs ≤ endMonotonicTs`. Strict mode also needs `endMonotonicTs >
  startMonotonicTs`; lenient mode accepts `start == end`, which is what a partial result of a
  run that failed before the page was ready has. `summary.process.sampleCount` must be a
  non-negative integer. An overhead `summary.steadyWindow` must not end before it starts
  (`start == end` is a window without steady polls, ending at its priming poll).
- **Older artifacts** load in `"lenient"` mode (viewer, CI summary): a missing `run.scenario` is
  shown as "scenario not recorded" (observed telemetry only), missing `logicalCpus` and
  calibration as "not recorded", and missing `summary.kpis` are recomputed from the other summaries (`withRunKpis`) and
  marked "recomputed".

### Telemetry overhead (report only)

`overhead.benchmark.spec.ts` measures what the benchmark telemetry itself costs, per platform, on
`sinewave`, `mcap-multi-ingest` and `pointcloud` (`OVERHEAD_SCENARIOS`). It writes
`overhead-<platform>-<scenario>-<ts>.json` (schema 3, `runner/overhead.types.ts`) plus the v1 result
of every measured relaunch run. Those results carry `run.mode: "overhead"` and a `-overhead` file name tag;
the viewer's scenario views (Scorecard, By group, Overview, Coverage, Runs) and the CI summary leave
them out (`result/runMode.ts`, results from before `run.mode` are recognized by
`summary.steadyWindow`). They are linked from the overhead section only.

Two A/B methods, chosen with `BENCHMARK_OVERHEAD_METHOD` (`toggle` | `relaunch` | `both`, default
`both`):

| Method     | CPU verdict from               | Memory verdict from | Launches per scenario        |
| ---------- | ------------------------------ | ------------------- | ---------------------------- |
| `toggle`   | toggle A/B                     | not measured        | 1 (+ warm-up runs)           |
| `relaunch` | relaunch A/B                   | relaunch A/B        | warm-up + repeats × arms     |
| `both`     | toggle A/B (relaunch CPU info) | relaunch A/B        | warm-up + 1 + repeats × arms |

**Why the toggle A/B is the primary CPU method.** Telemetry costs ≈ 0.1–1 % CPU, but two fresh
launches of the same arm differ by ± 2–5 % (JIT, GC timing, GPU process start, background load).
With 6–8 relaunch pairs that launch-to-launch variance dominates the deltas and the CI95 spans
min..max, so the CPU verdict ends up `inconclusive`. The toggle A/B compares short blocks within one
app instance, so every block shares the same heap, caches, process set and playback, and the
launch variance cancels out of each quartet. It is also faster: one launch per scenario instead of
≈ 17.

**Toggle A/B** (`runner/toggleBlocks.ts`, `runner/toggleWindow.ts`, `measurement: { mode: "toggle" }`
of `runScenario`, recorded by `runner/overheadMeasurement.ts`)

- **One launch**, telemetry installed on. After the page API is ready and a 10 s warm-up
  (`OVERHEAD_TOGGLE_WARMUP_MS`; longer than the relaunch one, so the start-up CPU ramp ends before
  the first block), the runner runs `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS` ABBA quartets of 4 blocks
  of `BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS` each (off, on, on, off, off, on, on, off, …), on a fixed
  schedule (`t0 + i × block`). The schedule always consists of complete quartets; quartet `k` =
  blocks `4k … 4k + 3`. Every quartet has the same orientation, so in each one an arm switch
  precedes one block of either arm.
- **The page toggle** (`window.lichtblickTelemetry.setTelemetryActive(active)`,
  `benchmark/src/telemetry/installBenchmarkTelemetry.ts`). Off: the realm sink is swapped to the
  no-op (`setTelemetrySink(undefined)`) and the renderer collectors pause: frame recording stopped,
  long-task observer disconnected, collector tick and sink publish timer stopped, UA memory probe
  paused. The frame collector's `requestAnimationFrame` loop keeps running in both arms (harness,
  see "Benchmark FPS probe" below). On: the real sink is restored and all of them resume (the UA probe keeps its global 10 s minimum
  spacing, so resuming never causes a burst). Records already buffered stay drainable. A few
  producers keep the instance they got earlier (`HydratedSourcePool` at construction, the Plot
  range iterator wrapper of `useSubscribeMessageRange`, an in-flight UA memory call), so the sink
  itself is gated too (`ToggleableTelemetrySink`: every emit/ingest returns at once while off).
  With telemetry disabled at install time the call is a no-op.
- **Settle**: the toggle is a page round trip; it is sent at the block start through the same
  serial queue as the drains (page calls never overlap), and the first `OVERHEAD_TOGGLE_SETTLE_MS` =
  500 ms of each block are not measured. A toggle that overruns the settle period marks the block
  `lateStart` (measurement then starts right after it). Toggle latency is recorded per block.
- **CPU per block from cumulative CPU time**, never from an instantaneous or decayed percentage
  (macOS `ps %cpu` is a decayed average, Electron's `percentCPUUsage` is "since the last call"):
  web reads CDP `SystemInfo.getProcessInfo` `cpuTime`, Electron reads `app.getAppMetrics()`
  `cpu.cumulativeCPUUsage` in the main process (no page call; a version without it fails with a
  clear error, use `relaunch`). Block CPU = Σ Δ CPU seconds of the processes present at both reads /
  Δ wall, as a per-core sum (100 % = one core, as `runner/hostCpus.ts`).
- **Process set**: each block records the types and counts of its processes. A block in which a
  process appeared or exited, or whose set differs from the run's most frequent (modal) set, is
  flagged and its quartet excluded.
- **ABBA quartets** are the statistical unit. Per quartet, each arm's CPU pools its two blocks
  (Σ Δ CPU seconds / Σ Δ wall, i.e. block CPU weighted by measured wall time):
  `cpuRelative = Σ on / Σ off − 1` and `cpuPctPoints = on − off` (mean of the arm's blocks). The
  included quartets feed the same statistics and verdict as the relaunch A/B (below).
- **Why quartets, not adjacent pairs**: CPU drifts over a run (playback content, JIT, heap growth,
  thermal state; a web `pointcloud` smoke fell from 36 % to 23 % over 10 blocks). An adjacent
  off/on pair picks up one block of drift, with the sign alternating between off-first and on-first
  pairs, so the pair deltas swing (−10 %, +7 %, −15 %, …) and the CI95 spans them. In a quartet
  (blocks at `t0 … t3`) both arms have the same mean time (`(t0 + t3) / 2 = (t1 + t2) / 2`), so a
  linear drift `a + b·t` adds the same CPU to both sums and cancels exactly: a constant relative
  overhead `e` on top of it still gives `Σ on / Σ off − 1 = e`. Only curvature within one quartet
  (≈ 4 blocks, 12 s) remains. The adjacent-pair deltas stay in the report (`toggle.pairs`) as a
  diagnostic; they never enter the statistics or the verdict.
- **Checks** (the spec asserts them): renderer-realm records stamped in off blocks = 0 and > 0 in on
  blocks, UA calls in off blocks = 0; for the frame-probe variant 0 renderer records and 0 UA calls
  in both arms. The report records per block the records per realm and the UA
  calls, and per run the toggle latency maximum, flagged blocks and late starts.
- **Limitations**:
  - Steady-state CPU only: the toggle cannot measure retained memory (heap and buffers stay
    allocated in both arms), so memory comes from the relaunch A/B.
  - The worker realm (`WorkerSerializedIterableSourceWorker`, `mcap-multi-ingest`) is not
    toggled: its sink is installed at worker start and keeps recording in both arms. Its batches
    are dropped on arrival in off blocks, because the renderer ingest is gated. So the toggle
    measures the renderer realm plus the main-thread ingest. Worker cost shows up in the relaunch
    A/B and the self-cost. When a block holds records of a realm other than renderer or runner
    (`toggleUntoggledRealms`), the viewer and the CI summary put a note next to the toggle verdict
    (flags column, and the title of the overview CPU cell).
  - Telemetry drains keep running in both arms (they read the buffer, not the producers).
  - Startup cost (collector install, first data source open) is outside the blocks.
- **Duration**: auto-pause (`?scenario.durationMs`) and MCAP fixture length are derived from
  warm-up + quartets × 4 × block + profile + 2 s (defaults: 10 s + 10 × 4 × 3 s + 10 s + 2 s =
  142 s; fixtures `.artifacts/fixtures/overhead/147s/`). A toggle run takes ≈ 2.5–3 min with the
  defaults, ≈ 1.5 min with 4 quartets.
- **Minimum quartets**: a toggle verdict (`within` / `exceeds`) needs at least
  `MIN_QUARTETS_FOR_VERDICT` = 6 included quartets, otherwise it is `inconclusive`. Runs with
  4 quartets (the minimum `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS`) are smoke tests: with fewer than 6
  values no pair of order statistics covers the median with 95 % confidence, so they report the
  median without a CI95.

**Relaunch A/B**

- **Arms**: `off` (`?telemetry=off`) and `on`. On web, `BENCHMARK_OVERHEAD_UA_ARM=1` adds
  `on-noUa` (telemetry on, `?telemetry.uaMemory=off`), see below.
- **Fresh instance per run**: every run launches a new browser or Electron app, and the previous
  one is closed first, so runs never compete for CPU and share no caches or heap.
- **Warm-up runs**: `BENCHMARK_OVERHEAD_WARMUP_RUNS` runs (alternating arms) go first and are
  discarded (cold disk cache, JIT, first-launch work).
- **Balanced order** (`runner/overheadSchedule.ts`): with two arms each repeat is a pair in ABBA
  order (even repeats off → on, odd repeats on → off). A drift with run position (thermal state,
  background load) then has opposite signs in consecutive pairs and cancels in the median. With
  three arms the order rotates as a Latin square, so every arm takes every position.
- **Steady window** (`measurement: { mode: "steady" }` of `runScenario`, recorded by
  `runner/overheadMeasurement.ts` with `runner/steadyWindow.ts`):
  after the page API is ready the runner takes 1 Hz host polls for `OVERHEAD_WARMUP_MS` = 3 s, a
  priming poll and then exactly `BENCHMARK_OVERHEAD_POLLS` (default `OVERHEAD_STEADY_POLLS` = 10,
  min 5) polls on a fixed schedule (`t0 + i × 1 s`, not deadline-driven, so slow polls cannot drop
  polls). Host CPU is "since the previous poll", so the priming poll keeps startup out of the first
  steady value. Scenarios that auto-pause get `?scenario.durationMs` = warm-up + polls × interval +
  2 s, so the pause never lands in the window. Screenshots are off.
- **Polls never wait for the page**: a busy renderer (`pointcloud` on web blocks its main thread
  ≈ 800 ms/s) delays every `page.evaluate`, so a poll does host collection only (web: `ps` + CDP
  `SystemInfo` on the browser session; Electron: `app.getAppMetrics()` in the main process instead
  of the renderer's preload bridge).
  - Poll timestamps come from the Node clock plus a page clock offset measured once before the
    window (`runner/clockSync.ts`: `CLOCK_SYNC_ROUNDS` = 5 `pageNow` round trips, the one with the
    smallest round trip wins, NTP style; exact to ± half of `clockSyncRttMs`).
  - Telemetry is drained by a separate loop every `OVERHEAD_DRAIN_INTERVAL_MS` = 2 s (each drain
    awaited; ≤ ~60 records/s fill well under 1 % of the 8192-record sink per interval), stopped at
    the last poll and followed by a full drain. Drains and the main-thread probe reads (window start
    and end) go through one queue, so page calls never overlap.
- **Longer MCAP data**: the scenario fixtures span 10 s, which ends before the steady window does
  (≈ 13 s after the page is ready), so the last polls would measure an idle player. The overhead
  spec uses its own fixtures (`overheadFixtureUrls`, `runner/overheadFixtures.ts`): the auto-pause
  plus `OVERHEAD_FIXTURE_DATA_MARGIN_MS` = 5 s for loading, at the same rate and size. They are
  cached per length in `.artifacts/fixtures/overhead/<seconds>s/`, so another poll count
  generates its own (10 polls: 3 s + 10 s + 2 s + 5 s = `20s/`; 20 polls: `30s/`).
- **Browser (web)**: every arm runs in the full Chromium in new headless mode
  (`OVERHEAD_WEB_BROWSER`, Playwright `channel: "chromium"`, recorded as
  `run.environment.webBrowser`). Playwright's default `chromium-headless-shell`, used by the scenario
  runs, rejects every `measureUserAgentSpecificMemory()` call with a `SecurityError`.
- **Per run** (`summary.steadyWindow` of the v1 result): median and mean total CPU, mean and peak
  total working set, mean working set per process type, the process set (max count per type),
  `polls`, `overruns` (a host poll that ended after its next slot), `windowMismatch` (fewer polls
  than requested, a poll without CPU or any overrun), `maxPollLatencyMs` (longest host poll) and
  `clockSyncRttMs`.
- **Main-thread probe in both arms** (`runner/mainThreadProbe.ts`): the runner injects the same
  probe into every arm before navigation (`page.addInitScript`): a `longtask` `PerformanceObserver`
  and a `requestAnimationFrame` counter. Read at the start and end of the steady window it gives
  `mainThread: { longTaskBlockedMsPerSec, fps }`, so the off arm has main-thread numbers too. A
  failed probe read is warned about and leaves the run without `mainThread`.
- **Pairs**: per repeat, `on − off` deltas: `cpuRelative = (on − off) / off` and `cpuPctPoints` of
  the steady median total CPU, `memBytes` of the steady mean total working set, the main-thread
  deltas, and `memBytesCommonProcesses` (only the process types both runs had; secondary). A pair
  where either run has `windowMismatch` is **excluded**; a pair whose process sets differ is
  **flagged** `processSetMismatch` but kept. A pair where either run has no working-set poll gets
  no memory deltas, so memory has fewer pairs (down to not measured, `inconclusive`).

**Statistics** (`result/stats.ts`)

- Each metric: median of the included pair (relaunch) or quartet (toggle) deltas, IQR, and an
  exact, distribution-free CI95 of the median from order statistics (`medianCiRanks`): with the
  deltas sorted, `[x(k), x(n−k+1)]` covers the true median with probability
  `1 − 2·P(B ≤ k − 1)`, `B ~ Binomial(n, ½)`; `k` is the largest rank with a coverage ≥ 95 %
  (`MEDIAN_CI_CONFIDENCE`). It assumes only independent deltas, no distribution shape, and is
  deterministic. Examples: n = 6–8 → [min, max] (96.9 %, 98.4 %, 99.2 %), n = 9 → ranks 2..8
  (96.1 %), n = 10 → ranks 2..9 (97.9 %).
- **Why not a bootstrap.** Earlier reports used a percentile bootstrap of the median. Its interval
  can never be wider than [min, max], which covers the median with only 75 % (n = 3) to 93.75 %
  (n = 5) probability, and at larger n it tends to pick ranks below the nominal 95 %; a verdict
  could then pass on noise. The order-statistic interval has guaranteed coverage at every n.
- **Minimum n.** Below n = 6 even [min, max] covers the median with less than 95 % (n = 5:
  93.75 %), so there is no CI95 (the report shows the median alone).
- **Verdict** against the unchanged targets (`OVERHEAD_TARGETS`: relative CPU ≤ 2 %, working set
  ≤ 20 MiB): `within` when the CI95 upper bound ≤ target, `exceeds` when the CI95 lower bound >
  target, otherwise `inconclusive`. Fewer than `MIN_PAIRS_FOR_VERDICT` = 6 included pairs (relaunch)
  or `MIN_QUARTETS_FOR_VERDICT` = 6 included quartets (toggle) is always `inconclusive`. The
  default `BENCHMARK_OVERHEAD_REPEATS` = 8 leaves a relaunch verdict with up to 2 excluded pairs
  (previously 5 repeats with a minimum of 3); it costs 6 more launches per scenario (≈ 3–4 min).
  `verdicts.overall` is the worst of CPU and memory (`exceeds` > `inconclusive` > `within`).
- **Report only**: the suite never fails on the targets unless `BENCHMARK_OVERHEAD_GATE=1`, and then
  only on an overall `exceeds` (an `inconclusive` result does not fail).

**UA memory probe arm** (web only). With cross-origin isolation the page telemetry calls
`performance.measureUserAgentSpecificMemory()`. That is a benchmark probe, not product telemetry,
and the browser may run a garbage collection to answer it, which can make the telemetry-on working
set _smaller_ than telemetry off. The `on-noUa` arm isolates that: the report adds
`withoutUaProbe` (on-noUa vs off, with verdicts) and `uaCost` (on vs on-noUa, no verdict). Electron
pages are not cross-origin isolated, so the probe never runs there and the arm is skipped. A
browser that rejects the call with a `SecurityError` (the headless shell) makes the collector report
`unsupported` and stop calling. Chromium answers lazily (with the next GC, ≈ 10–20 s in headless
runs), so only about one call per run resolves.

With method `toggle` or `both` the same knob adds a second toggle launch with
`?telemetry.uaMemory=off` (`overheadSchedule.toggleUaProbeVariants`). The report keeps it as
`toggleWithoutUaProbe` (same shape and statistics as `toggle`, own verdict, informational: the CPU
verdict stays the one of `toggle`); the viewer and the CI summary show it as the sub-row
"toggle without UA probe (informational)". The spec asserts 0 UA calls in its on blocks.

**Measured UA probe cost** (web, full Chromium, M4 Pro; `toggle` vs `toggleWithoutUaProbe`, one
launch each; CIs from the earlier percentile bootstrap, so the 4-quartet rows would have none now). The probe runs at most every `UA_MEMORY_MIN_INTERVAL_MS` = 10 s; collectors are
paused in off blocks, so it fires about once per quartet, in an on block.

| Scenario              | Quartets | UA calls (on blocks) | CPU Δ with probe, median [CI95] | CPU Δ without probe, median [CI95] |
| --------------------- | -------- | -------------------- | ------------------------------- | ---------------------------------- |
| `pointcloud` launch 1 | 8        | 7                    | +4.59 % [+1.72, +7.97]          | +5.65 % [−1.69, +16.27]            |
| `pointcloud` launch 2 | 8        | 7                    | +5.61 % [−1.47, +11.59]         | −3.75 % [−7.79, +3.15]             |
| `sinewave`            | 4        | 3                    | −0.30 % [−1.50, +1.00]          | −0.79 % [−1.78, +1.62]             |
| `mcap-multi-ingest`   | 4        | 3                    | +2.42 % [−1.90, +11.53]         | +1.99 % [−4.15, +11.79]            |

CPU per call ≈ (pp with − pp without) × on-block seconds / calls. Pooled over the 24 + 16
`pointcloud` quartets that is +5 ms [−93, +101] per call (difference of the mean quartet pp deltas,
bootstrap CI95); `sinewave` and `mcap-multi-ingest` give +85 ms and +11 ms from 4 quartets each.
All are inside the run-to-run noise: a `pointcloud` quartet's pp delta has a standard deviation of
≈ 2–3 pp, and a third launch with the probe gave −2.39 % [−8.73, +5.68]. The probe does not explain
the `pointcloud` results, so `UA_MEMORY_MIN_INTERVAL_MS` stays 10 s (point estimate ≈ 0.05 % of one
core). These runs paused the frame collector's `requestAnimationFrame` loop in off blocks, so their
deltas include the frame loop (see "Benchmark FPS probe" below). The 4-quartet runs above are smoke tests (no verdict below
6 quartets); use the default 10 quartets or more.

**Direct (JS only) CPU attribution** (method `toggle` or `both`, `result/directAttribution.ts`).
The toggle verdict subtracts host CPU of whole processes, and the block-to-block noise of a busy
scenario (web `pointcloud`: ≈ 2–3 pp per quartet) is larger than the 2 % target of a ≈ 30 % CPU
baseline. The direct attribution measures the telemetry's own JS instead:

- **When**: after the last toggle block, the runner turns telemetry back on and profiles
  `BENCHMARK_OVERHEAD_PROFILE_MS` (default `OVERHEAD_PROFILE_DEFAULT_MS` = 10 s, `0` disables) of
  the renderer main thread with the CDP `Profiler` (`runner/cpuProfile.ts`, a CDP session on the
  page; on Electron the same `newCDPSession` on the app window). The period is outside every block,
  so it never enters the toggle statistics; the drains keep running as in the blocks. Only the
  launch with the UA probe is profiled (not `toggleWithoutUaProbe`). A session or profiler failure
  is recorded as `status: "unsupported"` with the reason.
- **Sampling**: `OVERHEAD_PROFILE_SAMPLING_INTERVAL_US` = 100 µs. Telemetry callbacks are short
  (µs each, ≈ 0.5–1 ms/s in total), so V8's default 1 ms interval would catch them only a few
  times per second. With 100 µs the profile gets ≈ 6 500 samples/s (web `pointcloud`, the sampler
  does not reach the nominal rate). Profiler overhead slows everything it
  samples alike, so the telemetry _share_ is unaffected.
- **Source mapping** (`runner/bundleSourceResolver.ts`, `runner/sourceMap.ts`): the production
  benchmark builds already emit external source maps (`devtool: "source-map"`), so no build
  config changes. Each sampled frame's script is looked up in the build output
  (`RENDERER_BUNDLE_LAYOUTS`: web `.webpack/`, Electron `.webpack-desktop/renderer/`), its map is
  decoded once, and the function start is mapped to the original repo-relative source. The name
  comes from the original line (`readonly #tick = () =>` → `#tick`), because minified names and the
  map's names of arrow functions are not useful. Frames of other scripts (Playwright evaluation
  scripts, native functions) count as resolved, non-telemetry.
- **Telemetry sources** (`DIRECT_ATTRIBUTION_TELEMETRY_SOURCES`):
  `packages/suite-base/src/util/telemetry/**` (sinks, labels, clock),
  `benchmark/src/telemetry/**` (collectors, toggleable sink, drain bridge; the harness frame loop
  lives in `benchmark/src/frameProbe/` and is not counted, only the frame recording it calls is),
  and the producer helpers `components/MessagePipeline/pipelineTelemetry.ts`,
  `components/PanelExtensionAdapter/panelTelemetry.ts` and `hooks/usePanelLifecycleTelemetry.ts`.
  Not attributable: telemetry calls inlined in product code (`MessagePipeline/index.tsx`,
  `PanelExtensionAdapter.tsx`, `useSubscribeMessageRange`, `IterablePlayer`, `BlockLoader`,
  `CachingIterableSource`, `WorkerSerializedIterableSource*`, `HydratedSourcePool`,
  `MultiIterableSource`, `RemoteFileReadable`, `CurrentLayoutProvider`). Their sink calls still
  count, because the sink is a telemetry source; only the label and value preparation around the
  call goes to the caller. `services/telemetry` is the OpenTelemetry analytics, not this telemetry.
- **Attribution**: per sample, the inclusive time of the outermost telemetry frame on the stack
  (nested telemetry frames never count twice). `(idle)` and `(program)` samples are not JS;
  `(garbage collector)` samples are GC (reported as a share, not attributable). Unresolved = a JS
  sample with no telemetry frame but an unmapped frame that could hide telemetry: a frame of a build
  script without a map, or an unmapped position in a script whose map lists a telemetry source.
  Webpack maps a module either fully or not at all, and every telemetry source is first-party
  TypeScript built with maps. So an unmapped position in a chunk whose map lists no telemetry source
  (vendor code shipped without maps, such as `react-json-tree` / `lodash` in an async chunk) is
  resolved non-telemetry.
- **Metrics** (`directAttribution`, per scenario and platform): `telemetryMsPerSec`,
  `jsMsPerSec`, `unresolvedMsPerSec` / `resolvedShare`, `gcMsPerSec` / `gcShare`, the top 5
  telemetry functions (`DIRECT_ATTRIBUTION_TOP_FUNCTIONS`, source:line, ms/s), and
  `relative = telemetryMsPerSec / offCpuMsPerSec`. `offCpuMsPerSec` = mean CPU of the included toggle
  off blocks (per-core sum %) × 10. `relativeUpperBound` adds the unresolved time to the
  telemetry time.
- **Verdict** (own, label "direct (JS only)"): `exceeds` when `relative` > `cpuDeltaRelativeMax`,
  `within` when `relativeUpperBound` ≤ it, otherwise `inconclusive` (also without an off
  baseline). It is **not** merged into `verdicts`: the toggle stays the statistical CPU verdict.
  The viewer and the CI summary show it as a sub-row right below the main row.
- **Limits**: JS only, renderer main thread only.
  - Worker realms are excluded (`mcap-multi-ingest`'s source worker).
  - Browser-internal work is excluded: observer dispatch, style / layout / compositor work, and
    frames kept alive by the frame collector's `requestAnimationFrame` loop (harness, runs in both
    toggle arms; its cost is the frame-probe variant). So is the UA memory probe (heap walk, GC),
    which the UA-off toggle variant covers.
  - Terser inlining attributes an inlined telemetry helper to its caller.
  - `jsMsPerSec` ("JS stacks … (wall)") is sampled wall time with a JS stack, not CPU. Blocking
    native calls under JS count in full: on web `pointcloud`, 84 % of the profile is WebGL
    `bufferSubData` under the render loop, so it reads ≈ 960 ms/s while the renderer uses ≈ 300 ms
    CPU/s. The telemetry frames are short CPU-bound callbacks, so `telemetryMsPerSec` is a fair CPU
    estimate.
  - When the direct (JS only) verdict is `within` but the toggle shows a consistent positive delta,
    the cost is outside the JS (browser-internal or another process) and only the toggle can see
    it.

**Benchmark FPS probe** (harness, not shipped). The frame collector
(`benchmark/src/telemetry/collectors/FrameCollector.ts`) counts frames with a
`requestAnimationFrame` loop (`benchmark/src/frameProbe/FrameLoop.ts`). It exists only in the benchmark app, never in the product. A running
rAF loop makes the browser produce a frame every vsync even when nothing changes: style, paint,
compositing and GPU process work. In a mostly static scenario that is extra CPU the product would
not spend. Measured (M4 Pro, `mcap-multi-ingest`, 10 quartets) while the telemetry toggle still
paused the loop in off blocks: +7.5 % CPU on both platforms (Electron +7.53 % [−0.34, +15.46];
web +7.45 % [+3.00, +10.81], +6.87 % without the UA probe), while the direct (JS only) attribution
was ≈ +0.1 %. The per-process split put it outside the renderer JS: GPU process +0.94 pp
(Electron) / +0.44 pp (web) and web browser process +0.57 pp, positive in 10/10 quartets.

- **Toggle mode keeps the loop in both arms**: `setTelemetryActive({ active: false })` stops only
  the frame recording; the loop keeps rendering, so the toggle A/B isolates telemetry recording,
  collection and publishing. This matches the relaunch A/B, whose main-thread probe runs its own
  rAF loop in both arms. After the change (Electron `mcap-multi-ingest`, two 6-quartet smokes): the
  telemetry toggle gave −2.50 % [−6.72, +0.19] and +4.44 % [−4.56, +9.35] (GPU +0.11 / +0.06 pp),
  the frame-probe variant +9.62 % [+1.38, +12.60] and +11.01 % [−1.33, +16.79] (GPU +1.18 /
  +1.14 pp in 6/6 quartets, renderer +1.90 / +2.29 pp). The GPU signal moved from the telemetry
  toggle to the frame probe.
- **Frame-probe variant** (`BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1`, methods `toggle` / `both`,
  both platforms, default off because it adds one launch per scenario): a last toggle launch with
  `?telemetry=off`, whose blocks switch only a bare rAF loop with a no-op callback
  (`window.lichtblickTelemetry.setFrameProbeActive`, present only with telemetry off). Report
  `toggleFrameProbe`, same shape and statistics as `toggle`; the viewer and the CI summary show it
  as the sub-row "benchmark FPS probe (harness, not shipped)" with the per-process deltas
  (`gpu +0.94 pp (10/10 ↑)`, mean on − off pp of the included quartets, positive quartets) and no
  verdict. It is never part of `verdicts`.
- **Scenario runs**: `renderer.fps`, `renderer.frames` and `renderer.lateFrames` (the smoothness
  KPIs) come from this loop and so include its cost in every run, with telemetry on. Relative
  comparisons between runs stay valid; absolute CPU of a static scenario is higher than in the
  product by about the frame-probe delta.

**In-page self-cost** (`summary.telemetrySelf`, telemetry-on runs; report `selfCost` = medians of the
`on` arm). The page times its own telemetry work in cumulative counters
(`telemetry.self.timeMs.{collectors,frames,longTasks,sinkPublish,drain,uaMemory}`,
`telemetry.self.uaMemory.{calls,resolveMs,resolved,failures}`). Over the steady window the runner
derives ms/s per component and records/s. A component without a publish at the window start is
measured from its first publish in the window; one without two publishes is left out. The UA probe counts are whole-run totals (the calls start
at collector start and on data source open, before the window): `uaCalls`, `uaResolved`,
`uaFailures` and `uaResolveMsMean` = resolve time / resolved calls (omitted when none resolved). After the run (after the final drain,
outside the window) it calls `measureEmitCost()`, a micro-benchmark of `gauge` / `counter` /
`event` on a throwaway sink, and estimates the emit cost as records/s × mean ns per record
(weighted by the window's record mix). `fractionOfCore = (self ms/s + estimated emit ms/s) / 1000`.
This is a **lower bound**: GC and memory pressure caused by the records are not included. Each run
also records `run.environment.collectors` (`collectorsState()`: whether the UA probe was `on`,
`off`, `unsupported` or `disabled`).

**Env knobs**

| Variable                             | Default | Effect                                                                     |
| ------------------------------------ | ------- | -------------------------------------------------------------------------- |
| `BENCHMARK_OVERHEAD_METHOD`          | `both`  | `toggle`, `relaunch` or `both` (see above; other values fail)              |
| `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS` | 10      | toggle A/B ABBA quartets of 4 blocks (min 4)                               |
| `BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS` | 3000    | toggle block length incl. the 500 ms settle (min 1000)                     |
| `BENCHMARK_OVERHEAD_REPEATS`         | 8       | relaunch: measured repeats per arm (min 1; a verdict needs 6 pairs)        |
| `BENCHMARK_OVERHEAD_WARMUP_RUNS`     | 1       | discarded runs before the measured ones (min 0)                            |
| `BENCHMARK_OVERHEAD_UA_ARM`          | unset   | `1` adds `on-noUa` (relaunch) and a toggle run without UA probe (web only) |
| `BENCHMARK_OVERHEAD_GATE`            | unset   | `1` fails the test on an overall `exceeds` verdict                         |
| `BENCHMARK_OVERHEAD_POLLS`           | 10      | relaunch: steady polls per run (min 5); auto-pause, MCAP length            |
| `BENCHMARK_OVERHEAD_PROFILE_MS`      | 10000   | toggle: direct (JS only) attribution profile after the blocks (`0` = off)  |
| `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM` | unset   | toggle: `1` adds a launch toggling only the benchmark FPS probe's rAF loop |

A relaunch run takes about 25–35 s (launch, render calibration, load, 3 s warm-up, 10 polls,
teardown); each extra poll adds 1 s. With the defaults that is 17 runs per scenario (≈ 8–10 min),
≈ 25–30 min for the three scenarios on one platform; the UA arm adds 8 runs per scenario. Method
`toggle` needs the warm-up runs plus one ≈ 2.5–3 min run per scenario (one more each with the UA
arm and the frame-probe arm). The test timeout scales with
the run count, the poll count and the toggle length (per run: 60 s setup + the auto-pause). Quick
smokes: `BENCHMARK_OVERHEAD_METHOD=toggle BENCHMARK_OVERHEAD_TOGGLE_QUARTETS=4 yarn test:e2e:benchmark overhead -g sinewave`
and `BENCHMARK_OVERHEAD_METHOD=relaunch BENCHMARK_OVERHEAD_REPEATS=1 BENCHMARK_OVERHEAD_WARMUP_RUNS=0 yarn test:e2e:benchmark overhead -g sinewave`
(one pair: always `inconclusive`).

**Report** (schema 3). The relaunch fields (`runs`, `pairs`, `n`, `metrics`, …) describe the
relaunch A/B (`n = 0` for method `toggle`) and `relaunchVerdicts` are its own verdicts. `toggle`
holds the toggle A/B: config, blocks (arm, measured window, CPU %, CPU % per process type, process
set, records per realm, UA calls, toggle latency, flags), `quartets` (off / on blocks, pooled arm CPU, deltas, exclusion),
`n` / `excludedQuartets`, median / IQR / CI95 of the quartets' relative and pp deltas, verdict, the
adjacent `pairs` (diagnostic only), modal process set, `toggleLatencyMsMax` and the renderer records and UA calls
per arm. `toggleWithoutUaProbe` (UA arm only) is a second toggle section without the UA probe,
informational. `toggleFrameProbe` (frame-probe arm only) is the toggle section of the benchmark FPS
probe, harness, no verdict. `directAttribution` (toggle only) is the direct (JS only) attribution above: config
(profile ms, sampling interval, telemetry sources) and either `status: "unsupported"` with the
reason or `status: "measured"` with the metrics, top functions and its own verdict. `verdicts` are the final ones, with `cpuVerdictSource` (`toggle` | `relaunch`) and
`memVerdictSource` (`relaunch` | `notMeasured`); `overall` is the worst of the measured ones. The
viewer, the scorecard and the CI summary show the method, the pairs or quartets and the dispersion of the CPU
verdict's source, `not measured` for memory with method `toggle`, and the relaunch CPU of method
`both`, the toggle without UA probe, the benchmark FPS probe and the direct (JS only) attribution as
sub-rows. A malformed `toggleWithoutUaProbe`, `toggleFrameProbe` or `directAttribution` is dropped
on load; the rest of the report stays valid.

The viewer and the CI summary only read the current schema (3, toggle ABBA quartets). Unreadable
JSON and any other schema version or shape (for example a stale local file from an earlier
development build, a missing `config.arms` or an unknown verdict) is skipped with a warning naming
the file.

## KPI scorecard

`result/kpis.ts` derives per-run KPIs (`summary.kpis`, written by the runner) and aggregates them
per platform. Every value is omitted when its inputs are missing.

| Family     | Per-run fields (`summary.kpis`)                                                                                 | Formula                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stability  | `healthy`, `reasons[]`                                                                                          | passed ∧ 0 runner events ∧ every pool invariant held (or no pool) ∧ 0 dropped telemetry records (runs that hit an error boundary fail and write no result) |
| memory     | `peakTotalWorkingSetMiB`, `workingSetSlopeMiBPerMin?`                                                           | peak per-poll total working set; slope over the steady window (see above)                                                                                  |
| cpu        | `medianCpuPercent`, `cpuSeconds`, `cpuSecondsPerMiB?`                                                           | `cpuSeconds / (pipeline bytesPerSec × measured window s / MiB)`                                                                                            |
| smoothness | `medianFps`, `fpsCeiling?`, `fpsPercentOfCeiling?`, `onTimeFramePercent?`, `longTaskBlockedMsPerSec?`, `lowFps` | `medianFps / fpsCeiling`; `(1 − lateFrames / totalFrames) × 100`; `longTaskTotalMs / run s`; `lowFps` = median FPS < 10                                    |
| startup    | `panelsReadyMs?`, `firstMessageMs?`                                                                             | from `summary.phases`                                                                                                                                      |
| throughput | `ingestMiBPerSec?`, `messagesPerSec?`, `fanout?`                                                                | pipeline received bytes/s in MiB; delivered / received messages                                                                                            |
| renderCost | `worstPanelP90RenderMs?`, `worstPanelId?`, `worstPanelType?`, `p90RenderMsByPanelType`                          | max `renderP90WindowMaxMs` over the run's panels (adapter panels only)                                                                                     |

`ingestMiBPerSec` is what the player delivered to the pipeline: the pipeline counts received bytes,
not delivered bytes.

**Aggregation** (`aggregateKpis`, policies in `SCORECARD_POLICIES`): telemetry-on runs of **one
platform**; electron and web are never aggregated together. Each aggregate reports `n` (runs with a
usable value) and the worst run, which the viewer links. The viewer and the CI summary show a
platform with telemetry-on runs or overhead reports (a platform with only overhead reports has 0
runs and its overhead column).

| Metric                                                                        | Aggregate                                                       | Why                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| stability                                                                     | healthy / total                                                 | target 100 %                             |
| peak memory, median CPU, CPU s/MiB, panels ready, first message, ingest MiB/s | geometric mean                                                  | magnitudes that differ per scenario      |
| memory slope, long-task blocked ms/s, p90 render per panel type               | max                                                             | a leak or a stall in one scenario counts |
| median FPS, % of ceiling, on-time frames                                      | min                                                             | smoothness is as good as its worst run   |
| telemetry overhead                                                            | worst verdict, worst CI95 upper bound (latest A/B per scenario) | target ≤ 2 % CPU, ≤ 20 MiB               |

The geometric mean ignores missing, zero and negative values. It is scale-invariant (a scenario
with large values does not dominate) and gives every scenario equal weight for the same relative
change, which is why SPEC, JetStream and Speedometer use it. Leaks, smoothness, stability and
overhead are about the worst case, so they use min/max instead.

**By group** (`groupKpis`, `GROUP_KPIS`), per platform:

| Group                  | Primary KPI                                                              | Secondary                                                        |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `3d-rendering`         | on-time frames % (min)                                                   | 3D p90 render ms (max), peak memory (geomean)                    |
| `time-series`          | Plot p90 render ms (max); falls back to listener dispatch p90 (labelled) | msg/s, median CPU (geomean)                                      |
| `preloading`           | `phases.preloadDurationMs` (geomean)                                     | block cache peak MiB, memory slope                               |
| `real-pipeline-ingest` | CPU s/MiB (geomean)                                                      | ingest MiB/s, pool evictions, rehydrations, invariant violations |

Plot is not a `PanelExtensionAdapter` panel and emits no render telemetry, so `time-series` currently
always shows the listener-dispatch fallback.

## FPS reference

- **`fpsCeiling`**: before each scenario the runner counts `requestAnimationFrame` callbacks for 2 s
  on `about:blank` in the same browser / Electron window (rounded to 0.1; 0 = no frames). Median
  FPS is shown as `median / ceiling`, so a 60 Hz and a 120 Hz display stay comparable.
- **`glRenderer`**: the unmasked WebGL renderer of that page (`unavailable` without WebGL). The
  viewer shows the backend (Metal, SwiftShader, ...) next to the FPS.
- **Late frames**: a frame is late when it takes longer than `lateFrameThresholdMs` =
  1.5 × 1000 / `fpsCeiling` (e.g. 12.5 ms at 120 Hz). Below a plausible ceiling (< 20) it falls back
  to 25 ms (1.5 × 60 Hz budget).
- **`LOW_FPS_WARNING` = 10**: runs below it get a ⚠ (informational, no target). Web FPS is always
  shown when frames were collected, also when it is low.
- **GPU path**: web on macOS uses Metal via `--use-angle=metal` (the headless shell otherwise falls
  back to SwiftShader); Electron on macOS uses ANGLE Metal by default. On Linux and Windows (CI)
  both use SwiftShader (software rendering), so CI FPS is far below a local GPU.
- **CPU %** is a per-core sum over all processes on both platforms (100 % = one core). Web is still
  higher than Electron: its process set differs (headless browser, SwiftShader GPU on CI). This is
  one more reason the platforms are never aggregated together.

## Viewing results

`yarn test:e2e:benchmark:viewer` writes an **interim**, self-contained HTML report to
`benchmark/.artifacts/report/index.html` and prints its absolute path. It reads only the existing
files: `*.benchmark-result.v1.json`, `overhead-*.json` and `screenshots/*.png`. Chart.js 4.4.8 is
inlined and the report needs no network, so it opens straight from disk.

```sh
yarn test:e2e:benchmark:viewer                 # latest run per scenario × platform × telemetry on/off
yarn test:e2e:benchmark:viewer --all           # every run
yarn test:e2e:benchmark:viewer --dir <path>    # another artifacts folder (e.g. a downloaded CI artifact)
yarn test:e2e:benchmark:viewer --open          # also open it (open / xdg-open / start)
```

Files that are not valid `benchmark-result.v1` (old shapes, broken JSON) are skipped with a warning
and listed in the header. Overhead A/B run results are never shown as runs (also not with `--all`);
the header counts them and the telemetry overhead section links them.

- **Scorecard** (top): one card per KPI family per platform with the aggregate, `n` and a link to
  the worst run. Only stability (100 %) and telemetry overhead have targets and colors; low-FPS
  runs get a ⚠.
- **By group**: group × platform with the primary and secondary KPIs and the scenarios in the group.
- **Overview**: the generation time, the branch and commit at generation time (the results don't
  record them), and one KPI row per telemetry-on scenario × platform. The **Run** column shows when
  the run finished, in UTC (`2026-10-30 16:44Z`, in grey). A run that finished more than 24 h before
  the newest run in the report gets a `stale` hint, because it may predate newer metrics. The
  remaining columns: peak total memory,
  median CPU, peak JS heap, first message, first useful frame, layout applied, panels ready, median
  FPS, pipeline msg/s and MiB/s, source cache hit ratio, pool invariant, runner events and telemetry
  overhead. Only the values with a target are colored: overhead (by verdict: green `within`, amber
  `inconclusive`, red `exceeds`), runner events (red when > 0) and the pool invariant. The latest
  overhead A/B per scenario × platform is listed below the KPIs: pairs or toggle quartets (excluded), CPU Δ median
  [CI95] and IQR, CPU Δ pp, memory Δ median [CI95], a verdict badge, flags (window-mismatch runs
  with their reasons, e.g. `r1 on: 2 overrun(s)`, process-set mismatches, the longest host poll), the in-page self-cost, the main-thread Δ and, with the UA arm, the UA
  probe rows. Chips under each scenario name show its
  group, tags, panel types (`3D ×6`) and player. Clicking a group or tag chip (or one in the
  filter bar) filters the overview rows, coverage rows and run sections; "all" resets.
- **Coverage**: scenario × (panel types ∪ players ∪ pipeline components). ✓ = observed in
  telemetry, ○ = declared by the scenario only.
- **Runs**: one collapsible section per run; the first is open and the KPI rows link to the rest.
  Each starts with an **Exercises** card (description, layout, data source, player, params,
  declared vs observed panels, observed pipeline components) and the run's `summary.kpis`.
  The charts share an x axis in seconds from the phases origin. Dashed vertical lines mark
  `layout.applied`, open, first message, first useful frame, preload and playback start/end, panels
  ready and runner events. The charts are:
  - memory per process type (stacked) with the total;
  - renderer JS heap used / total / limit;
  - pipeline received and delivered msg/s, with received MiB/s on the second axis;
  - block cache and source cache bytes;
  - HydratedSourcePool resident bytes, count and pins;
  - per-panel render mean per window (Δsum / Δcount);
  - per-panel delivered msg/s (current frame + range).

  The section then has the screenshots (thumbnails linking to `../screenshots/`), and tables for
  panels, phases, pipeline, processes and renderer, pools, runner events and environment.

- Each dataset is downsampled to ≤ 600 points (per-bucket min/max, so spikes survive).

In CI, both jobs generate the report after the summary (`if: always()`) and upload it in the
`benchmark-results-electron` / `benchmark-results-web` artifact. Download it, unzip it and open
`report/index.html`; the screenshot links resolve because `screenshots/` sits next to `report/`.

This viewer is a stopgap: the definitive results dashboard is planned as a follow-up.

### Analyzing results with AI

The analysis-only `@lb-benchmark-analyst` agent
([`.github/agents/lb-benchmark-analyst.agent.md`](../.github/agents/lb-benchmark-analyst.agent.md))
interprets the result and overhead JSON files, correlates metric evidence (file → JSON path) with
code evidence (`path:line`), compares against an optional baseline directory and proposes ranked
hypotheses and experiments; it never edits files and routes fixes to the owning agent. Its
knowledge base is the `benchmark-analysis` skill
([`.github/skills/benchmark-analysis/SKILL.md`](../.github/skills/benchmark-analysis/SKILL.md)),
which maps every telemetry metric, event and KPI to its producer. Example:

```
@lb-benchmark-analyst analyze benchmark/.artifacts against <baseline dir>
```

A baseline can be a downloaded CI artifact (`benchmark-results-electron` /
`benchmark-results-web`) or a local run of the base commit.

## CI

`.github/workflows/e2e-benchmark.yml` runs on pushes to `develop` and `main`, and on manual
dispatch (`workflow_dispatch`, "Run workflow" in the Actions tab):

- `e2e-benchmark`: Electron under xvfb
- `e2e-benchmark-web`: headless Chromium

On push both jobs run `yarn test:e2e:benchmark[:web]:ci scenarios`, i.e. the scenarios spec only.
A manual run takes these inputs:

| Input      | Default     | Effect                                                                                     |
| ---------- | ----------- | ------------------------------------------------------------------------------------------ |
| `suite`    | `scenarios` | `scenarios` or `overhead` (the telemetry overhead A/B, `overhead.benchmark.spec.ts`)       |
| `platform` | `both`      | `both`, `electron` or `web` (skips the other job)                                          |
| `method`   | `both`      | overhead only: `BENCHMARK_OVERHEAD_METHOD` (`toggle`, `relaunch` or `both`)                |
| `quartets` | blank       | overhead only: `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS` (blank: default 10)                    |
| `repeats`  | blank       | overhead only: `BENCHMARK_OVERHEAD_REPEATS` (blank: default 8; a relaunch verdict needs 6) |

The overhead suite takes ≈ 35–40 min per platform locally with the defaults (see
[Specs: scenarios vs overhead](#specs-scenarios-vs-overhead)) and likely longer on the CI runner
(software rendering), so its jobs time out after 240 min; `method: toggle` is much shorter. It
gives overhead evidence on CI hardware: the overhead reports are uploaded with the other artifacts
and shown in the job summary and the HTML report. Like the local run, it is report only (no gate).
A manual run is only available once the workflow file is on the default branch.

Each job adds `yarn test:e2e:benchmark:summary` to the job summary. It starts with a compact KPI
scorecard per platform and one "Exercises" line per scenario, then covers the legacy table,
the v1 results table, the panels and pipeline section, and the overhead table when overhead reports
are present (push runs read "No overhead reports found."). Each job then
generates the HTML report (see [Viewing results](#viewing-results)) and adds a pointer to it in the
job summary. Finally it uploads `benchmark/.artifacts/**/*.json`, the checkpoint screenshots in
`benchmark/.artifacts/screenshots/` and `benchmark/.artifacts/report/`, excluding the fixtures.

## Deferred

These are out of scope for this work and planned as follow-ups:

- quiescent (idle) memory baselines
- `panel.ready` and other per-panel phase events
- deeper Plot/StateTransitions panel instrumentation, network instrumentation and detailed
  pipeline internals

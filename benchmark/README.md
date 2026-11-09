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
`yarn test:e2e:benchmark scenarios -g sinewave` and `yarn test:e2e:benchmark:web scenarios -g mcap`.
CI variants (`test:e2e:benchmark:ci`, `test:e2e:benchmark:web:ci`) set `CI=true` and write
`benchmark/e2e/reports/results-<platform>.json`. They take the same filters; the workflow passes
`scenarios` (see [CI](#ci)).

The unit tests for the runner's pure logic (static server, fixture generator, schema builder and
validator, collector parsing, crash detection, summary, HTML viewer) run under the `benchmark-e2e` Jest project:
`yarn jest --selectProjects benchmark-e2e`.

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
  `TelemetryBatch.dropped`. These counts end up in the result's `dropped`.
- **Activation.** Telemetry is installed only by the benchmark app. `?telemetry=off` disables it
  (telemetry-off runs). The legacy frame-time hook
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
  (`pointcloud`, `transform` on web), the 1 Hz loop can get only 3–4 polls in a 5 s window.
- On Windows the web collector cannot read RSS (no `ps`), so only CPU is reported. It logs a
  warning once.

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
`PIPELINE_TELEMETRY_METRICS` (`packages/suite-base/src/components/MessagePipeline/constants.ts`),
which the benchmark summaries (`e2e/result/`) import.

## The E2E runner

```
benchmark/e2e/
├── playwright.config.ts          projects "electron" and "web"
├── scenarios.benchmark.spec.ts   one test per scenario under test (+ web crossOriginIsolated check)
├── fixtures/                     Playwright fixtures, Electron/web targets, MCAP generator
├── server/staticServer.ts        Node http static server (Range, COOP/COEP/CORP/CORS, SPA fallback)
├── runner/                       runScenario, host collectors, artifacts, crashDetection, scenariosUnderTest
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
| `<scenarioId>-<platform>[-telemetry-off]-<ts>.benchmark-result.v1.json`     | Result schema v1 (below)                                                                                                                                                                                                                                                                                               |
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
rendered until dismissed, so this one check catches a crash from any point of the run, without
affecting any metric.

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
              openDurationMs?, preloadDurationMs?, layoutAppliedMs?, panelsReadyMs?,
              panelsReadyCoverage?: { mounted, firstRendered } },
    panels?: Record<panelId, { panelType, mountedAtMs?, unmountedAtMs?, firstRenderMs?, mounts,
              messages, messageBytes, rangeMessages, rangeBytes, renders?, renderMeanMs?,
              renderMaxMs?, renderP90WindowMaxMs?, skipped? }>,
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
  non-negative integer.
- **Older artifacts** load in `"lenient"` mode (viewer, CI summary): a missing `run.scenario` is
  shown as "scenario not recorded" (observed telemetry only), missing `logicalCpus` and
  calibration as "not recorded", and missing `summary.kpis` are recomputed from the other summaries (`withRunKpis`) and
  marked "recomputed".

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
usable value) and the worst run, which the viewer links.

| Metric                                                                        | Aggregate                                                       | Why                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| stability                                                                     | healthy / total                                                 | target 100 %                             |
| peak memory, median CPU, CPU s/MiB, panels ready, first message, ingest MiB/s | geometric mean                                                  | magnitudes that differ per scenario      |
| memory slope, long-task blocked ms/s, p90 render per panel type               | max                                                             | a leak or a stall in one scenario counts |
| median FPS, % of ceiling, on-time frames                                      | min                                                             | smoothness is as good as its worst run   |

The geometric mean ignores missing, zero and negative values. It is scale-invariant (a scenario
with large values does not dominate) and gives every scenario equal weight for the same relative
change, which is why SPEC, JetStream and Speedometer use it. Leaks, smoothness and stability are
about the worst case, so they use min/max instead.

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
files: `*.benchmark-result.v1.json` and `screenshots/*.png`. Chart.js 4.4.8 is
inlined and the report needs no network, so it opens straight from disk.

```sh
yarn test:e2e:benchmark:viewer                 # latest run per scenario × platform × telemetry on/off
yarn test:e2e:benchmark:viewer --all           # every run
yarn test:e2e:benchmark:viewer --dir <path>    # another artifacts folder (e.g. a downloaded CI artifact)
yarn test:e2e:benchmark:viewer --open          # also open it (open / xdg-open / start)
```

Files that are not valid `benchmark-result.v1` (old shapes, broken JSON) are skipped with a warning
and listed in the header.

- **Scorecard** (top): one card per KPI family per platform with the aggregate, `n` and a link to
  the worst run. Only stability (100 %) has a target and colors; low-FPS runs get a ⚠.
- **By group**: group × platform with the primary and secondary KPIs and the scenarios in the group.
- **Overview**: the generation time, the branch and commit at generation time (the results don't
  record them), and one KPI row per telemetry-on scenario × platform. The **Run** column shows when
  the run finished, in UTC (`2026-10-30 16:44Z`, in grey). A run that finished more than 24 h before
  the newest run in the report gets a `stale` hint, because it may predate newer metrics. The
  remaining columns: peak total memory,
  median CPU, peak JS heap, first message, first useful frame, layout applied, panels ready, median
  FPS, pipeline msg/s and MiB/s, source cache hit ratio, pool invariant and runner events. Only the
  values with a target are colored: runner events (red when > 0) and the pool invariant. Chips
  under each scenario name show its
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

## CI

`.github/workflows/e2e-benchmark.yml` runs on pushes to `develop` and `main`:

- `e2e-benchmark`: Electron under xvfb
- `e2e-benchmark-web`: headless Chromium

Both jobs run `yarn test:e2e:benchmark[:web]:ci scenarios`.

Each job adds `yarn test:e2e:benchmark:summary` to the job summary. It starts with a compact KPI
scorecard per platform and one "Exercises" line per scenario, then covers the legacy table,
the v1 results table and the panels and pipeline section. Each job then
generates the HTML report (see [Viewing results](#viewing-results)) and adds a pointer to it in the
job summary. Finally it uploads `benchmark/.artifacts/**/*.json`, the checkpoint screenshots in
`benchmark/.artifacts/screenshots/` and `benchmark/.artifacts/report/`, excluding the fixtures.

## Deferred

These are out of scope for this work and planned as follow-ups:

- quiescent (idle) memory baselines
- `panel.ready` and other per-panel phase events
- deeper Plot/StateTransitions panel instrumentation, network instrumentation and detailed
  pipeline internals

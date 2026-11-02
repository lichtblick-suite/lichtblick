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
`benchmark/e2e/reports/results-<platform>.json`.

The unit tests for the runner's pure logic (static server, fixture generator, schema builder and
validator, collector parsing, overhead, crash detection, summary, HTML viewer) run under the `benchmark-e2e` Jest project:
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
- **Activation.** Telemetry is installed only by the benchmark app. `?telemetry=off` disables it,
  which is used as the baseline in the overhead A/B. The legacy frame-time hook
  (`window.recordFrameTimes`) works with telemetry on or off.

### What is collected

| Layer                    | Source                                                                                                                                                                                                                                         | Metrics / events                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host / process           | **Electron**: `app.getAppMetrics()` through `window.lichtblickBenchmark.getMemoryMetrics()`. **Web**: CDP `SystemInfo.getProcessInfo` (process list, CPU time) plus `ps -o pid=,rss=` (RSS). If CDP fails, the browser process tree from `ps`. | `process.workingSetBytes`, `process.peakWorkingSetBytes`, `process.privateBytes` (Electron on Windows only), `process.cpuPercent` (percent of one core), labels `{processType: browser\|renderer\|gpu\|utility\|…, pid}`, realm `runner`, scope `process`                           |
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
- Web runs in headless Chromium use **SwiftShader** (software GL). That makes the `gpu` process
  CPU very high (hundreds of percent) and makes CPU noisy. Compare web CPU only to other web
  runs.
- Host polling and drains run through `page.evaluate`. Under heavy rendering (`pointcloud`,
  `transform` on web), the 1 Hz loop can get only 3–4 polls in a 5 s window.
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
├── overhead.benchmark.spec.ts    telemetry off/on A/B (report only)
├── fixtures/                     Playwright fixtures, Electron/web targets, MCAP generator
├── server/staticServer.ts        Node http static server (Range, COOP/COEP/CORP/CORS, SPA fallback)
├── runner/                       runScenario, host collectors, artifacts, overhead, crashDetection, scenariosUnderTest
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

| File                                                                        | Content                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<scenarioId>-<ts>.json` (Electron), `<scenarioId>-web-<ts>.json` (web)     | Legacy `BenchmarkArtifact` (unchanged shape). On web, `memorySamples[].metrics` are ProcessMetric-like `{pid, type, memory:{workingSetSize, peakWorkingSetSize} (KB), cpu:{percentCPUUsage}}` (memory is 0 when unavailable) |
| `<scenarioId>-<platform>[-telemetry-off]-<ts>.benchmark-result.v1.json`     | Result schema v1 (below). The overhead spec writes one per run, with `-telemetry-off` for the baseline                                                                                                                       |
| `overhead-<platform>-<scenarioId>-<ts>.json`                                | Overhead A/B report                                                                                                                                                                                                          |
| `screenshots/<scenarioId>-<platform>[-telemetry-off]-<ts>-<checkpoint>.png` | Viewport screenshots of the scenarios spec runs, `<checkpoint>` = `end` by default, plus `loaded` and `mid` with `BENCHMARK_SCREENSHOTS=all` (see [Screenshots](#screenshots))                                               |
| `fixtures/`                                                                 | Generated MCAP fixtures. CI does not upload these                                                                                                                                                                            |

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

| `type`            | Source                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `renderer.crash`  | `page.on("crash")` (web and Electron)                                                                    |
| `process.gone`    | Electron only: main-process `app.on("render-process-gone")` (`processType: "renderer"`) and `app.on("child-process-gone")` (`processType` = `details.type`), with `reason` and `exitCode`. `reason: "clean-exit"` is ignored |
| `renderer.reload` | Main-frame `framenavigated` to a **new document** after the app was ready                                |

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
         environment: { os, arch, ci, userAgent?, electronVersion?, chromiumVersion?, cpuModel,
                        totalMemBytes, crossOriginIsolated? } },
  samples: TelemetrySample[],   // page + worker + host process + listenerDispatchDurationMs, sorted by monotonicTs
  events: TelemetryEvent[],
  dropped: Record<realm, number>,
  sequenceGaps: Record<realm, number>,
  runnerEvents?: { type: "renderer.crash" | "process.gone" | "renderer.reload", monotonicTs,
                   reason?, processType?, exitCode?, url? }[],   // see Crash detection; [] = none
  summary: {
    process: { sampleCount, peakTotalWorkingSetBytes, meanTotalWorkingSetBytes, medianTotalCpuPercent,
               byType: Record<processType, { peakWorkingSetBytes, medianCpuPercent }> },
    renderer: { peakJsHeapUsedBytes?, lastUaSpecificMemoryBytes?, medianFps?, lateFrames?, longTasks? },
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
    runnerEvents?: { "renderer.crash", "process.gone", "renderer.reload" } } }   // counts
```

- Process totals are summed per poll, across all processes of that poll. Peak and mean are taken
  over polls. CPU is percent of one core, so the total can exceed 100. Percentiles use a sorted
  nearest rank.
- `invariantHolds` checks `acquires − releases − terminatedPins === activePins` at every published
  `activePins` snapshot and at the final values. Pools are keyed by realm, because pool ids are
  only unique within a worker.
- `phases` and the panel times are measured in ms from `datasource.open` start, or from
  `app.ready` when the run has no `datasource.open` (synthetic players). `phases.origin` says which.
- `panelsReadyMs` is the latest `panel.firstRender` among the panels that emitted one, else the
  latest `panel.mount`. Only `PanelExtensionAdapter` panels emit `panel.firstRender`, so check
  `panelsReadyCoverage`.
- Panel and pipeline totals come from the counters' last cumulative value per series. Rates use the
  measured window (`startMonotonicTs` to `windowEndMonotonicTs`). Render and listener-dispatch
  durations are `observe()` series (`.count`/`.sum`/`.max` per 1 Hz window): mean = Σsum / Σcount,
  max = max of `.max`, and `*P90WindowMaxMs` = p90 of the per-window `.max` (a spike indicator).
  Fields without data are omitted.
- `validateResultV1(obj)` returns a list of problems. The scenarios spec asserts the list is empty.

### Telemetry overhead (report only)

`overhead.benchmark.spec.ts` runs `sinewave` and `mcap-multi-ingest` twice on each platform:
first with `?telemetry=off`, then with telemetry on. Each run gets a fresh browser or Electron app,
and the first is closed before the second starts, so the two never compete for CPU.

From the host samples it computes these values:

- `cpuDeltaPctPoints = onMedian − offMedian`, using the median per-poll total CPU percent
- `cpuDeltaRelative = cpuDeltaPctPoints / offMedian`. The target is **≤ 2%** relative to the
  telemetry-off median.
- `memDeltaBytes = onMean − offMean`, using the mean per-poll total working set. The target is
  **≤ 20 MiB**.

The report includes `within: {cpu, memory}` and `withinTargets`. **The suite never fails on these
targets** unless `BENCHMARK_OVERHEAD_GATE=1` is set. Single A/B runs on shared CI runners are noisy,
especially CPU on web with SwiftShader. Use repeated runs before treating a delta as real.

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
and listed in the header.

- **Overview**: the generation time, the branch and commit at generation time (the results don't
  record them), and one KPI row per telemetry-on scenario × platform. The **Run** column shows when
  the run finished, in UTC (`2026-10-30 16:44Z`, in grey). A run that finished more than 24 h before
  the newest run in the report gets a `stale` hint, because it may predate newer metrics. The
  remaining columns: peak total memory,
  median CPU, peak JS heap, first message, first useful frame, layout applied, panels ready, median
  FPS, pipeline msg/s and MiB/s, source cache hit ratio, pool invariant, runner events and telemetry
  overhead. Only the values with a target are colored: overhead (green within target, amber above
  80 % of it, red over it), runner events (red when > 0) and the pool invariant. The latest overhead
  A/B per scenario × platform is listed below the KPIs.
- **Runs**: one collapsible section per run; the first is open and the KPI rows link to the rest.
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

Each job adds `yarn test:e2e:benchmark:summary` to the job summary. That covers the legacy table,
the v1 results table, the panels and pipeline section, and the overhead table. Each job then
generates the HTML report (see [Viewing results](#viewing-results)) and adds a pointer to it in the
job summary. Finally it uploads `benchmark/.artifacts/**/*.json`, the checkpoint screenshots in
`benchmark/.artifacts/screenshots/` and `benchmark/.artifacts/report/`, excluding the fixtures.

## Deferred

These are out of scope for this work and planned as follow-ups:

- quiescent (idle) memory baselines
- `panel.ready` and other per-panel phase events
- deeper Plot/StateTransitions panel instrumentation, network instrumentation and detailed
  pipeline internals

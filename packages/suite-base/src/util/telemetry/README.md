# Benchmark telemetry (`util/telemetry`)

A small, local metrics and events API used to measure Lichtblick while it runs a benchmark. It is
**not** product analytics:

- It is unrelated to the app's `IAnalytics` abstraction and to the OpenTelemetry implementation in
  [`services/telemetry/`](../../services/telemetry), which have their own opt-in model.
- It never sends anything over the network. Records stay in an in-memory ring buffer until the
  code that installed the sink drains them.
- Only the benchmark app installs a sink. In the product every call site sees the no-op sink.

## How it is wired

- `getTelemetry()` returns the sink of the current JS realm (main thread or worker). The default is
  `NOOP_TELEMETRY`, whose `isEnabled()` returns `false` and whose methods do nothing.
- `setTelemetrySink(sink)` installs a sink for the current realm; `setTelemetrySink(undefined)`
  restores the no-op. Install it before the app renders and before players are created: some
  instrumentation reads `isEnabled()` only once (see the JSDoc of `setTelemetrySink`).
- The benchmark app (`benchmark/src/telemetry`, `installBenchmarkTelemetry`) installs a
  `BufferedTelemetrySink` on the main thread and drains it from the benchmark harness.
- Workers have their own realm. When the main-thread sink is enabled,
  `WorkerSerializedIterableSource` asks its worker to install a `BufferedTelemetrySink` with realm
  `worker:<n>`, drains it periodically and once more on `terminate()`, and forwards each batch to
  the main sink with `ingest()`.

## Rules for call sites

- Check `getTelemetry().isEnabled()` first and return early, before building labels or values, so
  the disabled path does no work and allocates nothing.
- Use only allow-listed label keys (`labels.ts`). The sink caps the number of label sets per metric
  name (`DEFAULT_MAX_SERIES_PER_METRIC`); excess series are rejected and counted in
  `telemetry.rejectedRecords{reason}`.
- Metric names are stable: benchmark reports key on them. The `telemetry.*` self-metrics in
  `TELEMETRY_SELF_METRICS` are reserved.

## Drops

The ring buffer is bounded. On overflow the oldest record is dropped and counted in the sink's
`drain().dropped` and in `telemetry.droppedRecords{realm}`. These count only the sink's own
drops. Drops reported by batches it ingested from another realm are kept apart in
`telemetry.ingestedDroppedRecords{realm}`: they are the same drops that realm also reports in its
own `droppedRecords`, so consumers take the max of the two per realm, never the sum.

# Telemetry PoC stack

A local OpenTelemetry collector + Prometheus + Loki + Grafana stack for the telemetry
proofs of concept. **Not for production use** — no auth, no origin locking, no retention
policy. Referenced from the warning `TelemetryProvider` logs when telemetry is enabled but
no collector endpoint was compiled into the build.

## 1. Run the stack

```bash
docker compose -f docs/telemetry/poc/docker-compose.yml up
```

This starts five containers, wired together by `docker-compose.yml`:

| Service         | Port | Role                                                                        |
| --------------- | ---- | ---------------------------------------------------------------------------- |
| otel-collector  | 4318 | OTLP/HTTP receiver — the app talks to this (`otel-collector.yaml`)            |
| prometheus      | 9090 | Metric storage (`prometheus.yml`)                                             |
| loki            | 3100 | Log/event storage                                                            |
| loki-cors-proxy | 3101 | CORS shim in front of Loki, for `heatmap/index.html` only (Loki has no CORS support of its own) |
| grafana         | 3000 | Dashboards, anonymous admin login, provisioned from `grafana/`                |

Shut it down with `docker compose -f docs/telemetry/poc/docker-compose.yml down -v`.

## 2. Build the app against it

`OTLP_ENDPOINT` is a **build-time** value (see `constants/config.ts` and the `DefinePlugin`
entry in `webpack.ts`), so it must be set before starting the dev server, not just before
opening the app — a page refresh alone will not pick up a new value.

```bash
OTLP_ENDPOINT=http://localhost:4318 yarn web:serve
```

## 3. Opt in

Telemetry fails closed: even a build with an endpoint compiled in stays a no-op
(`NullAnalytics`) until a user opts in. Enable it from the running app:

**Settings → Privacy → "Send anonymous usage telemetry"** (`AppSetting.TELEMETRY_ENABLED`).

## 4. View data

Open [http://localhost:3000](http://localhost:3000) → Dashboards → **Lichtblick PoC** folder →
**Lichtblick Telemetry [PoC]**.

- **A1–A5** — the base telemetry PoC: weekly active users, session duration, top panels by
  type, renderer heap, renderer-gone reasons.
- **A6–A9** — the interaction heatmap PoC: interactions by panel type, top/least-used
  controls, and a distinct-device-count check used as a k-anonymity guard. See
  `docs/telemetry/interaction-heatmap-poc-plan.md` for the design and
  `docs/telemetry/poc/heatmap/` for the spatial (click-position) view, which is a standalone
  page rather than a Grafana panel.

## Troubleshooting

- **No data at all**: confirm telemetry is enabled in Settings → Privacy, and that the app
  was rebuilt (not just reloaded) after setting `OTLP_ENDPOINT`.
- **Grafana panels blank but the collector is receiving data**: check the `otel-collector`
  container logs — the `debug` exporter (`otel-collector.yaml`) prints every batch it
  receives, which tells you whether the problem is upstream (app → collector) or downstream
  (collector → Prometheus/Loki).

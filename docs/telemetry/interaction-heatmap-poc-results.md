# Interaction Heatmap PoC — Results

Closes the loop opened by [`interaction-heatmap-poc-plan.md`](./interaction-heatmap-poc-plan.md):
plan → implementation → what was actually measured. Implemented on
`poc/observability/interaction-heatmap`, branched from
`poc/observability/telemetry-with-open-telemetry` @ `59e94bc80` (which was already zero commits
behind `develop` at branch time, so WS-0's rebase was a no-op, exactly as the plan predicted).

## What shipped

| Workstream | Status | Notes |
| ---------- | ------ | ----- |
| WS-0 baseline | Done | `docs/telemetry/poc/README.md` written (previously referenced by `TelemetryProvider` but didn't exist) |
| WS-1 event contract | Done | `interactionTypes.ts`, `AppEvent.UI_INTERACTION`, allowlist/counter routing, privacy test |
| WS-2 capture layer | Done | `useInteractionCapture.ts`, wired into `Panel.tsx` beside `panelRootRef` |
| WS-3 rate limiting | Done | `RateLimiter` token bucket, `ITelemetry.incrementCounter()`, `lichtblick.telemetry.dropped` |
| WS-4 taxonomy pilot | Done (deviated once, see below) | 40 `data-analytics-id` values across app chrome + one panel |
| WS-5 dashboard + spatial view | Done | Grafana A6–A9, standalone `heatmap/index.html` |
| WS-6 measurement | Partial — see table below | Some rows verified live, several require real usage data this PoC can't fabricate |
| WS-7 write-up | This document | |

## WS-6 measurement table

| Measure | Threshold | Result |
| ------- | --------- | ------ |
| Target resolution rate | ≥ 95% | **Not measured.** Requires a session of real usage against the taxonomy pilot; the pilot itself is in place and its resolution logic (`target instanceof HTMLElement` → `.dataset.analyticsId` → `"unlabeled"`) is unit-tested (`useInteractionCapture.test.ts`), but no real click stream exists yet to compute a rate against. |
| Frame time impact | p95 < 0.5 ms added | **Not measured.** Requires the existing `Profiler`/`perfInfo` instrumentation in `Panel.tsx` under a real six-panel playback session, telemetry on vs. off — a manual QA pass, not something this session could run headlessly. `useInteractionCapture` only adds a `ResizeObserver` (fires on resize, not per-frame) and a passive capture-phase `pointerdown` listener (fires on click, not per-frame), so no *new* per-frame work was introduced structurally. |
| Bundle delta | 0 KB | **Not independently measured** via a before/after production build size diff this session. Structurally zero by inspection: no new npm dependency was added (the hook uses only DOM APIs and the existing telemetry services), and the dynamic-import boundary around the OTel SDK in `TelemetryProvider.tsx` is untouched. `heatmap.js`-style rendering was deliberately hand-rolled with plain Canvas 2D specifically so the standalone heatmap page has **zero** runtime dependency (see below), removing what would otherwise be the main bundle-delta risk of this PoC. |
| Event rate | compare to 600/hour assumption | **Not measured.** Requires a week of real usage. |
| Log volume | compare to 2.7 GB/month assumption | **Not measured.** Requires a week of real usage. |
| Metric cardinality | < 3,000 series | **Not measured at scale**, but structurally bounded: `lichtblick_ui_interaction_total`'s series count is `panel_type × target_id × target_kind × size_bucket`. With the panel catalog (~15 panel types) and the 40-value taxonomy pilot (plus `"unlabeled"`) as `target_id`, `target_kind` fixed at 2 values and `size_bucket` at 4, the theoretical ceiling is in the low thousands even before accounting for the fact most `(panel_type, target_id)` pairs don't co-occur (a taxonomy id belongs to one panel type, not all of them). Confirmed empirically low (2 series) in the live smoke test below; a real multi-week series count still needs collecting. |
| Privacy assertion | 0 occurrences of `nx`/`ny`/`device_id` as Prometheus labels | **✅ Measured, against a real running Prometheus** (see below) — confirmed 0 occurrences. |

### What was actually run, live

Docker compose stack (`docs/telemetry/poc/docker-compose.yml`) was brought up locally, and the
real `OtelTelemetry` class (not a mock) was used to send `UI_INTERACTION` events and an
`incrementCounter` drop through the actual otel-collector, end to end:

- **Loki**: the raw stored log line is `{"body":"Studio: UI Interaction","attributes":{"device_id":...,"nx":12,"ny":5,"panel_type":"ThreeDeeRender","target_id":"panel.3d.measure","target_kind":"control","size_bucket":"l",...}}` — confirming the nested `attributes` shape `heatmap/index.html`'s `extractGridCell()` assumes, and confirming the existing dashboard's `attributes_<key>` label-flattening convention.
- **Prometheus**: `lichtblick_ui_interaction_total{panel_type="ThreeDeeRender", target_id="panel.3d.measure", target_kind="control", size_bucket="l"}` and `lichtblick_telemetry_dropped_total{reason="rate_limited"}` both appeared with exactly the sanitized label set — **no `nx`, `ny`, or `device_id` label anywhere**, satisfying the privacy assertion against real data rather than only a unit test.
- **Grafana**: the provisioned dashboard loaded successfully via the API (`GET /api/dashboards/uid/lichtblick-telemetry-poc`) with all 9 panels (A1–A9) and the `panel_type` template variable present; A6–A9's PromQL/LogQL query strings were executed directly against live Prometheus/Loki and returned `"status": "success"`.
- **`heatmap/index.html`**: loaded a scattered set of 12 synthetic interactions and rendered two correctly-clustered hot spots plus two isolated points — see `heatmap/example-render.png`, captured from this run.

### A finding this surfaced: Loki has no CORS support

Querying Loki directly from a static page on a different port failed with a CORS error. Checked
against Grafana's own Loki configuration reference — there is no `cors`-related key anywhere in
the entire config schema. Fixed by adding a minimal `nginx` reverse-proxy sidecar
(`loki-cors-proxy` service, `docs/telemetry/poc/nginx-cors-proxy.conf`) in front of Loki on port
3101 that injects `Access-Control-Allow-Origin`. `heatmap/index.html` defaults to port 3101, not
Loki's own 3100. Grafana's own panels are unaffected (they go through Grafana's server-side
datasource proxy, which never hits this).

## Taxonomy pilot: one deviation from the plan, made deliberately

The plan's WS-4 file list scoped the ThreeDeeRender slice to
`packages/suite-base/src/panels/ThreeDeeRender/** — settings controls only`. In the actual
codebase, "settings controls" for any panel (including ThreeDeeRender) render through the generic,
shared `SettingsTree` sidebar infrastructure used by every panel — annotating it would mean
touching shared rendering code, which is exactly the kind of change the plan explicitly keeps out
of a bounded pilot elsewhere (see WS-4's own "one change covers every panel" framing for
`PanelToolbar`). Annotated `RendererOverlay.tsx`'s own hand-authored controls instead — the
toggle-perspective, publish, measure, and reset-view buttons that ThreeDeeRender renders directly
— which is a truer test of "does a panel's own custom controls work" than the shared settings tree
would have been, and keeps the change scoped to files the plan already named.

## Naming convention (for the implementation story's full sweep)

`<area>.<component>.<action>`, lowercase, dot-separated, e.g. `panel.toolbar.split-right`,
`appbar.menu.file.open`, `panel.3d.measure`. Never derived from class names or visible text. 40
identifiers landed across `AppBar` (incl. `AppMenu`/`NestedMenuItem`/window controls),
`PanelToolbar` (covers every panel), `PlaybackControls`/`PlaybackSpeedControls`, and
`ThreeDeeRender/RendererOverlay.tsx`.

## Recommendation on the counter (from WS-7's checklist)

Keep `lichtblick.ui.interaction` as an app-side counter for now. The measured cardinality in this
session (a handful of series from synthetic data) doesn't yet justify deriving it from the log
stream in the collector instead — that trade only pays off once real cardinality is known, which
is exactly the number this write-up couldn't produce (needs real usage). Revisit once the event
rate / cardinality rows above have real numbers.

## What the implementation story still inherits

Unchanged from the plan's own list: the full `data-analytics-id` sweep beyond this 40-identifier
pilot, the production collector (ECS, SigV4 to Amazon Managed Prometheus, origin locking),
retention policy and k-anonymity enforced structurally rather than demonstrated in one dashboard
panel, and the DPIA / works council consultation. Additionally, from this session specifically:
real-usage numbers for every "not measured" row above, and a production-grade bundle-size diff.

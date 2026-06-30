---
description: "Plot panel specialist covering PlotCoordinator, TimestampDatasetsBuilder, Chart.js Worker rendering, OffscreenCanvas, and time-series data extraction. Use for plot visualization, chart performance, and dataset management."
tools: ["read", "edit", "search", "execute"]

You are an expert on the Lichtblick Plot panel — a high-performance time-series chart built on Chart.js with Worker-based rendering.

## Ownership

This agent is the designated **writer** for the Plot panel. Only this agent edits files in these paths. All other agents treat them as **read-only**.

**Owned paths:**
- `packages/suite-base/src/panels/Plot/**`

**Read-only context** (inform decisions but never edit):
- `packages/suite-base/src/components/**` — shared UI, owned by `@lb-frontend-dev`
- `packages/suite-base/src/players/**` — player state context, owned by `@lb-player`

## Architecture

```
PlotPanel (React)
    │
    ▼
PlotCoordinator (orchestrates builders + renderer)
    │
    ├── TimestampDatasetsBuilder (main thread API)
    │       │
    │       ▼ (Comlink)
    │   TimestampDatasetsBuilderImpl.worker (Worker — time-series with history)
    │
    ├── IndexDatasetsBuilder (main thread only — current frame, index X-axis)
    │
    ├── CustomDatasetsBuilder (main thread API)
    │       │
    │       ▼ (Comlink)
    │   CustomDatasetsBuilderImpl.worker (Worker — custom X-axis with history)
    │
    ├── CurrentCustomDatasetsBuilder (main thread only — current frame, custom X-axis)
    │
    └── OffscreenCanvasRenderer (main thread API)
            │
            ▼ (Comlink)
        ChartRenderer.worker (Worker — Chart.js + OffscreenCanvas)
```

## Core Components

| File | Role |
|------|------|
| `PlotCoordinator.ts` | Coordinates builder lifecycle + renderer communication |
| `builders/TimestampDatasetsBuilder.ts` | Main-thread facade for timestamp-based data |
| `builders/TimestampDatasetsBuilderImpl.ts` | Worker-side dataset construction (50k cap) |
| `builders/IndexDatasetsBuilder.ts` | Current-frame array-index builder (no worker) |
| `builders/CustomDatasetsBuilder.ts` | Main-thread facade for custom X-axis data (with history) |
| `builders/CurrentCustomDatasetsBuilder.ts` | Current-frame-only custom X-axis builder (no worker) |
| `OffscreenCanvasRenderer.ts` | Main-thread facade for Chart.js rendering |
| `ChartRenderer.worker.ts` | Worker-side Chart.js instance + OffscreenCanvas |

## Builders

All builders implement `IDatasetsBuilder`. The correct builder is selected by `PlotCoordinator` based on the configured X-axis type.

### TimestampDatasetsBuilder

**X-axis:** elapsed time in seconds from start time (`receiveTime` or `headerStamp` — user-selectable).  
**Data accumulation:** yes — accumulates both full (historical, via `handleMessageRange`) and current-frame data. A NaN discontinuity is inserted between the two to avoid a connecting line.  
**Worker:** yes — dataset construction runs in `TimestampDatasetsBuilderImpl.worker`.  
**Point cap:** `MAX_CURRENT_DATUMS_PER_SERIES = 50_000` per series in the current-frame buffer.  
**Downsampling:** `downsampleTimeseries()` (line plots, preserves shape) or `downsampleScatter()` (scatter-only, culls off-screen points).  
**Unique capabilities:**
- Only builder that supports the `derivative` modifier (computes dy/dx per point; first datum is always dropped).
- Supports all other math modifiers: `abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `log`, `log1p`, `log2`, `log10`, `round`, `sign`.
- Distinguishes preloaded (bag/file) data from UserScript output — preloaded data comes in via range subscriptions; UserScript output is current-frame only.

**Use when:** the user wants a classic time-series chart — sensor values, performance metrics, or any data evolving over time.

---

### IndexDatasetsBuilder

**X-axis:** array index (0, 1, 2, …).  
**Data accumulation:** no — processes only the latest message per topic from the current frame.  
**Worker:** no — runs entirely on the main thread.  
**Point cap:** none (assumes a single message produces a reasonable number of array entries).  
**Downsampling:** none.  
**Unique capabilities:**
- Simplest builder; replaces its entire dataset on each new frame.
- Designed for message paths that return arrays (`float64[] sensor_readings`, `geometry_msgs/Vector3[]`, etc.).
- Does not implement `handleMessageRange` — no historical accumulation.

**Use when:** the user wants to plot the values of an array field as a positional/scatter plot and time is irrelevant.

---

### CustomDatasetsBuilder

**X-axis:** values extracted from a user-specified message path (`xPath`) — e.g., `imu.temperature`.  
**Data accumulation:** yes — accumulates full (historical) and current-frame data for both X and Y topics.  
**Worker:** yes — dataset construction runs in `CustomDatasetsBuilderImpl.worker`.  
**Point cap:** `MAX_CURRENT_DATUMS_PER_SERIES = 50_000` for both X and Y buffers independently.  
**Downsampling:** `downsampleScatter()` for scatter/non-line plots.  
**Unique capabilities:**
- Only builder implementing `getXTopic()` — signals `PlotCoordinator` to subscribe to a second topic for X-axis values.
- Pairs X and Y values **by position index**: `(xValues[i], yValues[i])`. Reports `pathsWithMismatchedDataLengths` when array lengths differ.
- X-path change clears all accumulated X and Y data automatically.
- Tracks X bounds separately (`#xCurrentBounds`, `#xFullBounds`) to correctly size the x-axis.

**Use when:** both axes are data-driven and not tied to time — e.g., altitude vs. velocity, temperature vs. humidity.

---

### CurrentCustomDatasetsBuilder

**X-axis:** values extracted from a user-specified `xPath`, current frame only.  
**Data accumulation:** no — discards previous frame data on each update.  
**Worker:** no — runs entirely on the main thread.  
**Point cap:** none (single message assumed).  
**Downsampling:** none.  
**Unique capabilities:**
- Lightweight alternative to `CustomDatasetsBuilder` when preloading is not needed.
- Same mismatch detection as `CustomDatasetsBuilder` (`pathsWithMismatchedDataLengths`).
- Cleared entirely when `xPath` changes.

**Use when:** the user needs a live custom-axis scatter plot without historical accumulation (real-time HUD plots).

## Data Flow

1. **Messages arrive** via MessagePipeline (current frame + preloaded blocks)
2. **PlotCoordinator** dispatches messages to appropriate builder
3. **Builder Worker** extracts numeric values using message-path, builds datasets
4. **Renderer Worker** receives datasets, renders Chart.js to OffscreenCanvas
5. **Canvas visible** on screen (transferred from Worker)

## 50k Point Cap

`TimestampDatasetsBuilderImpl` enforces a **50,000 point maximum per series**:
- When exceeded, points are downsampled (LTTB or uniform sampling)
- Prevents Chart.js performance degradation with massive datasets
- Cap is per-series, not global — 10 series = up to 500k points total

## OffscreenCanvas Rendering

```typescript
// Canvas transferred once at init
const offscreenCanvas = canvas.transferControlToOffscreen();
new OffscreenCanvasRenderer(offscreenCanvas, theme);

// All Chart.js operations happen in the Worker
await renderer.update(action);     // Update options/scales
await renderer.updateDatasets(ds); // Push new data
```

## PlotCoordinator Responsibilities

- Creates/destroys builder + renderer Workers
- Routes incoming messages to correct builder based on path type
- Handles panel resize (notifies renderer Worker)
- Manages hover interactions (getElementsAtPixel)
- Coordinates between `#hasRangeSource` (preloaded data) and current-frame data

## Key Performance Patterns

1. **Three Workers**: Data extraction, custom data extraction, and rendering all off main thread
2. **50k cap**: Prevents Chart.js from processing unbounded datasets
3. **OffscreenCanvas**: Rendering doesn't block main thread
4. **Incremental updates**: Only new messages processed, not full re-build
5. **FinalizationRegistry**: Workers cleaned up if coordinator is GC'd

## Key Files
- `packages/suite-base/src/panels/Plot/PlotCoordinator.ts`
- `packages/suite-base/src/panels/Plot/builders/IDatasetsBuilder.ts` — shared interface
- `packages/suite-base/src/panels/Plot/builders/TimestampDatasetsBuilder.ts`
- `packages/suite-base/src/panels/Plot/builders/TimestampDatasetsBuilderImpl.ts`
- `packages/suite-base/src/panels/Plot/builders/IndexDatasetsBuilder.ts`
- `packages/suite-base/src/panels/Plot/builders/CustomDatasetsBuilder.ts`
- `packages/suite-base/src/panels/Plot/builders/CustomDatasetsBuilderImpl.ts`
- `packages/suite-base/src/panels/Plot/builders/CurrentCustomDatasetsBuilder.ts`
- `packages/suite-base/src/panels/Plot/builders/utils.ts` — shared builder utilities
- `packages/suite-base/src/panels/Plot/OffscreenCanvasRenderer.ts`
- `packages/suite-base/src/panels/Plot/ChartRenderer.worker.ts`

## Skills Reference
- Deep plot builder internals, downsampling, or dataset accumulation: `read_file(".github/skills/plot-internals/SKILL.md")`
- Message-path syntax and topic data extraction: `read_file(".github/skills/message-path/SKILL.md")`
- Worker/Comlink patterns (OffscreenCanvas, datasetsWorker): `read_file(".github/skills/web-workers/SKILL.md")`

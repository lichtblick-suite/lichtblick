---
description: "Deep Chart.js integration knowledge for the Plot panel: Worker-based rendering, dataset management, downsampling strategies, scale handling, and interaction patterns."
---

# Plot Internals Skill

## Chart.js Worker Architecture

### ChartRenderer.worker.ts
```typescript
// Worker-side: owns the Chart.js instance
Chart.register(LineElement, PointElement, LineController, ...);

Comlink.expose({
  async init(args: InitArgs): Promise<ChartRenderer> {
    await fontLoaded;  // Wait for fonts before first render
    return new ChartRenderer(args);
  }
});
```

### ChartRenderer Class
- Owns a single `Chart` instance (Chart.js)
- Receives `UpdateAction` messages from main thread
- Returns `Bounds` (data range) and `HoverElement[]` (interaction)
- Manages scales, datasets, annotations all within the Worker

## Dataset Building

### TimestampDatasetsBuilderImpl (Worker)

```typescript
class TimestampDatasetsBuilderImpl {
  #seriesMap = new Map<string, SeriesData>();  // path → accumulated points

  // Called for each batch of messages
  handleMessages(messages: MessageEvent[]): void {
    // Extract numeric values using message-path logic
    // Append to per-series arrays
    // Enforce 50k cap with downsampling
  }

  // Returns current datasets for rendering
  buildActions(): UpdateAction[] {
    return this.#seriesMap.values().map(seriesData => ({
      datasets: [{ data: seriesData.points }],
    }));
  }
}
```

### 50k Point Downsampling

When a series exceeds 50,000 points:
1. **LTTB (Largest-Triangle-Three-Buckets)**: Visually-preserving downsampling
2. Preserves peaks and valleys (important for sensor data)
3. Applied incrementally as new data arrives
4. Re-triggered when zoom level changes (fewer visible points = less downsampling needed)

### Range Source Flag
```typescript
#hasRangeSource: boolean;
// true = preloaded data available (full time range in blocks)
// false = only current-frame data (live or non-preloading mode)
```

When `#hasRangeSource` is true:
- Builder receives preloaded block data (historical)
- Must merge block data with current-frame messages
- Datasets represent full recording, not just visible window

## Scale Management

### Time Axis (X)
- `TimeScale` from Chart.js `chartjs-adapter-luxon`
- Handles nanosecond timestamps (converted to milliseconds for Chart.js)
- Zoom/pan interactions update visible time range

### Value Axis (Y)
- Auto-scaling based on visible data range
- Per-series Y-axis support (left/right axis)
- Manual bounds via panel settings

## Interaction Handling

### Hover/Tooltip
```typescript
// Main thread asks Worker for elements at mouse position
const elements = await renderer.getElementsAtPixel({ x, y });
// Returns: series index, data index, value — used for tooltip rendering
```

### Zoom/Pan
- Handled via Chart.js annotation plugin
- Zoom: scroll wheel → update time range → PlotCoordinator notifies builder
- Pan: drag → update time range → same flow

## Font Loading

```typescript
// Worker must load fonts before rendering (no DOM access)
const fontLoaded = loadDefaultFont();  // Fetches font file via fetch()
// Every new ChartRenderer awaits this before creating Chart instance
```

## Performance Considerations

1. **Worker isolation**: Chart.js runs entirely in Worker — no main thread blocking
2. **OffscreenCanvas**: Canvas operations don't trigger main-thread compositing
3. **Batch updates**: Multiple dataset changes coalesced into single `chart.update()`
4. **Lazy rendering**: Chart only re-renders when data or options actually change
5. **Transfer optimization**: Dataset arrays transferred (not copied) when possible
6. **Memory**: 50k cap × ~32 bytes/point × N series = bounded memory usage

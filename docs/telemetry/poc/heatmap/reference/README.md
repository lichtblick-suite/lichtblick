# Reference screenshots

`heatmap/index.html` overlays the click-density map on a screenshot of the panel it was captured
from. This directory intentionally ships without any images — they have to come from a real,
running build, not something that can be generated ahead of time.

## Naming convention

```
<panel-type>-<size-bucket>.png
```

- `panel-type` — the exact `PanelComponent.panelType` string (e.g. `ThreeDeeRender`, `Plot`,
  `Image`), same value as the `panel_type` label on `lichtblick_ui_interaction_total` and the
  Grafana `$panel_type` template variable.
- `size-bucket` — one of `s` / `m` / `l` / `xl`, matching `InteractionAttributes.size_bucket`
  (see `bucketOf()` in `useInteractionCapture.ts`).

Example: `ThreeDeeRender-l.png`.

## Capturing one

1. Open a layout with the panel sized to the bucket you're capturing (`l` is the most common —
   roughly an 800x500px panel or larger, see the thresholds in `useInteractionCapture.ts`).
2. Take a screenshot of just the panel's content area (not the browser chrome, not the panel
   toolbar) — the heatmap page scales the grid to the image's exact pixel dimensions, so the crop
   has to match what `useInteractionCapture` measured (the panel root's `getBoundingClientRect()`).
3. Save it here using the naming convention above.

If no matching file exists, `heatmap/index.html` falls back to a plain placeholder sized from its
"Reference width x height" fields instead of failing — useful for checking the aggregation logic
before a real screenshot is captured.

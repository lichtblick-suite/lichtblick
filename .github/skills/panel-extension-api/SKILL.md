---
description: "Deep panel infrastructure knowledge: PanelExtensionAdapter, RenderState incremental building, PanelExtensionContext API, pauseFrame backpressure, panel lifecycle, and the PanelAPI internal hooks."
---

# Panel Extension API Skill

The panel infrastructure connects panels to the MessagePipeline and manages their lifecycle.

## Architecture

```
MessagePipeline (zustand store)
    │
    ▼
PanelExtensionAdapter (per-panel bridge)
    │   ├── buildRenderState()  (incremental state building)
    │   ├── pauseFrame()        (backpressure mechanism)
    │   └── PanelExtensionContext (API exposed to panel code)
    ▼
Panel Component (renders data)
```

## Core Files

| File | Role |
|------|------|
| `packages/suite-base/src/components/PanelExtensionAdapter/PanelExtensionAdapter.tsx` | React component, manages panel lifecycle + subscriptions |
| `packages/suite-base/src/components/PanelExtensionAdapter/renderState.ts` | Incrementally builds `RenderState` from pipeline state |
| `packages/suite-base/src/context/PanelExtensionContext.ts` | Context type panels consume |
| `packages/suite-base/src/PanelAPI/` | Internal hooks for built-in panels |

## RenderState (Incremental Building)

```typescript
interface RenderState {
  topics?: readonly Topic[];
  currentFrame?: readonly MessageEvent[];
  allFrames?: readonly MessageEvent[];  // preloaded range
  currentTime?: Time;
  parameters?: Map<string, unknown>;
  variables?: Map<string, unknown>;
  colorScheme?: "dark" | "light";
  appSettings?: Map<string, unknown>;
}
```

- `renderState.ts` tracks which fields changed since the last render
- Only changed fields are rebuilt (e.g. if only `currentTime` changed, `topics` is reused)
- Reference equality on unchanged fields enables React memo optimizations in panels

## PanelExtensionContext (Core API Introduction)

```typescript
interface PanelExtensionContext {
  subscribe(topics: SubscriptionConfig[]): void;
  onRender(renderState: RenderState, done: () => void): void;
  saveState(state: unknown): void;
  seekPlayback(time: Time): void;
  setParameter(key: string, value: unknown): void;
}
```

This snippet is a core API introduction, not the full type surface. For the complete
`PanelExtensionContext` definition (including read-only properties, watch/subscription APIs,
publish/service methods, settings APIs, and range subscriptions), see:
`packages/suite/src/index.ts`.

> The render callback is `onRender(renderState, done)`. The panel **must** call `done()` when it has
> finished processing the frame — this drives `pauseFrame` backpressure.

## pauseFrame (Backpressure)

```typescript
const done = pauseFrame(panelId);
// ... expensive rendering (GPU upload, chart update) ...
done(); // ready for next frame
```

- Prevents the pipeline from pushing new data while a panel is still rendering
- Critical for the 3D panel (GPU upload) and Plot panel (chart update)
- If a panel doesn't call `done()` within the timeout, the next frame is forced

## Panel Lifecycle

1. **Mount** — adapter creates the context, panel `initPanel()` is called
2. **Subscribe** — panel declares topics via `context.subscribe()`
3. **Render loop** — pipeline pushes a new `RenderState` → `onRender()` fires
4. **Config change** — user edits settings → panel re-renders with new config
5. **Unmount** — adapter unsubscribes, panel `cleanup()` is called

## Creating a New Panel

```
panels/MyPanel/
├── index.tsx       # registration + entry point
├── MyPanel.tsx     # main component
├── settings.ts     # settings tree definition
├── types.ts        # panel-specific types
└── MyPanel.test.tsx
```

## PanelAPI (Internal Hooks)

Built-in panels access data via React hooks in `PanelAPI` instead of the `PanelExtensionContext`
render-callback model:

```typescript
import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
```

- `useDataSourceInfo()` — rarely-changing metadata (topics, datatypes, capabilities, `startTime`);
  re-renders only when metadata changes, not during playback.

## Performance Notes

- Incremental `RenderState` minimizes object creation — only changed fields are rebuilt
- `pauseFrame` prevents data flooding slow panels
- Subscription scoping delivers only subscribed topics to each panel
- Profile (React DevTools Profiler / Chrome Performance) before adding memoization

## Skills Reference
- For the upstream data bus: load `message-pipeline` skill

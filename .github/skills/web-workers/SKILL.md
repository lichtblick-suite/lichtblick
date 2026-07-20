---
description: "Web Worker patterns used throughout the Lichtblick codebase: Comlink integration, ComlinkWrap lifecycle, transfer handlers, OffscreenCanvas, SharedWorker isolation, and testing utilities."
---

# Web Workers Skill

## Standard Pattern: ComlinkWrap

All Worker communication in Lichtblick uses Comlink with the `ComlinkWrap` utility for safe lifecycle management.

### Worker Creation (main thread)
```typescript
import { ComlinkWrap } from "@lichtblick/den/worker";

const worker = new Worker(
  new URL("./MyWorker.worker", import.meta.url),  // webpack-compatible URL
);

const { remote, dispose } = ComlinkWrap<MyWorkerAPI>(worker);

// Use the remote API
const result = await remote.process(data);

// Cleanup when done
dispose(); // releases Comlink proxy + terminates worker
```

### Worker Implementation (worker thread)
```typescript
import * as Comlink from "@lichtblick/comlink";

class MyWorkerImpl {
  async process(data: Uint8Array): Promise<Result> {
    // Heavy computation here
    return result;
  }
}

Comlink.expose(new MyWorkerImpl());
```

### Key file: `packages/den/worker/ComlinkWrap.ts`

## FinalizationRegistry Cleanup

`ComlinkWrap` returns a `dispose` function, but the project also uses `FinalizationRegistry` as a safety net:

```typescript
const registry = new FinalizationRegistry<() => void>((dispose) => {
  dispose(); // Worker terminated when wrapper is garbage collected
});

// In constructor:
registry.register(this, dispose);
```

This prevents Worker leaks if the wrapping object is GC'd without explicit disposal.

## Transfer Handlers

### AbortSignal Transfer
```typescript
import { abortSignalTransferHandler } from "@lichtblick/comlink-transfer-handlers";

// Register BEFORE any Comlink communication
Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);
```

Allows passing `AbortSignal` across Worker boundaries — used by `WorkerIterableSource` to cancel iteration.

### OffscreenCanvas Transfer
```typescript
const offscreenCanvas = canvas.transferControlToOffscreen();

const { remote, dispose } = ComlinkWrap<RendererService>(worker);
await remote.init(
  Comlink.transfer(
    { canvas: offscreenCanvas, devicePixelRatio: window.devicePixelRatio },
    [offscreenCanvas],  // Transfer list
  ),
);
```

Used by: Plot panel (`OffscreenCanvasRenderer`), Chart component.

### ArrayBuffer Transfer
```typescript
// Transfer large binary data to Worker (zero-copy)
await remote.processData(Comlink.transfer(buffer, [buffer.buffer]));
// After transfer: buffer.byteLength === 0 (detached)
```

## Worker URL Pattern (Webpack)

All Worker URLs use the `import.meta.url` pattern for webpack compatibility:

```typescript
new Worker(new URL("./MyWorker.worker", import.meta.url));
```

- File must be named `*.worker.ts` (webpack recognizes this pattern)
- `babel-plugin-transform-import-meta` handles the URL resolution
- Each Worker file is bundled as a separate chunk

## SharedWorker Pattern

Used by UserScriptPlayer for script execution:

```typescript
new SharedWorker(new URL("./transformerWorker/index", import.meta.url), {
  name: uuidv4(),  // Unique name prevents sharing between tabs
});
```

- `SharedWorker` chosen for memory efficiency (shared code across script instances)
- Unique `name` per instance prevents cross-tab Worker sharing (intentional isolation)

## Testing Workers

### makeComlinkWorkerMock
```typescript
import { makeComlinkWorkerMock } from "@lichtblick/den/testing";

// Replace global Worker constructor with a mock that uses in-process Comlink
Object.defineProperty(global, "Worker", {
  writable: true,
  value: makeComlinkWorkerMock(() => new ActualImplementation()),
});
```

Located in `packages/den/testing/makeComlinkWorkerMock.ts`:
- Creates an in-process Comlink channel (no actual Worker thread)
- Allows unit testing Worker-based code without spawning real threads
- Uses `EventEmitter` to simulate `postMessage` / `onmessage`

## Workers in the Codebase

| Location | Purpose | Pattern |
|----------|---------|---------|
| `IterablePlayer/WorkerIterableSource.ts` | Data source parsing | ComlinkWrap + AbortSignal |
| `Plot/OffscreenCanvasRenderer.ts` | Chart.js rendering | ComlinkWrap + OffscreenCanvas |
| `Plot/builders/TimestampDatasetsBuilder.ts` | Dataset building | ComlinkWrap + FinalizationRegistry |
| `ThreeDeeRender/renderables/Images/WorkerImageDecoder.ts` | Image decoding | ComlinkWrap |
| `UserScriptPlayer/index.ts` | Script execution | SharedWorker + unique name |
| `FoxgloveWebSocketPlayer/WorkerSocketAdapter.ts` | WebSocket I/O | Raw Worker + postMessage |
| `components/Chart/index.tsx` | Legacy chart rendering | WebWorkerManager + Rpc |

## Performance Considerations

1. **Transfer vs Copy**: Always use `Comlink.transfer()` for large ArrayBuffers
2. **Worker startup**: Workers are created lazily — first use incurs startup cost
3. **Proxy cleanup**: Always call `dispose()` or rely on FinalizationRegistry
4. **Message overhead**: Small frequent messages have higher overhead than batched large messages
5. **SharedWorker caveats**: Debugging is harder (separate DevTools), errors may be silent

---
description: "Deep performance optimization knowledge for the Lichtblick codebase. Covers profiling techniques, common bottlenecks, memory management patterns, and optimization strategies specific to real-time data visualization."
---

# Performance Skill

## Profiling Workflow

### Chrome DevTools
1. **Performance tab**: Record during playback, look for long tasks (>50ms)
2. **Memory tab**: Take heap snapshots before/after operations, check for leaks
3. **Performance Monitor**: Watch JS heap size, DOM nodes, layouts/sec in real-time
4. **Layers panel**: Identify unnecessary compositing layers (GPU memory)

### Key Metrics
- **Frame budget**: 16.6ms at 60fps — anything longer causes jank
- **Tick budget**: IterablePlayer caps at 300ms per tick
- **GC pressure**: Frequent minor GCs indicate excessive allocation
- **Transfer size**: Transferable objects (ArrayBuffer) should use zero-copy transfer

## Common Bottlenecks

### 1. Message Processing (Player → Pipeline)
- **Symptom**: Dropped frames during high-rate playback
- **Cause**: Too many messages per tick, deserialization cost
- **Fix**: Batch processing, Worker-based deserialization, subscription filtering

### 2. Render State Building (Pipeline → Panel)
- **Symptom**: All panels re-render even when their data hasn't changed
- **Cause**: Missing memoization in `renderState.ts`, non-stable references
- **Fix**: Ensure `buildRenderState` returns same reference when data unchanged

### 3. 3D Scene Updates (Panel rendering)
- **Symptom**: Low FPS in 3D panel with many objects
- **Cause**: Per-frame geometry creation, excessive draw calls
- **Fix**: `DynamicBufferGeometry` reuse, instanced rendering, frustum culling

### 4. Chart Rendering (Plot panel)
- **Symptom**: Plot panel laggy with many data points
- **Cause**: Chart.js processing 50k+ points on main thread
- **Fix**: Worker-based dataset building (50k cap per series), OffscreenCanvas

### 5. Memory Pressure (Caching)
- **Symptom**: Browser tab crashes or becomes unresponsive
- **Cause**: Cache exceeds budget, large messages retained
- **Fix**: Respect the 600MB player-level message cache budget (`CachingIterableSource`), evict behind read head, lazy deserialization. Note: this is separate from the 500MB default HTTP-layer cache in `RemoteFileReadable`/`CachedFilelike` used for remote file reads.

## Optimization Patterns

### Zero-Copy Transfer
```typescript
// Transfer ArrayBuffer to Worker (not copy)
Comlink.transfer({ buffer: myArrayBuffer }, [myArrayBuffer]);
// After transfer, myArrayBuffer.byteLength === 0 (detached)
```

### Object Pooling (3D)
```typescript
// Reuse Vector3 instances instead of creating new ones
const tempVec = new THREE.Vector3();
function updatePosition(x: number, y: number, z: number) {
  tempVec.set(x, y, z);
  mesh.position.copy(tempVec);
}
```

### Structural Sharing (State)
```typescript
// Only create new object if data actually changed
const newMessages = messages !== prevMessages ? [...messages, ...newBatch] : prevMessages;
```

### Debounced Emission
```typescript
// Coalesce rapid state updates
#scheduleEmit() {
  if (this.#emitScheduled) return;
  this.#emitScheduled = true;
  queueMicrotask(() => {
    this.#emitScheduled = false;
    this.#emitStateImpl();
  });
}
```

### Subscription Filtering
```typescript
// Only request data for topics panels actually need
const activeTopics = mergeSubscriptions(allPanelSubscriptions);
player.setSubscriptions(activeTopics); // Player only iterates these
```

## Memory Management

### Identifying Leaks
1. Take heap snapshot A (baseline)
2. Perform operation (open/close panel, play/seek)
3. Force GC (DevTools → Memory → Collect garbage)
4. Take heap snapshot B
5. Compare: Objects in B not in A = potential leaks

### Common Leak Sources
- Unremoved event listeners (especially on `window` or `document`)
- Unreleased Comlink proxies (Worker not disposed)
- Retained message references in closed panels
- Subscription callbacks not unsubscribed on unmount

### Prevention
- `FinalizationRegistry` for Worker proxy cleanup (see `ComlinkWrap`)
- `useEffect` cleanup functions for all subscriptions
- `WeakRef` / `WeakMap` for caches that shouldn't prevent GC
- Explicit `.dispose()` calls in panel unmount

## Benchmarking

- Project benchmark suite: `benchmark/` directory
- Run: `cd benchmark && yarn start`
- Measures: message throughput, deserialization speed, render time
- Use for before/after comparison when optimizing

---
description: "Deep implementation details of caching strategies, memory budgets, block eviction, and buffered reading in the Lichtblick preloading subsystem."
---

# Caching Internals Skill

## CachingIterableSource Implementation

### Cache Structure
```typescript
class CachingIterableSource {
  #blocks = new Map<string, CacheBlock>();  // key: serialized range+topics
  #totalSize = 0;                           // current memory usage
  #cacheSizeBytes = 600 * 1024 * 1024;      // 600MB budget
  #maxBlockSize = 50 * 1024 * 1024;         // 50MB per block
  #accessOrder: string[] = [];              // LRU tracking
}
```

### Cache Key Design
- Key combines: `startTime + endTime + sorted topic names`
- This means the same time range with different topic sets creates separate cache entries
- Allows partial cache hits when subscription set changes

### Eviction Algorithm
1. When `#totalSize + newBlockSize > #cacheSizeBytes`:
2. Find blocks behind current read position (already consumed)
3. Evict LRU blocks until sufficient space is freed
4. If no blocks behind read position exist, evict oldest block regardless

### Block Lifecycle
```typescript
EMPTY → LOADING → CACHED → EVICTED
                     │
                     └──► ACCESSED (moves to front of LRU)
```

## BufferedIterableSource Implementation

### Read-Ahead Configuration
```typescript
// packages/suite-base/src/players/IterablePlayer/BufferedIterableSource.ts
const DEFAULT_READ_AHEAD_DURATION = { sec: 10, nsec: 0 };
// Overridable per-instance via opt.readAheadDuration; defaults to 10 s.
```

> ⚠️ There is no `MCAP_READ_AHEAD_DURATION_SEC = 120` (or any 120-second MCAP-specific read-ahead).
> The only default is `{ sec: 10, nsec: 0 }`, applied uniformly regardless of source format.

### Producer-Consumer Coordination
```text
Producer Thread (may be Worker):
  while (not at end && buffer not full) {
    message = await source.next();
    buffer.push(message);
    signal consumer;
  }
  wait for consumer to drain;

Consumer (IterablePlayer tick loop):
  messages = buffer.drain(upToTime);
  signal producer to refill;
```

### Backpressure Mechanism
- Producer fills buffer up to `readAheadDuration` worth of messages
- When buffer is full, producer yields (awaits a drain signal)
- Consumer pulls messages up to its tick budget time
- After consuming, signals producer to resume filling

### VecQueue Details
- Backed by a plain array with start/end pointers
- `push()`: appends to end, O(1)
- `drain(predicate)`: returns all items matching predicate from front, O(n) but bulk operation
- Periodic compaction: when start pointer exceeds threshold, shifts array

## BlockLoader Implementation

### Block Division Strategy
- Total time range divided into N blocks of equal duration
- Block count determined by: `Math.ceil(totalDuration / targetBlockDuration)`
- Target block duration balances granularity vs overhead

### Loading Priority
1. Block containing current playback time (immediate need)
2. Blocks ahead of current time (upcoming data)
3. Blocks behind current time (for seek-back scenarios)
4. Never-accessed blocks (lowest priority)

### Progress Reporting
```typescript
interface Progress {
  fullyLoadedFractionRanges: Array<{ start: number; end: number }>;
  // Fraction 0..1 representing which portions of the time range are cached
}
```

## Memory Optimization Patterns

1. **Shared ArrayBuffers**: Message data stored as `Uint8Array` views into shared buffers where possible
2. **Lazy deserialization**: Raw bytes cached, deserialized only when consumed
3. **Topic-scoped loading**: Each block only contains data for requested topics
4. **Size estimation**: Block size estimated before full load to prevent over-allocation

---
description: "Remote file connection specialist covering HTTP range requests, MCAP remote reading, CachedFilelike caching, MultiIterableSource multi-file orchestration, and file-based data source loading. Use for remote file access patterns, network-related data loading, and multi-file remote playback."
tools: ["read", "search"]
---

# Remote Connection Agent

You are an expert on remote data access in Lichtblick — loading MCAP and other file formats over HTTP with efficient range-based reading, multi-layer caching, and multi-file orchestration.

## Full Pipeline Architecture

### Single Remote File
```
Remote URL (.mcap / .bag)
    │
    ▼
BrowserHttpReader (GET+abort for size, Range requests for data)
    │
    ▼
FetchReader (Streams API → EventEmitter: data/error/end)
    │
    ▼
CachedFilelike (VirtualLRUBuffer LRU cache, 500MB default, 10MB blocks)
    │
    ▼
BatchingReadable (coalesces reads <64KiB apart within a microtask tick, ≤4MiB span)
    │
    ▼
RemoteFileReadable (IReadable adapter: size(), read(offset, size))
    │
    ├─────────────────── Worker boundary ────────────────────┐
    ▼                                                        │
McapIndexedReader (footer → summary → chunk indexes)         │
    │                                                        │
    ▼                                                        │
McapIndexedIterableSource (per-chunk random access)          │
    └────────────────────────────────────────────────────────┘
    │
    ▼
WorkerSerializedIterableSource (Comlink RPC, 17ms batch reads)
    │
    ▼
BufferedIterableSource (10s read-ahead buffer, 300MB max cache)
    │
    ▼
DeserializingIterableSource (lazy deserialization + sampling)
    │
    ▼
IterablePlayer (state machine, tick loop)
```

### Multiple Remote Files
```
URLs: [url1.mcap, url2.mcap, url3.mcap]
    │
    ▼
MultiIterableSource (500MB total cache ÷ N, floored by MIN_CACHE_PER_SOURCE_BYTES)
    │
    ├── shared HydratedSourcePool (bounds resident McapIndexedReaders by count + bytes)
    │      ├── McapIterableSource(url1, ~166MB cache)
    │      ├── McapIterableSource(url2, ~166MB cache)
    │      └── McapIterableSource(url3, ~166MB cache)
    │
    ▼ (each initialized under bounded concurrency)
mergeSequentialIterators (min-heap, lazy source activation)
    │
    ▼
WorkerSerializedIterableSource → BufferedIterableSource → Player
```

---

## Core Components

| File | Role |
|------|------|
| `util/BrowserHttpReader.ts` | HTTP Range requests via Fetch API |
| `util/FetchReader.ts` | Streams API → EventEmitter adapter |
| `util/CachedFilelike.ts` | LRU-cached streaming file reader |
| `util/VirtualLRUBuffer.ts` | Block-level LRU memory management |
| `util/getNewConnection.ts` | HTTP connection decision algorithm |
| `util/RequestQueue.ts` | Global concurrency limiter (10 max) |
| `IterablePlayer/Mcap/RemoteFileReadable.ts` | `IReadable` adapter wrapping CachedFilelike (reads pass through BatchingReadable) |
| `IterablePlayer/Mcap/BatchingReadable.ts` | Coalesces nearby `IReadable.read()` calls into fewer, larger reads |
| `IterablePlayer/Mcap/McapIterableSource.ts` | Factory: indexed vs streaming decision |
| `IterablePlayer/Mcap/McapIndexedIterableSource.ts` | Random access via chunk indexes |
| `IterablePlayer/Mcap/readerWeight.ts` | Heuristic byte-weight estimate for a `McapIndexedReader`, used as the pool's `weigh()` hook |
| `IterablePlayer/shared/HydratedSourcePool.ts` | Bounded LRU pool of resident heavyweight per-file readers (byte + count budget) |
| `IterablePlayer/shared/multiFileHydrationOptions.ts` | Shared hydration-override merging (`maxHydratedSources`/`maxHydratedBytes`/`initConcurrency`), used by both data source factories and the MCAP worker |
| `IterablePlayer/shared/MultiIterableSource.ts` | Multi-file orchestration |
| `IterablePlayer/shared/utils/mergeSequentialIterators.ts` | Heap-based lazy iterator merge |
| `IterablePlayer/shared/utils/sourceTimeOverlap.ts` | Time range filtering |
| `dataSources/RemoteDataSourceFactory.tsx` | Creates player with remote URL source |

---

## Caching Architecture (CachedFilelike)

### Three-Layer Cache System
1. **VirtualLRUBuffer** — block-level (10MB) LRU memory, evicts oldest blocks when full
2. **getNewConnection** — decides when to open/close HTTP streams (50MB read-ahead)
3. **BufferedIterableSource** — time-based read-ahead (10s) above the file layer

### Key Constants
| Constant | Value | Location |
|----------|-------|----------|
| Default cache size | 500 MiB | `RemoteFileReadable.ts` |
| Block size | 10 MiB | `CachedFilelike.ts` |
| Close-enough threshold | 5 MiB | `CachedFilelike.ts` |
| Read-ahead buffer | 50 MiB | `getNewConnection.ts` |
| Max concurrent requests | 10 | `RequestQueue.ts` / `constants.ts` |
| BufferedIterableSource max cache | 300 MiB | `IterablePlayer.ts` (serialized sources) |
| BufferedIterableSource read-ahead | 10 sec | `IterablePlayer.ts` / `BufferedIterableSource.ts` |

### CachedFilelike Read Flow
1. `read(offset, length)` → queues request with range + promise
2. `#updateState()`:
   - Resolves reads already satisfied by `VirtualLRUBuffer.hasData()`
   - Calls `getNewConnection()` to decide if a new HTTP stream is needed
3. If new connection needed → opens `FetchReader` stream
4. On each `data` chunk: `VirtualLRUBuffer.copyFrom()` + `#updateState()` (may resolve reads)

### getNewConnection Decision Logic
- **Read request pending**: start new connection if current stream doesn't overlap needed range or is >5MB away
- **No pending reads**: proactively download 50MB after the last resolved read (sequential read-ahead)
- **Cache ≥ file size**: attempt full file download (prioritizing after last read position)
- **Connection interrupted**: destroy + `#updateState()` → retries automatically

### Error Recovery
- **`keepReconnectingCallback` set** (browser mode): unlimited retries, UI notified of reconnection state
- **Single error**: destroys connection, retries via `#updateState()`
- **No callback**: two errors within 100ms → fatal, routes through shared `#closeWithError(error)` cleanup
- **`close()` + fatal path**: both destroy the active stream, reject pending `#readRequests`, cancel `#activeUncachedReads`, and reset `#virtualBuffer`

---

## HydratedSourcePool (Bounded Reader Pool)

`HydratedSourcePool` bounds **resident heavyweight per-file `McapIndexedReader` instances** (reader/deserializer state, plus each source's cache allocation folded into the weight estimate). It does **not** bound decoded message data; that still lives in `BufferedIterableSource`, `CachedFilelike`, and downstream playback buffers.

```typescript
const pool = new HydratedSourcePool({
  maxCount: dataSource.maxHydratedSources ?? 12,
  maxBytes: dataSource.maxHydratedBytes ?? 512 * 1024 * 1024,
  minResident: 1,
});
```

- **Hybrid budget**: `maxCount` caps resident readers, `maxBytes` caps total estimated resident weight, and `minResident` keeps a small floor hot (clamped so it never exceeds the count cap). `MultiIterableSource` constructs one shared pool and passes it to **both** the local-files and remote-urls branches.
- **API contract**:
  - `acquire(token, hydrator)`: open or reuse a resident reader, increment its pin count, refresh LRU recency, and keep it non-evictable until a matching `release(token)`. After `terminate()`, `acquire()` throws instead of rehydrating.
  - `release(token)`: decrement the pin count (floor 0) and opportunistically evict
  - `admit(token, hydrator, value)`: seed an already-open reader (for example from `initialize()` / prewarm) without calling `open()`. If the token is already resident, or the pool is already terminated, the redundant value is closed instead of replacing the existing entry.
  - `terminate()`: mark the pool terminated first, then close every resident entry in parallel so late `acquire()` / `admit()` calls cannot repopulate it
- **Eviction semantics**: entries live in a `Map<object, Entry>` whose insertion order is the LRU order. Re-inserting on access moves an entry to the most-recent end. Eviction scans from oldest to newest and closes the first **unpinned** entries until the pool is back under budget. If everything remaining is pinned, the pool may temporarily stay over budget by design.
- **Weight heuristic** (`readerWeight.ts`): `weigh()` defaults to `1`, but MCAP readers use an approximate byte estimate so larger readers churn first:
  ```typescript
  READER_BASE_BYTES +
    reader.chunkIndexes.length * 512 +
    reader.channelsById.size * (16 * 1024) +
    cacheBytes
  ```
  The absolute numbers are heuristic; relative weighting is what matters.
- **Indexed URL reuse vs unindexed bypass**: for `type: "url"` sources, `McapIterableSource` keeps one session-long `#persistentReadable` (`RemoteFileReadable` + `CachedFilelike` cache) and reuses it across pool eviction/re-`acquire()`; the pool only evicts the heavyweight `McapIndexedReader` layer, not that transport/cache. If a source proves unindexed (or the URL path falls back to raw `fetch()` streaming), it skips `HydratedSourcePool` entirely and lives in `#eagerInner` for the whole session, so unindexed files are outside the pool's count/byte budget.

---

## Indexed vs Streaming Decision

`McapIterableSource.initialize()`:
1. Preloads WASM decompression handlers (avoids race under network congestion)
2. Attempts `McapIndexedReader.Initialize()` on the readable
3. If successful AND `chunkIndexes.length > 0` AND `channelsById.size > 0`:
   - → `McapIndexedIterableSource` (random access, fast seek)
4. Otherwise:
   - → `McapUnindexedIterableSource` (full streaming, no seek support)

### Why Indexed Reading Matters for Remote
- MCAP summary section is at the **end** of the file
- One Range request reads footer → gets summary offset
- Second Range request reads summary → gets all chunk indexes
- Subsequent reads fetch only needed chunks (by time range via `readMessages()`)
- Result: O(log n) seek even over network
- `McapIndexedIterableSource.getBackfillMessages()`: reads in **reverse** per-topic for efficient latest-message lookup

### McapIndexedIterableSource Internals
```typescript
// Forward iteration - reads chunks sequentially by time
messageIterator({ topics, start, end }) {
  for await (const message of reader.readMessages({
    startTime: toNanoSec(start),
    endTime: toNanoSec(end),
    topics: topicNames,
    validateCrcs: false,  // Skip CRC for performance
  })) { yield { type: "message-event", msgEvent: ... }; }
}

// Backfill - one reverse iterator PER TOPIC (avoids scanning irrelevant messages)
getBackfillMessages({ topics, time }) {
  for (const topic of topics.keys()) {
    for await (const message of reader.readMessages({
      endTime: toNanoSec(time),
      topics: [topic],
      reverse: true,  // Read backwards from time
    })) { messages.push(...); break; }  // Only need the latest
  }
}
```

---

## MultiIterableSource (Multi-File Remote)

**Source**: `packages/suite-base/src/players/IterablePlayer/shared/MultiIterableSource.ts`

### Cache Budget Distribution
```typescript
const totalCache = dataSource.totalCacheSizeInBytes ?? 500 * 1024 * 1024;  // 500MB total
const minPerSource = dataSource.minCachePerSourceBytes ?? 10 * 1024 * 1024;  // 10MB floor
const perSourceCache = Math.max(minPerSource, Math.floor(totalCache / urls.length));
```
- 2 files → 250MB each
- 5 files → 100MB each
- Hundreds of files → floor at 10MiB per source by default (override `minCachePerSourceBytes`)
- Prevents `totalCache / N` from dropping below a viable per-file metadata-read budget; if `perSourceCache * N > totalCache`, a `log.warn` notes the aggregate may exceed the nominal budget

### Initialization
1. Constructs one shared `HydratedSourcePool` before branching on local files vs remote URLs (`maxHydratedSources ?? 12`, `maxHydratedBytes ?? 512 MiB`) and passes `pool` to every source constructor.
2. Creates N `McapIterableSource` instances (one per URL) with the divided cache budget; for multiple URLs, `readAheadEnabled` defaults to **lazy** (`false`) unless the caller overrides it. Single-file remote sessions keep the legacy eager default.
3. Initializes sources under a `Semaphore` (`initConcurrency ?? 4`, normalized to a positive integer) instead of unconstrained `Promise.all`; the returned `Initialization[]` still preserves input order.
4. Merges results: topics, datatypes, metadata, topicStats, alerts, publishersByTopic.
5. Sorts sources by start time (`source.getStart()`), then `#prewarmEarliestSources()` prewarms the earliest 3 sources in **reverse** order so the t=0 source ends up most-recently-used in the pool. Prewarm failures are logged at debug and treated as non-fatal.

- `terminate()`: runs `Promise.allSettled` over `source.terminate?.()`, logs each rejection, re-throws the first rejection after cleanup, and always tears down `pool.terminate()` in a `finally` block.

### Message Iteration — Lazy Sequential Merge
```typescript
messageIterator(opt) {
  const relevantSources = filterSourcesByTimeRange(sources, opt.start, opt.end);
  yield* mergeSequentialIterators(relevantSources, opt);
}
```

### Backfill — Parallel per relevant source
```typescript
getBackfillMessages({ topics, time }) {
  const relevantSources = filterSourcesForBackfill(sources, time);
  // Only queries sources whose startTime <= backfill time
  return Promise.all(relevantSources.map(s => s.getBackfillMessages(args))).flat();
}
```

---

## mergeSequentialIterators (Lazy Heap Merge)

**Source**: `packages/suite-base/src/players/IterablePlayer/shared/utils/mergeSequentialIterators.ts`

### Purpose
Merges messages from multiple time-sorted sources using a min-heap, but only **activates** a source's iterator when playback reaches its time range. This prevents concurrent HTTP requests to all remote files simultaneously.

### Algorithm
1. Separate sources into `sourcesWithTime` (sorted by startTime) and `sourcesWithoutTime` (started eagerly)
2. On initial start:
   - If `args.start` provided (seek): activate sources whose `[startTime, endTime]` contains `args.start`; skip sources that end before it
   - If no start: activate only the first (earliest) source
3. Main loop:
   - Pop minimum from heap → yield it
   - Before yielding: check if next pending source's `startTime <= currentMessageTime` → activate it
   - After yielding: advance the popped iterator; if done, try activating next pending source
4. Finally: close all active iterators (releases HTTP connections)

### Min-Heap Ordering
```typescript
const heap = new Heap<{ value: IteratorResult, iterator }>(
  (a, b) => getTime(a.value) - getTime(b.value)  // by receiveTime or stamp
);
```

### Performance Impact
- **Without lazy activation**: N files → N simultaneous HTTP Range request streams → browser connection pool exhaustion
- **With lazy activation**: only 1-2 streams active at any time during sequential playback
- Seek to middle of timeline: skips files that end before seek target entirely

---

## Source Time Filtering

**Source**: `packages/suite-base/src/players/IterablePlayer/shared/utils/sourceTimeOverlap.ts`

| Function | Logic |
|----------|-------|
| `filterSourcesByTimeRange(sources, start, end)` | Keeps sources where `[sourceStart, sourceEnd]` overlaps `[start, end]` |
| `filterSourcesForBackfill(sources, time)` | Keeps sources where `sourceStart <= time` |

- Sources without `getStart()`/`getEnd()` are always included (conservative)
- Used to avoid triggering HTTP requests to irrelevant files

---

## Data Source Factories

### RemoteDataSourceFactory
```typescript
// Maps file extensions to worker initializers
const initWorkers = {
  ".bag": () => new Worker(new URL("...BagIterableSourceWorker.worker", import.meta.url)),
  ".mcap": () => new Worker(new URL("...McapIterableSourceWorker.worker", import.meta.url)),
};

// Single URL
const source = new WorkerSerializedIterableSource({ initWorker, initArgs: { url } });

// Multiple URLs (comma-separated)
const source = new WorkerSerializedIterableSource({ initWorker, initArgs: { urls } });

// Player creation
new IterablePlayer({ source, readAheadDuration: { sec: 10, nsec: 0 }, ... });
```

### Worker Pipeline (Comlink)
```
Main Thread                          Worker Thread
─────────────────                    ─────────────────
WorkerSerializedIterableSource       McapIterableSourceWorker.worker.ts
  │ initialize()                       │ initialize(args)
  │ ──── Comlink RPC ──────────────►   │ → new McapIterableSource / MultiIterableSource
  │                                    │ → WorkerSerializedIterableSourceWorker wraps it
  │ messageIterator()                  │
  │ ──── getMessageCursor() ────────►  │ → IteratorCursor (nextBatch: 17ms batches)
  │ ◄──── results[] ───────────────   │
```

### Why 17ms Batches?
- Studio renders at up to 60fps → ~16ms per frame
- Fetching 17ms of messages ensures one batch can produce one frame
- Larger batches delay rendering; smaller batches increase Comlink RPC overhead

---

## Performance Considerations

1. **HTTP Range requests** enable partial file loading (only read needed MCAP chunks)
2. **LRU block cache** (500MB, 10MB blocks) prevents redundant fetches during indexed reading
3. **50MB read-ahead** in getNewConnection anticipates sequential chunk access
4. **Worker-based sources** keep HTTP I/O + parsing off main thread
5. **Request queue** (10 concurrent) prevents browser connection pool exhaustion
6. **Lazy sequential merge** avoids simultaneous HTTP streams to all remote files
7. **Indexed MCAP** required for acceptable remote performance (random access via chunk indexes)
8. **WASM decompression preload** prevents initialization failures under slow network
9. **Cache budget division** for multi-file uses a 10MiB per-source floor; many small files still increase refetch pressure and reader churn
10. **BufferedIterableSource** (10s, 300MB) smooths network latency for playback
11. **Read coalescing** (`BatchingReadable`): merges `read()` calls arriving in the same microtask tick (gap <64KiB, ≤4MiB span) before they reach `CachedFilelike`

## Common Pitfalls
- Server missing `Accept-Ranges: bytes` header → fails at open
- CORS not exposing `Accept-Ranges` header → browser can't detect range support
- Unindexed MCAP over remote → falls back to full streaming (slow, limited to 1GB)
- Too many remote files → per-source cache hits the 10MiB floor, aggregate cache may exceed the nominal total, and readers churn more often
- Worker teardown races → follow the capture-before-`await` plus `disposeRemote()`-in-`finally` pattern from `WorkerSerializedIterableSource.terminate()` or an older terminate can leak/dispose the wrong worker
- S3 presigned URLs with non-GET method → `BrowserHttpReader.open()` requires GET

## Skills Reference
- Deep HTTP caching internals (CachedFilelike, VirtualLRUBuffer): `read_file(".github/skills/remote-caching/SKILL.md")`
- MCAP format structure and indexed reading: `read_file(".github/skills/mcap-format/SKILL.md")`
- Worker/Comlink patterns: `read_file(".github/skills/web-workers/SKILL.md")`
- BufferedIterableSource or BlockLoader details: `read_file(".github/skills/caching-internals/SKILL.md")`
- Network/read latency profiling and buffering performance: `read_file(".github/skills/performance/SKILL.md")`
- Bounded reader pool implementation: `read_file("packages/suite-base/src/players/IterablePlayer/shared/HydratedSourcePool.ts")`
- Reader weight heuristic: `read_file("packages/suite-base/src/players/IterablePlayer/Mcap/readerWeight.ts")`

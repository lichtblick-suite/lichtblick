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
MultiIterableSource (500MB total cache ÷ N sources)
    │
    ├── McapIterableSource(url1, ~166MB cache)
    ├── McapIterableSource(url2, ~166MB cache)
    └── McapIterableSource(url3, ~166MB cache)
    │
    ▼ (each initialized in parallel)
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
| `IterablePlayer/Mcap/RemoteFileReadable.ts` | `IReadable` adapter wrapping CachedFilelike |
| `IterablePlayer/Mcap/McapIterableSource.ts` | Factory: indexed vs streaming decision |
| `IterablePlayer/Mcap/McapIndexedIterableSource.ts` | Random access via chunk indexes |
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
- **No callback**: two errors within 100ms → fatal, rejects all pending reads
- **Single error**: destroys connection, retries via `#updateState()`

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
const perSourceCache = Math.floor(totalCache / urls.length);
// Each source gets: totalCache / N
```
- 2 files → 250MB each
- 5 files → 100MB each
- More files = more network re-fetches per file

### Initialization
1. Creates N `McapIterableSource` instances (one per URL) with divided cache budget
2. Initializes all sources **in parallel** (`Promise.all`)
3. Merges results: topics, datatypes, metadata, topicStats, alerts, publishersByTopic
4. Sorts sources by start time (`source.getStart()`)

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
9. **Cache budget division** for multi-file: consider fewer large files over many small ones
10. **BufferedIterableSource** (10s, 300MB) smooths network latency for playback

## Common Pitfalls
- Server missing `Accept-Ranges: bytes` header → fails at open
- CORS not exposing `Accept-Ranges` header → browser can't detect range support
- Unindexed MCAP over remote → falls back to full streaming (slow, limited to 1GB)
- Too many remote files → cache per file drops below useful threshold
- S3 presigned URLs with non-GET method → `BrowserHttpReader.open()` requires GET

## Skills Reference
- Deep HTTP caching internals (CachedFilelike, VirtualLRUBuffer): `read_file(".github/skills/remote-caching/SKILL.md")`
- MCAP format structure and indexed reading: `read_file(".github/skills/mcap-format/SKILL.md")`
- Worker/Comlink patterns: `read_file(".github/skills/web-workers/SKILL.md")`
- BufferedIterableSource or BlockLoader details: `read_file(".github/skills/caching-internals/SKILL.md")`
- Network/read latency profiling and buffering performance: `read_file(".github/skills/performance/SKILL.md")`

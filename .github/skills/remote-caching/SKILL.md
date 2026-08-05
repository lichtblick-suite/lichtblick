---
name: "remote-caching"
description: "Deep implementation details of HTTP-layer caching for remote file access: CachedFilelike, VirtualLRUBuffer, connection management algorithm, BrowserHttpReader, FetchReader streaming, and RequestQueue concurrency control."
---

# Remote Caching Skill

## Full Pipeline (Remote MCAP)

```text
BrowserHttpReader (fetch + Range headers)
     │
     ▼
FetchReader (Streams API → EventEmitter: data/error/end)
     │
     ▼
CachedFilelike (LRU block cache via VirtualLRUBuffer)
     │
     ▼
BatchingReadable (coalesces nearby read() calls within a microtask tick)
     │
     ▼
RemoteFileReadable (IReadable adapter: size(), read(offset, size))
     │
     ▼                              ┌─── Worker boundary ───┐
McapIndexedReader (footer → summary → chunk index)           │
     │                                                       │
     ▼                                                       │
McapIndexedIterableSource (messageIterator, getBackfillMessages)
     │                                                       │
     └───────────────────────────────────────────────────────┘
     │
     ▼
BufferedIterableSource (10s read-ahead, 300MB max, producer-consumer)
     │
     ▼
DeserializingIterableSource (lazy deserialization)
     │
     ▼
IterablePlayer (tick loop, state machine)
```

---

## CachedFilelike

**Source**: `packages/suite-base/src/util/CachedFilelike.ts`

### Purpose
Provides in-memory LRU caching for streaming file reads. Sits between `BrowserHttpReader` (network) and `RemoteFileReadable` (MCAP reader). Manages a single HTTP connection at a time and intelligently decides when to open new connections.

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CACHE_BLOCK_SIZE` | 10 MiB | VirtualLRUBuffer block granularity |
| `CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION` | 5 MiB | Don't interrupt current download if it's within 5MB of the needed byte |
| `LOGGING_INTERVAL_IN_BYTES` | 300 MiB | Progress log frequency |
| Default `cacheSizeInBytes` (RemoteFileReadable) | 500 MiB | Total in-memory cache budget |


### Architecture
```typescript
class CachedFilelike {
  #fileReader: FileReader;           // BrowserHttpReader instance
  #cacheSizeInBytes: number;         // Max memory (default: Infinity, RemoteFileReadable sets 500MB)
  #virtualBuffer: VirtualLRUBuffer;  // Block-based LRU memory
  #currentConnection?: { stream, remainingRange };  // Single active HTTP stream
  #readRequests: { range, resolve, reject }[];      // Pending read queue
  #lastResolvedCallbackEnd?: number;                // Read-ahead hint
}
```

### Read Flow
1. `read(offset, length)` → queues a `readRequest` with range and promise
2. `#updateState()` fires:
   - Resolves any read requests whose data is already cached (`virtualBuffer.hasData()`)
   - Calls `getNewConnection()` to decide if a new HTTP stream is needed
3. If new connection needed → `#setConnection(range)`:
   - Destroys previous stream
   - Opens `fileReader.fetch(start, length)` → streaming `FetchReader`
   - On `data` chunks: copies into `VirtualLRUBuffer`, updates `remainingRange.start`
   - After each chunk: calls `#updateState()` to resolve newly-satisfiable reads

### Error Handling
- **With `keepReconnectingCallback`**: unlimited retries, callback notified of reconnection state
- **Without callback**: two errors within 100ms → fatal via `#closeWithError()` (destroys the active stream, rejects all pending `#readRequests`, cancels all `#activeUncachedReads`, resets `#virtualBuffer` to an empty `VirtualLRUBuffer`, and closes)
- **Single error**: destroys stream, clears connection, calls `#updateState()` to retry
- `close()` also funnels through `#closeWithError()` so explicit close and fatal shutdown share the same cleanup path

### VirtualLRUBuffer Initialization
```typescript
if (cacheSizeInBytes >= fileSize) {
  // Single block covering entire file (no eviction needed)
  new VirtualLRUBuffer({ size: fileSize });
} else {
  // Multiple 10MB blocks with LRU eviction
  new VirtualLRUBuffer({
    size: fileSize,
    blockSize: CACHE_BLOCK_SIZE,  // 10MB
    numberOfBlocks: Math.ceil(cacheSizeInBytes / CACHE_BLOCK_SIZE) + 2,
  });
}
```

---

## VirtualLRUBuffer

**Source**: `packages/suite-base/src/util/VirtualLRUBuffer.ts`

### Purpose
Represents an entire file in memory using fixed-size blocks, but only keeps `numberOfBlocks` blocks allocated at any time. Evicts least-recently-used blocks to stay within budget.

### Key Properties
- `byteLength`: total file size this buffer represents
- `#blockSize`: bytes per block (default ~1GiB, CachedFilelike uses 10MiB)
- `#numberOfBlocks`: max concurrent blocks (Infinity = no eviction)
- `#lastAccessedBlockIndices`: LRU order array (tail = most recent)
- `#rangesWithData`: simplified range array tracking which byte ranges have valid data

### Operations

| Method | Description |
|--------|-------------|
| `hasData(start, end)` | Returns true if entire range is cached (backed by `isRangeCoveredByRanges`) |
| `slice(start, end)` | Returns `Uint8Array` — efficient single-block slice or multi-block copy |
| `copyFrom(source, targetStart)` | Writes data, triggers block allocation/eviction |
| `getRangesWithData()` | Returns minimal list of cached ranges (for `getNewConnection`) |

### Eviction Algorithm
1. `copyFrom()` calls `#getBlock(index)` for each block the data spans
2. `#getBlock(index)`:
   - If block doesn't exist → allocate new `Uint8Array(blockSize)`
   - Move `index` to end of `#lastAccessedBlockIndices` (mark as most recently used)
   - If `#lastAccessedBlockIndices.length > #numberOfBlocks`:
     - `shift()` the least-recently-used index
     - `delete #blocks[deleteIndex]` (allows GC)
     - Remove evicted block's range from `#rangesWithData` via interval subtraction

### Performance Notes
- When all data fits in one block: `slice()` returns a view (no copy)
- Multi-block `slice()` requires copying into a new buffer
- `intervals-fn` library used for range algebra (`simplify`, `unify`, `substract`)

---

## getNewConnection Algorithm

**Source**: `packages/suite-base/src/util/getNewConnection.ts`

### Purpose
Determines whether CachedFilelike should open a new HTTP connection and what byte range to request. Called every time state changes (data received, read resolved, connection closed).

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `READ_AHEAD_BUFFER_SIZE` | 50 MiB | How far ahead to proactively download |


### Decision Logic

#### Case 1: Active read request exists
```text
1. Compute notDownloadedRanges = missingRanges(readRequest, downloadedRanges)
2. Start new connection if:
   a. No current connection exists, OR
   b. Current connection doesn't overlap with needed ranges, OR
   c. Current connection is >5MB away from first needed byte
3. If cache ≥ fileSize: download from first gap to next downloaded range
4. If downloading to end of request: read-ahead up to 50MB from request start
5. Otherwise: download first missing range
```

#### Case 2: No read request, no connection (proactive read-ahead)
```text
1. If cache ≥ fileSize: try to download entire file (prefer after lastResolvedCallbackEnd)
2. If cache < fileSize: download 50MB starting from lastResolvedCallbackEnd
3. Only download ranges not already cached (via missingRanges)
```

#### Case 3: Active connection, no read request
- No action needed — let the current connection continue

### Key Insight
The algorithm prioritizes **sequential reads** — after resolving a read request, it proactively fills the 50MB following that request. This matches MCAP's sequential chunk access pattern during playback.

---

## BrowserHttpReader

**Source**: `packages/suite-base/src/util/BrowserHttpReader.ts`

### `open()` — File Discovery
1. Makes a full GET request with `cache: "no-store"` (forces fresh response)
2. **Immediately aborts** the request (only needs headers)
3. Validates `Accept-Ranges: bytes` header (required for random access)
4. Extracts `Content-Length` for file size
5. Returns `{ size, identifier }` where identifier is `ETag` or `Last-Modified`

**Why GET instead of HEAD?**
- S3 presigned URLs often only permit GET
- Avoids CORS issues with `Content-Range` exposure

### `fetch(offset, length)` — Range Request
```typescript
const headers = new Headers({ range: `bytes=${offset}-${offset + length - 1}` });
const reader = new FetchReader(url, { headers });
reader.read();
return reader;  // FileStream interface
```

### CORS Requirements (browser)
- `Access-Control-Allow-Origin` must be set
- `Access-Control-Expose-Headers` must include `Accept-Ranges`
- Server must support `Range` request header

---

## FetchReader

**Source**: `packages/suite-base/src/util/FetchReader.ts`

### Purpose
Wraps the Fetch/Streams API into an EventEmitter pattern (`data`, `error`, `end`) compatible with `CachedFilelike`'s `FileStream` interface.

### Architecture
```typescript
class FetchReader extends EventEmitter<{ data, error, end }> {
  #response: Promise<Response>;    // Queued through globalRequestQueue
  #reader?: ReadableStreamDefaultReader<Uint8Array>;
  #controller: AbortController;    // For cancellation
}
```

### Read Loop
```text
read() → getReader() → reader.read() → emit("data", chunk) → read() [recursive]
                                      → if done: emit("end")
                                      → on error: emit("error") unless aborted
```

### Cancellation
- `destroy()` sets `#aborted = true` and calls `#controller.abort()`
- If stream read rejects due to abort → emits `"end"` (graceful)
- CachedFilelike calls `destroy()` when switching connections

---

## RequestQueue

**Source**: `packages/suite-base/src/util/RequestQueue.ts`

### Purpose
Global concurrency limiter for HTTP fetch requests. Prevents overwhelming the browser's connection pool or the server.

### Configuration
```typescript
const GLOBAL_REQUEST_QUEUE_MAX_CONCURRENT = 10;  // from constants.ts
export const globalRequestQueue = new RequestQueue(GLOBAL_REQUEST_QUEUE_MAX_CONCURRENT);
```

### Mechanism
- `run(fn)`: if `activeCount < maxConcurrent`, executes immediately
- Otherwise: queues a resolver; when a slot frees, the next queued function is unblocked
- FIFO ordering for fairness

### Impact on Remote Playback
- Each `FetchReader` construction goes through this queue
- Multi-file sources (N files) won't exceed 10 simultaneous HTTP requests even during parallel initialization
- Prevents browser from queueing requests at the TCP level (which has less visibility)

---

## RemoteFileReadable

**Source**: `packages/suite-base/src/players/IterablePlayer/Mcap/RemoteFileReadable.ts`

### Purpose
Thin adapter bridging `CachedFilelike` (byte-offset Filelike API) to `McapTypes.IReadable` (bigint offset/size API).

```typescript
const DEFAULT_CACHE_SIZE_BYTES = 1024 * 1024 * 500; // 500MiB

class RemoteFileReadable {
  #remoteReader: CachedFilelike;         // Cache size configurable, defaults to 500MiB
  #batchingReadable: BatchingReadable;   // Coalesces reads before CachedFilelike

  constructor(url: string, options?: { cacheSizeInBytes?: number; readAheadEnabled?: boolean }) {
    const fileReader = new BrowserHttpReader(url);
    this.#remoteReader = new CachedFilelike({
      fileReader,
      cacheSizeInBytes: options?.cacheSizeInBytes ?? DEFAULT_CACHE_SIZE_BYTES,
      readAheadEnabled: options?.readAheadEnabled,
    });
    const inner = {
      size: async () => BigInt(this.#remoteReader.size()),
      read: async (offset, size) => this.#remoteReader.read(Number(offset), Number(size)),
    };
    this.#batchingReadable = new BatchingReadable(inner);
  }

  async size(): Promise<bigint> { return BigInt(this.#remoteReader.size()); }
  async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    return await this.#batchingReadable.read(offset, size);  // → coalesced → CachedFilelike
  }
}
```

---

## BatchingReadable

**Source**: `packages/suite-base/src/players/IterablePlayer/Mcap/BatchingReadable.ts`

### Purpose
Coalescing layer between `McapIndexedReader` and `CachedFilelike`. Accumulates `read()` calls that arrive within the same microtask tick, sorts them by offset, and merges those whose gap is `< 64 KiB` (up to a `4 MiB` merged span) into a single underlying read — cutting HTTP Range requests for MCAP files with many small chunks.

### Notes
- Single-member groups are forwarded zero-copy; multi-member groups are sliced (copied) per request so a small result does not pin the full merged buffer in memory.
- Only coalesces reads that are concurrently pending in the same tick. `McapIndexedReader` issues reads strictly sequentially (each awaited before the next), so real coalescing depends on concurrent access — validate request-count reduction empirically for a given workload.

---

## HydratedSourcePool

**Source**: `packages/suite-base/src/players/IterablePlayer/shared/HydratedSourcePool.ts`

### Purpose
Bounds resident heavyweight per-file reader objects (for example `McapIndexedReader` instances with chunk indexes, channel schemas, and deserializers) using a hybrid **count + byte** budget. This is a separate layer from `CachedFilelike`: it manages parsed reader objects, not raw downloaded file bytes and not decoded message payloads.

### Key Properties
- Constructor options are all optional: `HydratedSourcePoolOptions = { maxBytes?, maxCount?, minResident? }`
- `maxCount` is normalized to `Math.max(1, Math.floor(...))`, or `Infinity` when unset
- `maxBytes` defaults to `Infinity`
- `minResident` defaults to `1`, then clamps to `Math.min(maxCount, Math.max(1, Math.floor(...)))`
- Internal state is a `Map<object, Entry>` where:
  - `token` = caller-owned identity object for one source
  - `Entry = { hydrator, value: Promise<unknown>, pins: number, weight: number }`
- JavaScript `Map` preserves insertion order. Deleting and re-setting an entry on access refreshes recency, so iteration order is LRU order (first entry = least recently used).

### Architecture
```typescript
type SourceHydrator<T> = {
  open: () => Promise<T>;
  close: (value: T) => Promise<void>;
  weigh?: (value: T) => number;
};

type Entry = {
  hydrator: SourceHydrator<unknown>;
  value: Promise<unknown>;
  pins: number;
  weight: number;
};

class HydratedSourcePool {
  #entries: Map<object, Entry>;  // insertion order = LRU order
  #totalWeight: number;          // sum of resident entry weights
  #terminated: boolean;
}
```

### Operations

| Method | Description |
|--------|-------------|
| `acquire(token, hydrator)` | Returns a resident value, opening it on demand and pinning it while in use |
| `release(token)` | Decrements the pin count (never below 0) and opportunistically triggers eviction |
| `admit(token, hydrator, value)` | Seeds the pool with an already-open value, usually from a source's own initialization path |
| `terminate()` | Prevents future admission/hydration, clears the pool, and closes every resident value |

### `acquire()` / `release()` lifecycle
1. `acquire(token, hydrator)` checks `#terminated` first and immediately throws `"HydratedSourcePool has been terminated"` when shutdown has started.
2. If the token is already resident:
   - delete + re-set the `Map` entry to refresh LRU position
   - increment `pins`
   - await and return the cached `value` promise
   - if that promise rejects, roll back the pin increment and rethrow so a co-pending failed `open()` does not leak a phantom pin
3. If the token is not resident:
   - insert a new entry with `pins: 1`, `value: hydrator.open()`, `weight: 0`
   - await the value
   - compute `weight = Math.max(0, hydrator.weigh?.(value) ?? 1)`
   - add the weight to `#totalWeight`
   - run eviction and return the value
4. If a new entry's hydration rejects:
   - decrement `pins`
   - only delete the map entry when `this.#entries.get(token) === entry`
   - this identity guard prevents a late rejection from deleting a newer entry recreated for the same token by another caller
5. `release(token)` decrements `pins` when the entry still exists, then fires-and-forgets `#evictBeyondCapacity()` so newly unpinned entries can be reclaimed.

### `admit()` and `terminate()`
- `admit(token, hydrator, value)` lets callers seed the pool with an already-hydrated value, avoiding a redundant `open()` call.
- If the pool is already terminated, `admit()` immediately closes the supplied value instead of retaining it.
- If the token is already resident, the pool keeps the existing entry, refreshes its LRU position, and closes the redundant newly supplied value.
- Otherwise it inserts the value as an **unpinned** entry (`pins: 0`), computes weight, updates `#totalWeight`, and runs eviction. A newly admitted value may be evicted immediately if the pool is already over budget.
- `terminate()` sets `#terminated = true` **before** clearing the map so concurrent or later `acquire()` / `admit()` calls cannot repopulate the pool during shutdown.
- Shutdown snapshots the entries, clears the map, resets `#totalWeight` to 0, and closes every resolved value in parallel. Each close is individually guarded so one failing `close()` does not stop the rest.

### Eviction Algorithm
`#isOverCapacity()` returns:
- `false` when `entries.size <= minResident`
- otherwise `true` when either:
  - `entries.size > maxCount`, or
  - `#totalWeight > maxBytes`

`#evictBeyondCapacity()` then:
1. Loops while `#isOverCapacity()` remains true
2. Scans current `Map` iteration order (LRU order)
3. Picks the **first** entry with `pins === 0`
4. Deletes it from the map **before** awaiting `close()` so concurrent eviction passes cannot target it twice
5. Subtracts its weight from `#totalWeight`
6. Awaits `hydrator.close(value)` and logs errors instead of throwing

If every remaining entry is pinned, eviction stops early. The pool may temporarily remain over `maxCount` and/or `maxBytes`; that is intentional because pinned entries are actively in use and cannot be evicted.

### Termination Semantics
- `#terminated` is a hard gate, not just a best-effort hint
- `acquire()` after termination throws immediately
- `admit()` after termination discards and closes the supplied value immediately
- Because the flag is set before the map is cleared, concurrent shutdown cannot race with a new resident entry being retained after `terminate()`

### readerWeight.ts / `estimateReaderWeightBytes`

**Source**: `packages/suite-base/src/players/IterablePlayer/Mcap/readerWeight.ts`

```typescript
export const READER_BASE_BYTES = 2 * 1024 * 1024; // fixed reader/deserializer overhead
const BYTES_PER_CHUNK_INDEX_BASE = 128; // fixed scalar fields of one ChunkIndex
const BYTES_PER_MESSAGE_INDEX_ENTRY = 64; // one messageIndexOffsets entry per (chunk, channel)
const BYTES_PER_CHANNEL = 16 * 1024; // parsed schema + per-channel deserializer

export function estimateReaderWeightBytes(reader: McapIndexedReader): number {
  let messageIndexEntries = 0;
  for (const chunkIndex of reader.chunkIndexes) {
    messageIndexEntries += chunkIndex.messageIndexOffsets.size;
  }
  return (
    READER_BASE_BYTES +
    reader.chunkIndexes.length * BYTES_PER_CHUNK_INDEX_BASE +
    messageIndexEntries * BYTES_PER_MESSAGE_INDEX_ENTRY +
    reader.channelsById.size * BYTES_PER_CHANNEL
  );
}
```

This is the `weigh()` heuristic for pooled MCAP readers:
- `READER_BASE_BYTES` models fixed parser/deserializer overhead
- chunk-index count, message-index-entry count, and channel count scale the estimate with file complexity
- there is no `cacheBytes` parameter — the weight reflects only reader/index/channel structure size, not each source's byte-cache allocation (for example its `CachedFilelike` budget)

Absolute values are approximate; the relative weighting is what matters. Heavier readers do not get special eviction priority directly — eviction still removes the next LRU unpinned entry — but heavier readers push the pool over `maxBytes` sooner, causing LRU eviction pressure earlier.

### Session-Persistent Connections & Unpooled Fallback

- **`type: "url"` persistent transport**: pooled indexed URL sources create `RemoteFileReadable` once, stash it in `#persistentReadable`, and reuse that same connection + internal `CachedFilelike` byte cache across every later `HydratedSourcePool.acquire()` re-hydration; the source hydrator's `close()` only tears down the heavyweight `McapIndexedReader` / parsed-channel state. `#persistentReadable.close()` happens in three cases: indexed initialization itself fails, the source falls back to the unindexed streaming path (raw `fetch()` bypasses the pool/readable entirely), or the whole `McapIterableSource` is `terminate()`d at normal session end (the common case for a healthy indexed source). `type: "file"` has no analogous persistent transport because the backing `Blob` is already resident.
- **Unindexed sources bypass the pool**: if a source ends up unindexed (`chunkIndexes.length === 0`, `channelsById.size === 0`, or the URL fallback path triggers), `McapIterableSource` does **not** `admit()` / `acquire()` it from `HydratedSourcePool` even when a pool exists; it stores the resulting `McapUnindexedIterableSource` in `#eagerInner` for the full session instead. Practical consequence: many large unindexed MCAPs can grow memory usage outside `maxHydratedSources` / `maxHydratedBytes`, because re-hydrating them would require replaying the whole stream/file from scratch.

---

## Multi-File Cache Budget Distribution

When `MultiIterableSource` handles multiple remote URLs:
```typescript
const totalCache = dataSource.totalCacheSizeInBytes ?? 500 * 1024 * 1024;  // 500MB total
const minPerSource = dataSource.minCachePerSourceBytes ?? 10 * 1024 * 1024;  // 10MiB floor
const perSourceCache = Math.max(minPerSource, Math.floor(totalCache / urls.length));
// Each McapIterableSource gets perSourceCache for its RemoteFileReadable
```

**Example**: 3 remote MCAP files → each gets ~166MB cache budget.

This means:
- More files = less cache per file = more network re-fetches
- `MIN_CACHE_PER_SOURCE_BYTES = 10 MiB` prevents multi-file sessions from slicing the total budget so small that a single MCAP summary/index read can crash `CachedFilelike`
- `dataSource.minCachePerSourceBytes` overrides that floor when a caller needs a different minimum
- `totalCacheSizeInBytes` is **not a hard aggregate cap**: because `perSourceCache = Math.max(minPerSource, Math.floor(totalCache / numSources))`, the per-source floor can win when there are many sources. When `perSourceCache * numSources > totalCache`, a `log.warn` reports it and the real aggregate cache usage exceeds the nominal `totalCacheSizeInBytes`
- `readAheadEnabled` still defaults to `true` for both single- and multi-file sessions (unless `dataSource.readAheadEnabled` overrides it); what changes for `urls.length > 1` is `readAheadBufferBytes`, which defaults to `min(2 MiB, perSourceCache / 4)` instead of the legacy 50 MiB default, bounding read-ahead so it doesn't outrun the smaller per-source cache slice
- For large multi-file datasets, consider increasing `totalCacheSizeInBytes`
- Each file's CachedFilelike manages its own VirtualLRUBuffer independently

> `totalCacheSizeInBytes` / `perSourceCache` govern the **raw byte cache** for each source's `CachedFilelike` / `RemoteFileReadable`. `HydratedSourcePool` adds a separate resident-reader-object budget (`maxBytes` / `maxCount`) for parsed `McapIndexedReader` instances. Both budgets apply at the same time and solve different memory problems.

---

## Key Files Reference

| File | Role |
|------|------|
| `packages/suite-base/src/util/CachedFilelike.ts` | LRU-cached streaming file reader |
| `packages/suite-base/src/util/VirtualLRUBuffer.ts` | Block-level LRU memory management |
| `packages/suite-base/src/util/getNewConnection.ts` | HTTP connection decision algorithm |
| `packages/suite-base/src/util/BrowserHttpReader.ts` | HTTP Range request implementation |
| `packages/suite-base/src/util/FetchReader.ts` | Streams API EventEmitter adapter |
| `packages/suite-base/src/util/RequestQueue.ts` | Global concurrency limiter (10 max) |
| `packages/suite-base/src/players/IterablePlayer/Mcap/RemoteFileReadable.ts` | IReadable adapter (500MB default); reads pass through BatchingReadable |
| `packages/suite-base/src/players/IterablePlayer/Mcap/BatchingReadable.ts` | Coalesces nearby `read()` calls (gap <64KiB, ≤4MiB span) into fewer inner reads |
| `packages/suite-base/src/players/IterablePlayer/shared/HydratedSourcePool.ts` | Resident-reader pool with LRU eviction across count and byte budgets |
| `packages/suite-base/src/players/IterablePlayer/shared/multiFileHydrationOptions.ts` | Shared multi-file hydration override merging, used by both data source factories and the MCAP worker |
| `packages/suite-base/src/players/IterablePlayer/shared/types.ts` | `SourceHydrator` and `HydratedSourcePoolOptions` type definitions |
| `packages/suite-base/src/players/IterablePlayer/Mcap/readerWeight.ts` | Heuristic weight estimate for pooled MCAP readers |

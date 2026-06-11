---
description: "Deep implementation details of HTTP-layer caching for remote file access: CachedFilelike, VirtualLRUBuffer, connection management algorithm, BrowserHttpReader, FetchReader streaming, and RequestQueue concurrency control."
---

# Remote Caching Skill

## Full Pipeline (Remote MCAP)

```
BrowserHttpReader (fetch + Range headers)
     │
     ▼
FetchReader (Streams API → EventEmitter: data/error/end)
     │
     ▼
CachedFilelike (LRU block cache via VirtualLRUBuffer)
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
- **Without callback**: two errors within 100ms → fatal (rejects all pending reads, closes)
- **Single error**: destroys stream, clears connection, calls `#updateState()` to retry

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
```
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
```
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
```
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
class RemoteFileReadable {
  #remoteReader: CachedFilelike;  // Configured with 500MB cache

  constructor(url: string, cacheSizeInBytes = 500 * 1024 * 1024) {
    const fileReader = new BrowserHttpReader(url);
    this.#remoteReader = new CachedFilelike({ fileReader, cacheSizeInBytes });
  }

  async size(): Promise<bigint> { return BigInt(this.#remoteReader.size()); }
  async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    return await this.#remoteReader.read(Number(offset), Number(size));
  }
}
```

---

## Multi-File Cache Budget Distribution

When `MultiIterableSource` handles multiple remote URLs:
```typescript
const totalCache = dataSource.totalCacheSizeInBytes ?? 500 * 1024 * 1024;  // 500MB total
const perSourceCache = Math.floor(totalCache / urls.length);
// Each McapIterableSource gets perSourceCache for its RemoteFileReadable
```

**Example**: 3 remote MCAP files → each gets ~166MB cache budget.

This means:
- More files = less cache per file = more network re-fetches
- For large multi-file datasets, consider increasing `totalCacheSizeInBytes`
- Each file's CachedFilelike manages its own VirtualLRUBuffer independently

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
| `packages/suite-base/src/players/IterablePlayer/Mcap/RemoteFileReadable.ts` | IReadable adapter (500MB default) |

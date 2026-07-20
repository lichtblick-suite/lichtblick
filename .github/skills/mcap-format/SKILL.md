---
description: "MCAP file format specification knowledge: binary structure, record types, indexing strategies, compression options, and best practices for creating MCAP files that optimize Lichtblick reading performance."
---

# MCAP Format Skill

## Format Overview

MCAP is an open-source container format for heterogeneous timestamped data, designed for high-performance reading of robotics/autonomous driving recordings.

**Specification**: https://mcap.dev/spec

**Documentation**:
- Full specification (record types, serialization, diagrams): https://mcap.dev/spec
- API reference & library docs: https://mcap.dev/docs/swift/documentation/mcap/
- Feature explanations for implementers: https://mcap.dev/spec/notes#feature-explanations
- Well-known profiles registry: https://mcap.dev/spec/registry
- Kaitai Struct description: https://github.com/foxglove/mcap/blob/main/website/docs/spec/mcap.ksy

## Binary Structure

```text
┌─────────────────────────────────────────┐
│ Magic bytes (8 bytes)                   │
├─────────────────────────────────────────┤
│ Header record                           │
│   - profile: "ros1" | "ros2" | ""       │
│   - library: writer identifier          │
├─────────────────────────────────────────┤
│ DATA SECTION                            │
│   Schema records                        │
│   Channel records                       │
│   Message records (bulk of file)        │
│   Attachment records (optional)         │
│   Metadata records (optional)           │
│   ─── grouped into Chunks ───           │
├─────────────────────────────────────────┤
│ DataEnd record                          │
├─────────────────────────────────────────┤
│ SUMMARY SECTION (optional but critical) │
│   Schema records (copy)                 │
│   Channel records (copy)                │
│   ChunkIndex records                    │
│   AttachmentIndex records               │
│   MetadataIndex records                 │
│   Statistics record                     │
├─────────────────────────────────────────┤
│ Footer record                           │
│   - summarySectionOffset                │
│   - summarySectionCrc                   │
├─────────────────────────────────────────┤
│ Magic bytes (8 bytes)                   │
└─────────────────────────────────────────┘
```

## Record Types

### Header
- `profile`: Identifies message conventions (e.g., `"ros1"`, `"ros2"`)
- `library`: Identifies the writing library (for debugging)

### Schema
- `id`: Unique schema identifier within the file
- `name`: Schema name (e.g., `"sensor_msgs/PointCloud2"`)
- `encoding`: How to interpret schema data (`"ros1msg"`, `"ros2msg"`, `"protobuf"`, `"flatbuffer"`, `"jsonschema"`, `"ros2idl"`)
- `data`: Raw schema definition bytes

### Channel
- `id`: Unique channel identifier
- `topic`: Topic name (e.g., `"/camera/image"`)
- `schemaId`: References a Schema record
- `messageEncoding`: How messages are serialized (`"ros1"`, `"cdr"`, `"json"`, `"protobuf"`, `"flatbuffer"`)
- `metadata`: Key-value pairs (e.g., `callerid` for ROS 1 publisher identification)

### Message
- `channelId`: Which channel this message belongs to
- `logTime`: When the message was recorded (nanoseconds)
- `publishTime`: When the message was originally published (nanoseconds)
- `data`: Raw serialized message bytes
- `sequence`: Optional sequence number

### Chunk
- `compression`: `"zstd"` | `"lz4"` | `""` (none)
- `data`: Compressed block containing Schema + Channel + Message records
- Messages within a chunk are ordered by `logTime`
- Chunk boundaries define the granularity of random access

### ChunkIndex (Summary)
- `messageStartTime` / `messageEndTime`: Time range of messages in this chunk
- `chunkOffset`: Byte offset of the chunk in the file
- `messageIndexOffsets`: Per-channel index within the chunk
- **Critical for random access** — without these, no seeking is possible

### Statistics (Summary)
- `messageCount`: Total messages in file
- `channelMessageCounts`: Per-channel message counts
- `schemaCount`: Number of schemas
- `channelCount`: Number of channels
- `chunkCount`: Number of chunks
- `messageStartTime` / `messageEndTime`: Global time bounds

### Attachment
- Named binary blobs (e.g., calibration files, maps)
- Indexed separately from messages
- Not time-ordered with messages

### Metadata
- Named key-value string maps
- Used for recording metadata (robot name, location, session info)

## Indexed vs Unindexed Reading

### Indexed (preferred for Lichtblick)
- File has Summary section with ChunkIndex records
- Reader reads Footer → jumps to Summary → builds index in memory
- Random access: find chunks overlapping time range → read only those chunks
- Reverse iteration: read chunks in reverse order for backfill
- **Lichtblick uses**: `McapIndexedReader` → `McapIndexedIterableSource`

### Unindexed (fallback)
- No Summary section — file must be read sequentially from start
- All messages loaded into memory (Lichtblick limits to 1GB)
- No seeking, no backfill, no progress reporting during load
- **Lichtblick uses**: `McapStreamReader` → `McapUnindexedIterableSource`

## Compression Trade-offs

| Algorithm | Ratio | Decompress Speed | Best For |
|-----------|-------|-----------------|----------|
| `zstd` | Excellent (~3-5x) | Fast | Storage, archival, remote files |
| `lz4` | Good (~2-3x) | Very fast | Real-time recording, low-latency playback |
| None | 1:1 | Instant | Debugging, maximum seek speed |

### Impact on Lichtblick
- Decompression uses WASM modules (`wasm-zstd`, `wasm-lz4`, `wasm-bz2`)
- Modules are loaded lazily on first MCAP open (adds ~100ms startup)
- `loadDecompressHandlers()` is a singleton — loads once, shared across all readers
- Larger chunks with zstd = fewer decompressions but more memory per chunk

## Best Practices for Optimal Lichtblick Performance

### 1. Always Include Chunk Indexes
- Without indexes, Lichtblick falls back to streaming (1GB limit, no seek)
- Write summary section at end of file with all ChunkIndex records
- Include Statistics record for immediate UI display of file metadata

### 2. Put Schemas and Channels in Summary
- Allows Lichtblick to display topic list without reading data section
- Speeds up initialization (only 2 Range requests for remote files)

### 3. Target ~4MB Chunk Size
- Too small (<100KB): excessive index overhead, many seeks
- Too large (>50MB): wastes memory when seeking (must decompress full chunk)
- ~4MB: good balance for random access granularity vs overhead

### 4. Use Consistent Chunk Boundaries
- Align chunk boundaries with logical time units when possible
- Avoid chunks spanning very long time ranges (hurts seek precision)

### 5. Order Messages by logTime Within Chunks
- MCAP spec allows out-of-order, but ordered messages enable streaming reads
- Lichtblick's reader assumes `logTime` ordering within chunks

### 6. Include callerid in Channel Metadata (ROS)
- Used by Lichtblick to identify publishers per topic
- Helps with diagnostics and multi-publisher scenarios

### 7. Choose Compression Based on Use Case
- Remote viewing: `zstd` (minimize download size, acceptable decompress cost)
- Local playback: `lz4` (fastest decompress, acceptable file size)
- Real-time recording: `lz4` or none (lowest CPU overhead during recording)

## Lichtblick Code Mapping

| MCAP Concept | Lichtblick Code |
|-------------|----------------|
| Indexed reading | `McapIndexedReader` (from `@mcap/core`) |
| Streaming reading | `McapStreamReader` (from `@mcap/core`) |
| Indexed source | `McapIndexedIterableSource.ts` |
| Unindexed source | `McapUnindexedIterableSource.ts` |
| File readable | `BlobReadable.ts` (local), `RemoteFileReadable.ts` (HTTP Range) |
| Remote read coalescing | `BatchingReadable.ts` (merges nearby `read()` calls in a microtask tick) |
| Decompression | `packages/mcap-support/src/decompressHandlers.ts` |
| Schema parsing | `packages/mcap-support/src/parseChannel.ts` |
| 10s read-ahead (default) | `BufferedIterableSource` (`DEFAULT_READ_AHEAD_DURATION = { sec: 10, nsec: 0 }`) |
| Reverse iteration | `McapIndexedIterableSource.getBackfillMessages()` |

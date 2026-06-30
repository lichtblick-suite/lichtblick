---
description: "Deep deserialization knowledge: parseChannel schema dispatch, ros1msg/ros2msg/ros2idl/jsonschema/protobuf/flatbuffer decoders, WASM decompression handlers, and the DeserializingIterableSource wrapping pattern."
---

# Deserialization Skill

Converts raw binary message data into structured JavaScript objects.

## Flow

```text
Raw bytes (from source)
    │
    ▼
DeserializingIterableSource (applies parseChannel-based decode)
    │
    ▼
Decoded message objects (ready for panels)
```

## Schema Encodings

| Encoding | Schema Format | Deserializer |
|----------|--------------|--------------|
| `ros1msg` | ROS 1 message definition text | `@lichtblick/rosmsg-serialization` `MessageReader` |
| `ros2msg` | ROS 2 message definition text | `@lichtblick/rosmsg2-serialization` `MessageReader` |
| `ros2idl` | OMG IDL text | `@lichtblick/omgidl-serialization` `MessageReader` |
| `jsonschema` | JSON Schema object | `JSON.parse` + `postprocessValue` (base64 decode) |
| `protobuf` | `FileDescriptorSet` binary | `protobufjs` `Root.fromDescriptor` |
| `flatbuffer` | Binary reflection schema | `flatbuffers_reflection` `Parser` |

## Core Entry Point: `parseChannel()`

`packages/mcap-support/src/parseChannel.ts`:

```typescript
function parseChannel(channel: Channel): ParsedChannel {
  // Returns { deserialize: (data: ArrayBufferView) => unknown, datatypes: Map }
  // Dispatches based on channel.schema.encoding
}
```

This is the single function that resolves any channel's schema into a deserializer.

### Per-encoding parsers
- `packages/mcap-support/src/parseProtobufSchema.ts`
- `packages/mcap-support/src/parseFlatbufferSchema.ts`
- `packages/mcap-support/src/parseJsonSchema.ts`

## DeserializingIterableSource

`packages/suite-base/src/players/IterablePlayer/DeserializingIterableSource.ts`:

- Wraps a serialized source (`ISerializedIterableSource`)
- Applies `parseChannel()` to each channel's schema at initialization
- Deserializes messages on-the-fly as they are iterated
- Produces `IDeserializedIterableSource` (messages are JS objects, not raw bytes)
- Supports sampling (`setSamplingWindowEnd()` for latest-per-render-tick mode)

> ⚠️ This wrapper is **only** inserted for serialized sources. Sources that already implement
> `IDeserializedIterableSource` skip it.

## WASM Decompression Handlers

`packages/mcap-support/src/decompressHandlers.ts`:
- **zstd**: `@lichtblick/wasm-zstd` — best compression ratio
- **lz4**: `@lichtblick/wasm-lz4` — fastest decompression
- **bz2**: `@lichtblick/wasm-bz2` — legacy support

Handlers are loaded once (singleton promise) and shared across all readers.

## Performance Notes

- Deserialization is CPU-bound — runs in a Worker via `WorkerIterableSource`
- Protobuf: `root.lookupType()` is cached after first call
- JSON: `postprocessValue` handles base64 → `Uint8Array` for `bytes` fields
- Flatbuffers: zero-copy read from the shared buffer (fastest)
- ROS: `MessageReader` precompiles field offsets at schema-parse time

## Skills Reference
- For MCAP chunk structure: load `mcap-format` skill
- For Worker patterns: load `web-workers` skill
- For the iterator layering: load `player-internals` skill

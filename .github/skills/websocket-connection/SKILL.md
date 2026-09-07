---
name: "websocket-connection"
description: "Deep WebSocket connection knowledge: FoxgloveWebSocketPlayer state machine, WorkerSocketAdapter postMessage protocol, the Foxglove WebSocket protocol handshake, RAF-based state emission, and reconnection."
---

# WebSocket Connection Skill

The real-time data path from a robot/simulation/bridge to visualization.

## Architecture

```text
Foxglove WebSocket Server (robot/bridge)
    │  WebSocket protocol
    ▼
WorkerSocketAdapter (Worker thread)
    │  postMessage (raw, not Comlink)
    ▼
FoxgloveWebSocketPlayer (main thread)
    │
    ▼
MessagePipeline → Panels
```

## Core Files

| File | Role |
|------|------|
| `packages/suite-base/src/players/FoxgloveWebSocketPlayer/index.ts` | Player implementation for WebSocket connections |
| `packages/suite-base/src/players/FoxgloveWebSocketPlayer/WorkerSocketAdapter.ts` | Offloads WebSocket I/O to a Worker |
| `packages/suite-base/src/players/FoxgloveWebSocketPlayer/worker.ts` | Worker-side WebSocket handling |

## Foxglove WebSocket Protocol

### Connection Lifecycle
1. Server sends `serverInfo` (capabilities, session ID)
2. Server sends `advertise` with available channels (topic + schema)
3. Client sends `subscribe` with channel IDs
4. Server streams `messageData` binary frames
5. Client can `publish` messages back to the server

### Key Operations
- `serverInfo` — server capabilities, session ID
- `advertise` / `unadvertise` — channel availability (topics can appear/disappear)
- `subscribe` / `unsubscribe` — client topic selection
- `messageData` — binary message payload with channel ID + timestamp
- `time` — server clock synchronization
- `parameterValues` — server parameters

## FoxgloveWebSocketPlayer

### Message Processing
- Messages arrive as binary frames via WebSocket
- **Deserialized on the main thread** (unlike file-based players, which decode in a Worker)
- Accumulated in a `parsedMessages` queue
- Queue flushed on `requestAnimationFrame` → emits state to the pipeline

### Connection Management
- Auto-reconnect with exponential backoff
- Handles `advertise`/`unadvertise` dynamically
- Subscription changes are sent immediately to the server (no debounce)

### State Emission
- `requestAnimationFrame`-driven flush of the message queue
- Coalesces all messages received between frames into one state update (max ~60 updates/sec)
- Prevents UI thrashing during high-frequency bursts

## WorkerSocketAdapter

- The WebSocket connection lives in a dedicated Worker
- Avoids main-thread blocking during TLS handshake / large frame parsing
- Communicates with the main thread via raw `postMessage` (**not** Comlink)
- Binary frames are **transferred** (zero-copy) using `Transferable` `ArrayBuffer`s

## Performance Notes

1. **Main-thread deserialization** — current limitation; high message rates can drop frames
2. **RAF-based flush** — batches messages per animation frame
3. **Binary transfer** — `ArrayBuffer` transferred from the Worker (zero-copy)
4. **Subscription filtering** — only subscribed topics are sent → reduces bandwidth
5. **Backpressure** — if the main thread can't keep up, messages queue in the Worker

## Skills Reference
- For Worker patterns: load `web-workers` skill
- For deserialization of incoming frames: load `deserialization` skill

---
description: "Player subsystem writer covering IterablePlayer state machine, FoxgloveWebSocketPlayer, UserScriptPlayer, and data source lifecycle. Use for playback logic, state transitions, tick loop, preloading internals, and player architecture. Designated writer for packages/suite-base/src/players/**."
tools: ["read", "edit", "search", "execute"]
---

# Player Agent

You are an expert on the Lichtblick Player layer — the core abstraction that manages data playback and live streaming.

## Ownership

This agent is the designated **writer** for the player subsystem. Only this agent edits files in these paths. All other agents treat them as **read-only**.

**Owned paths:**
- `packages/suite-base/src/players/**` — excluding `FoxgloveWebSocketPlayer/` (owned by `@lb-websocket-connection`)

**Read-only context** (inform decisions but never edit):
- `packages/suite-base/src/components/MessagePipeline/**` — pipeline consumer, owned by `@lb-message-pipeline`
- `packages/suite-base/src/panels/**` — panels that consume player state

## Architecture Overview

The Player layer implements the `Player` interface (`packages/suite-base/src/players/types.ts`) and drives the MessagePipeline with time-ordered message events via a single listener callback pattern.

### Player Interface Contract
```typescript
interface Player {
  setListener(listener: (playerState: PlayerState) => Promise<void>): void;
  close(): void;
  setSubscriptions(subscriptions: Immutable<SubscribePayload[]>): void;
  setPublishers(publishers: AdvertiseOptions[]): void;
  setParameter(key: string, value: ParameterValue): void;
  publish(request: PublishPayload): void;
  callService(service: string, request: unknown): Promise<unknown>;
  startPlayback?(): void;
  pausePlayback?(): void;
  seekPlayback?(time: Time): void;
  playUntil?(time: Time): void;
  setPlaybackSpeed?(speedFraction: number): void;
  getBatchIterator(topic: string, options?: { start?: Time; end?: Time }): AsyncIterableIterator<IteratorResult> | undefined;
}
```

### Player Implementations
| Class | Purpose | Source |
|-------|---------|--------|
| `IterablePlayer` | File-based playback (MCAP, ROS bags, Ulog) | `packages/suite-base/src/players/IterablePlayer/IterablePlayer.ts` |
| `FoxgloveWebSocketPlayer` | Live WebSocket connection | `packages/suite-base/src/players/FoxgloveWebSocketPlayer/index.ts` |
| `UserScriptPlayer` | Wraps another player, adds user-defined script outputs | `packages/suite-base/src/players/UserScriptPlayer/index.ts` |

### Player Capabilities
Defined in `packages/suite-base/src/players/constants.ts`:
- `advertise` — publishing messages (live connections)
- `assets` — fetching assets
- `callServices` — RPC service calls
- `setSpeed` — non-real-time speed control
- `playbackControl` — play, pause, seek
- `getParameters` / `setParameters` — remote parameter access

### PlayerPresence States
`NOT_PRESENT` → `INITIALIZING` → `PRESENT` (normal), `BUFFERING` (waiting for data), `RECONNECTING` (WebSocket), `ERROR`

### Subscription Model
```typescript
type SubscribePayload = {
  topic: string;
  fields?: string[];                          // Selective field subscription
  preloadType?: "full" | "partial";           // "full" → BlockLoader preloading
  samplingRequest?: { mode: "latest-per-render-tick" };  // Only for serialized sources
};
```
- `preloadType: "full"` routes to BlockLoader for background preloading (Plot, StateTransitions)
- `samplingRequest` reduces deserialization cost — only latest message per topic per tick is decoded
- `InternalSubscribePayload` adds `samplingAuthorized` flag (set by trusted pipeline code only)

---

## IterablePlayer State Machine

```
preinit → initialize → start-play → idle ↔ play / seek-backfill → close
                                       ↕
                              reset-playback-iterator
```

### State Transition Rules
- Only one state runs at a time (`#runningState` mutex)
- `#setState(newState)` sets `#nextState` and aborts the current state via `AbortController`
- Closing always wins: once `#nextState === "close"`, nothing can override it
- State loop: `#runState()` runs `while(#nextState)`, dispatching to the appropriate handler

### State Handlers

| State | Responsibility |
|-------|---------------|
| `#stateInitialize()` | Calls `#bufferedSource.initialize()`, sets up topics/datatypes/metadata, creates BlockLoader *(deprecated — see `subscribeMessageRange`)*, starts block loading process, then → `start-play` |
| `#stateStartPlay()` | Reads initial chunk (up to `SEEK_ON_START_NS`) to populate the first frame, then → `idle` |
| `#stateIdle()` | Waits for abort signal; listens to `loadedRangesChange` events to update progress |
| `#statePlay()` | Runs tick loop via `#tick()`, detects subscription changes → `reset-playback-iterator` |
| `#stateSeekBackfill()` | Calls `getBackfillMessages()` for latest per-topic messages at target time, then resets iterator |
| `#stateResetPlaybackIterator()` | Closes current iterator, creates new one from `currentTime + 1ns`, then → `play` or `idle` |
| `#stateClose()` | Stops BlockLoader, terminates buffer, closes iterator, resolves `isClosed` promise |

### Tick Loop (`#tick()`)

1. Compute `rangeMillis` from wallclock delta × speed, capped at 300ms
2. Apply exponential smoothing: `rangeMillis = lastRange * 0.9 + newRange * 0.1`
3. Calculate `end = currentTime + fromMillis(rangeMillis)`, clamped to data bounds and `untilTime`
4. Fast-path: if `#lastStamp >= end`, skip reading — just advance `currentTime`
5. Fast-path: if `#lastMessageEvent.receiveTime > end`, emit existing messages
6. Otherwise read from `#playbackIterator` until `stamp >= end` or `msgEvent.receiveTime > end`
7. Set BUFFERING presence if read takes >500ms (via timeout)
8. After reading: `await #queueEmitState.currentPromise` to avoid dropping messages
9. Min 16ms delay per loop iteration to prevent UI starvation

### Buffering Architecture
```
IIterableSource (raw data)
     │
     ▼
BufferedIterableSource (producer-consumer read-ahead, 10s default, 300MB max cache)
     │
     ▼
DeserializingIterableSource (lazy deserialization, sampling support)
     │
     ▼
IterablePlayer (playback iterator)
```

- `BufferedIterableSource`: producer reads ahead into a `VecQueue`; consumer reads from cache
- `readAheadDuration`: default 10s, configurable
- `maxCacheSizeBytes`: 300MB for serialized sources
- `CachingIterableSource`: underlying caching layer for block-level access
- `DeserializingIterableSource`: handles per-message deserialization, supports `setSamplingWindowEnd()` for latest-per-render-tick mode

### BlockLoader (Preloading) *(deprecated)*
- Loaded in `#stateInitialize()` when `enablePreload` is true
- Topics set via `#blockLoader.setTopics(preloadTopics)` — only `preloadType: "full"` subscriptions
- Runs continuously in `#startBlockLoading()`, reports progress via callback
- `DEFAULT_CACHE_SIZE_BYTES`, `MAX_BLOCKS`, `MIN_MEM_CACHE_BLOCK_SIZE_NS` control memory budget
- Emits `messageCache` in progress for panels using `useMessageReducer` with `preloadType: "full"`
- Being replaced by the `subscribeMessageRange` pattern — prefer that for new panel work

### subscribeMessageRange (Preferred Preloading Pattern)

The `useSubscribeMessageRange` hook (`packages/suite-base/src/components/PanelExtensionAdapter/useSubscribeMessageRange.ts`) is the modern replacement for BlockLoader-based preloading. It is used directly by built-in panels (Plot, StateTransitions) and is also exposed to extension panels via `context.unstable_subscribeMessageRange`.

```typescript
const subscribeMessageRange = useSubscribeMessageRange();

const cancel = subscribeMessageRange({
  topic: "/my/topic",
  convertTo: "my/OutputSchema",     // optional: run through a message converter
  onNewRangeIterator: async (iterable) => {
    for await (const msgEvent of iterable) {
      // process historical + live messages in order
    }
  },
});

// Call cancel() to unsubscribe
```

**How it works:**
1. Calls `getBatchIterator(topic)` from the MessagePipeline context — returns an `AsyncIterableIterator` over the full time range
2. Wraps the raw iterator in `createMessageRangeIterator` which applies installed message converters and alert emission
3. Calls `onNewRangeIterator(iterable)` so the panel can consume the stream
4. Returns a `cancel` function — the panel must call it on cleanup to stop iteration

**Key properties:**
- Stable callback reference — safe to use in `useEffect` dependencies
- Returns `() => {}` immediately (no-op cancel) if `getBatchIterator` returns `undefined` for the topic
- Message converters are read from a ref — updating converters does not invalidate the callback
- Used by Plot panel: `new PlotCoordinator(renderer, datasetsBuilder, subscribeMessageRange)`
- Used by StateTransitions panel: `useDecodedMessageRange` wraps it

### Emit State (`#queueEmitState`)
- Wrapped in `debouncePromise` to prevent concurrent emissions
- Emits `PlayerState` with `activeData` containing messages, currentTime, topics, etc.
- After emission, `#messages` is reset to `EMPTY_ARRAY` (stable reference for memoization)
- `lastSeekTime` is bumped on seek to signal panels to clear stale data

### Source Types
| Interface | Description |
|-----------|-------------|
| `IIterableSource` | Base: `initialize()`, `messageIterator()`, `getBackfillMessages()` |
| `ISerializedIterableSource` | Returns raw bytes; requires `DeserializingIterableSource` wrapper |
| `IDeserializedIterableSource` | Returns already-deserialized `MessageEvent` objects |
| `WorkerIterableSource` | Runs an `IIterableSource` in a Web Worker via Comlink |
| `WorkerSerializedIterableSource` | Serialized variant for Worker-based sources |

### IteratorResult Types
```typescript
type IteratorResult =
  | { type: "message-event"; msgEvent: MessageEvent }
  | { type: "alert"; connectionId: number; alert: PlayerAlert }
  | { type: "stamp"; stamp: Time };  // Time marker without messages
```

---

## FoxgloveWebSocketPlayer

### Connection Lifecycle
1. Constructor calls `#open()` immediately
2. `#open()` creates `FoxgloveClient` with `WorkerSocketAdapter` (Worker available) or plain `WebSocket`
3. Connection timeout: 10s, after which the client is closed
4. On `open`: resets session state, clears alerts, re-subscribes unresolved topics
5. On `close`: sets presence to `RECONNECTING`, schedules `#open` after 3s delay
6. On `serverInfo`: configures capabilities, profile (ROS distro detection), parameters polling

### Protocol Operations
- `advertise` → channel registration, topic/schema/encoding parsing
- `subscribe` → subscription resolution when matching channel is advertised
- `message` → deserialization, pushes to `#parsedMessages` queue
- `time` → clock time updates (when `ServerCapability.time` is present)
- `connectionGraph` → published/subscribed topic graph
- `parameterValues` → remote parameter sync (polled every `GET_ALL_PARAMS_PERIOD_MS`)
- `service` → service call request/response

### Encoding Support
| Message Encoding | Schema Encoding |
|-----------------|-----------------|
| `json` | `jsonschema` |
| `protobuf` | `protobuf` (base64) |
| `flatbuffer` | `flatbuffer` (base64) |
| `ros1` | `ros1msg` |
| `cdr` | `ros2msg` / `ros2idl` / `omgidl` |

### Emit Pattern
- `#emitState` is `debouncePromise`-wrapped (same pattern as IterablePlayer)
- Always reports `isPlaying: true`, `speed: 1` (live data)
- `#parsedMessages` queue is flushed on each emit, byte counter reset
- `startTime` and `endTime` expand as new messages arrive

### WorkerSocketAdapter
- Offloads WebSocket I/O to a dedicated Worker to avoid main-thread blocking
- Falls back to direct `WebSocket` when `Worker` is unavailable
- Source: `packages/suite-base/src/players/FoxgloveWebSocketPlayer/WorkerSocketAdapter.ts`

---

## UserScriptPlayer

> `UserScriptPlayer` is the backing player for the **User Scripts panel** (`packages/suite-base/src/panels/UserScriptEditor/`). The panel provides the UI for writing, editing, and debugging scripts; `UserScriptPlayer` is what actually compiles and executes them at runtime.

### Architecture
- **Decorator pattern**: wraps any `Player` implementation, intercepts `setListener`
- Listens to inner player state, processes messages through registered scripts, emits enriched state
- Adds virtual topics (output topics) to the topic list and datatypes

### Worker Infrastructure
- **TransformWorker** (SharedWorker): compiles TypeScript → JavaScript, extracts metadata
- **RuntimeWorker** (SharedWorker): executes transpiled scripts in sandbox
- Both use `name: uuidv4()` to prevent cross-tab sharing (intentional isolation)
- Unused RuntimeWorkers are pooled in `#unusedRuntimeWorkers` for reuse

### Script Lifecycle
1. `setUserScripts()` → `#resetWorkersUnlocked()` → `#createScriptRegistration()`
2. Transform worker compiles source, extracts `inputTopics`, `outputTopic`, `outputDatatype`
3. `ScriptRegistration.processMessage()` sends messages to runtime worker via RPC
4. Output messages are merged into the final `PlayerState.activeData.messages`

### Key Behaviors
- `#getMessages()`: for each input message, runs all matching script registrations in parallel
- Script subscriptions tracked separately (`#scriptSubscriptions`) — only processes if output is subscribed
- On script change: invalidates batch iterator cache, re-processes with empty upstream messages (avoids duplicate delivery)
- `#protectedState` guarded by `MutexLocked` for thread-safe access to registrations
- `#emitLock` (Mutex) prevents concurrent state emissions

### Batch Iterator Support
- `getBatchIterator(topic)`: provides streaming access to script output topics
- `#batchIteratorCache`: shared across multiple panel consumers (e.g., multiple Plot panels for same virtual topic)
- Cache entries: `{ results[], done, consumers, pruneOffset }` — prunes consumed results
- `#outputTopicRegistrations`: shadow copy for synchronous access (no mutex needed)

### Error Handling
- Per-script alerts via `#alertStore` (keyed by `script-id-${scriptId}`)
- Diagnostics reported via `#setUserScriptDiagnostics` (shown in UserScripts panel)
- Runtime errors caught per-message, do not crash the player

---

## Key Files
- `packages/suite-base/src/players/IterablePlayer/IterablePlayer.ts` — main state machine
- `packages/suite-base/src/players/IterablePlayer/IIterableSource.ts` — source interface + IteratorResult types
- `packages/suite-base/src/players/IterablePlayer/BufferedIterableSource.ts` — read-ahead buffer
- `packages/suite-base/src/players/IterablePlayer/DeserializingIterableSource.ts` — lazy deserialization + sampling
- `packages/suite-base/src/players/IterablePlayer/BlockLoader.ts` — preloading for full subscriptions
- `packages/suite-base/src/players/IterablePlayer/WorkerIterableSource.ts` — Worker-based source (Comlink)
- `packages/suite-base/src/players/IterablePlayer/CachingIterableSource.ts` — block-level cache
- `packages/suite-base/src/players/FoxgloveWebSocketPlayer/index.ts` — WebSocket player
- `packages/suite-base/src/players/FoxgloveWebSocketPlayer/WorkerSocketAdapter.ts` — Worker WebSocket
- `packages/suite-base/src/players/UserScriptPlayer/index.ts` — script player wrapper
- `packages/suite-base/src/players/types.ts` — Player, PlayerState, SubscribePayload, Topic
- `packages/suite-base/src/players/constants.ts` — PLAYER_CAPABILITIES

## Common Pitfalls
- Forgetting to await `#queueEmitState.currentPromise` before setting new messages (causes dropped messages)
- Not handling `#nextState` checks inside loops (causes stale state processing)
- Modifying `#allTopics` identity without triggering `reset-playback-iterator` (misses new topics)
- Calling `seekPlayback` before initialization completes (must store in `#seekTarget` for later)
- Not clamping times to `[start, end]` range (causes source errors)
- UserScriptPlayer: emitting upstream messages twice when scripts change (use empty messages array)

## Skills Reference
- Deep IterablePlayer state machine, tick loop, or data source contract: `read_file(".github/skills/player-internals/SKILL.md")`
- MCAP format, chunk structure, or indexed reading: `read_file(".github/skills/mcap-format/SKILL.md")`
- Worker/Comlink patterns used by iterators: `read_file(".github/skills/web-workers/SKILL.md")`
- Block caching, memory budgets, or BufferedIterableSource: `read_file(".github/skills/caching-internals/SKILL.md")`
- Playback throughput, tick-loop cost, or memory-budget profiling: `read_file(".github/skills/performance/SKILL.md")`

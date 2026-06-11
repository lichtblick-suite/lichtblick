---
description: "Deep implementation details of the IterablePlayer state machine, tick loop, and data source iteration patterns."
---

# Player Internals Skill

## State Machine Detail

```
preinit ──► initialize ──► start-play ──► idle
                                           │  ▲
                                           ▼  │
                                          play
                                           │
                                           ▼
                                    seek-backfill ──► idle

idle/play ──► reset-playback-iterator ──► idle/play (re-enters)
any ──► close
```

### State Transitions
- `preinit → initialize`: First call to `setPlaybackSource()`
- `initialize → start-play`: Source `initialize()` resolved, topics/schemas available
- `start-play → idle`: Initial backfill complete, first state emitted
- `idle → play`: User presses play or `setPlaybackSpeed(speed > 0)`
- `play → idle`: Reached end of data or user pauses
- `play → seek-backfill`: User seeks during playback
- `idle → seek-backfill`: User seeks while paused
- `seek-backfill → idle`: Backfill messages found, state emitted

## Tick Loop Implementation

```typescript
// Simplified tick loop logic
async #statePlay() {
  const tickStart = performance.now();
  const budgetMs = 300; // Max time per tick before yielding to UI

  while (performance.now() - tickStart < budgetMs) {
    const result = await this.#iterator.next();
    if (result.done) { return "idle"; }

    this.#pendingMessages.push(result.value.msgEvent);

    // Check if we've passed the target wall-clock time
    if (this.#hasReachedPlaybackTarget()) { break; }
  }

  this.#emitState();
  return "play"; // continue playing next tick
}
```

### Debounced State Emission
- `#emitStateImpl()` is scheduled via `queueMicrotask` to coalesce rapid updates
- State includes: `activeData` (messages, currentTime, topics), `progress` (caching status)
- Only emits if state actually changed (reference equality check on key fields)

## Iterator Architecture

```
DataSource (file/network)
    │
    ▼
IIterableSource (serialized or deserialized)
    │
    ▼
DeserializingIterableSource (applies schema-based decode)
    │
    ▼
CachingIterableSource (LRU block cache, 600MB)
    │
    ▼
BufferedIterableSource (producer-consumer, read-ahead)
    │
    ▼
IterablePlayer (tick loop consumes messages)
```

## Backfill Strategy

When seeking to time T:
1. For each subscribed topic, find the **last** message at or before T
2. Uses reverse iteration in indexed sources (MCAP) for efficiency
3. These messages become the "latched" state — panels see them immediately
4. Critical for panels that display "latest value" (e.g., 3D transforms, image)

## Subscription Management

- Subscriptions are set by panels via `MessagePipeline.setSubscriptions()`
- Player diffs new vs old subscriptions to avoid unnecessary re-iteration
- Topic preloading is separate from active subscriptions (handled by BlockLoader)
- `reset-playback-iterator` state: when subscriptions change mid-play, iterator must restart from current time

## Performance Critical Paths

1. **Tick loop budget**: 300ms cap prevents UI freeze during catch-up
2. **Message accumulation**: Messages are batched per tick, not emitted individually
3. **Iterator yielding**: `await` in the loop allows microtask scheduling
4. **Worker sources**: Heavy parsing happens in `WorkerIterableSource` off main thread
5. **Seek optimization**: Indexed MCAP enables O(log n) seek via chunk indexes

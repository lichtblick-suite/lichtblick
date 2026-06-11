---
description: "MessagePipeline specialist covering the React context, zustand store, subscription management, and render state building. Use for data flow from Player to panels."
tools: ["read", "search"]
---

# Message Pipeline Agent

You are an expert on the Lichtblick MessagePipeline — the central data bus that connects Players to Panels.

## Architecture

```
Player (emits PlayerState)
    │
    ▼
MessagePipeline (zustand store + React context)
    │
    ▼
PanelExtensionAdapter (per-panel bridge)
    │
    ▼
Panel (receives RenderState)
```

## Core Components

| File | Role |
|------|------|
| `packages/suite-base/src/components/MessagePipeline/index.tsx` | React context provider, creates zustand store, connects to Player |
| `packages/suite-base/src/components/MessagePipeline/store.ts` | `MessagePipelineInternalState`, dispatch actions |
| `packages/suite-base/src/components/MessagePipeline/types.ts` | `MessagePipelineContext` interface — what panels see |
| `packages/suite-base/src/components/MessagePipeline/subscriptions.ts` | Subscription merging and memoization |

## Data Flow

1. **Player emits state** → `playerListener` callback fires
2. **Store dispatch** → `"update"` action merges new PlayerState into internal state
3. **Selectors react** → zustand subscribers (panels) get notified via selector equality check
4. **Render state built** → `PanelExtensionAdapter` incrementally builds `RenderState` for each panel

## Subscription System

Panels declare what topics they need:
```typescript
context.subscribe([{ topic: "/camera/image" }]);
```

The pipeline:
1. Collects subscriptions from all active panels
2. Merges overlapping subscriptions (deduplicates topics)
3. Forwards merged set to the Player via `player.setSubscriptions()`
4. Player only iterates topics that are actually subscribed

### Subscription Memoization
- `subscriptions.ts` uses reference equality to avoid re-computing merged subscriptions
- Only triggers Player update when the effective topic set changes

## MessagePipelineContext Interface

Key fields panels can access:
- `playerState` — current player status (playing, paused, error)
- `activeData` — messages, currentTime, startTime, endTime, topics, datatypes
- `messagesByTopic` — Map of topic → messages for current frame
- `sortedTopics` — alphabetically sorted topic list
- `subscriptions` — currently active subscriptions
- `seekPlayback(time)` — seek to specific time
- `setPlaybackSpeed(speed)` — change playback rate

## Internal Store Actions

- `"update"` — new PlayerState received from player listener
- `"set-subscriptions"` — panel subscriptions changed
- `"playback-seek"` — user seeks to new time
- `"set-playback-speed"` — playback rate changed

## Performance Considerations

- Zustand selectors enable per-panel fine-grained updates (no full re-renders)
- `messagesByTopic` is rebuilt only when new messages arrive (not on every frame)
- Subscription merging prevents redundant data iteration in the Player
- `renderState.ts` builds panel render state incrementally — only changed fields are recomputed

---
description: "Deep MessagePipeline implementation knowledge: zustand store shape, React context provider, subscription merging/memoization, render-state flow, and the Player→panel data bus."
---

# Message Pipeline Skill

The MessagePipeline is the central data bus connecting Players to Panels.

## Data Flow

```
Player (emits PlayerState)
    │  playerListener callback
    ▼
MessagePipeline (zustand store + React context)
    │  selector-based notifications
    ▼
PanelExtensionAdapter (per-panel bridge)
    │
    ▼
Panel (receives RenderState)
```

## Core Files

| File | Role |
|------|------|
| `packages/suite-base/src/components/MessagePipeline/index.tsx` | React context provider; creates the zustand store and connects to the Player |
| `packages/suite-base/src/components/MessagePipeline/store.ts` | `MessagePipelineInternalState` + dispatch actions |
| `packages/suite-base/src/components/MessagePipeline/types.ts` | `MessagePipelineContext` — the interface panels see |
| `packages/suite-base/src/components/MessagePipeline/subscriptions.ts` | Subscription merging + memoization |
| `packages/suite-base/src/components/MessagePipeline/selectors.ts` | Selector helpers for fine-grained subscriptions |

## Store Update Flow

1. **Player emits state** → the `playerListener` callback fires
2. **Store dispatch** → the `"update"` action merges the new `PlayerState` into internal state
3. **Selectors react** → zustand subscribers (panels) are notified via selector equality checks
4. **Render state built** → `PanelExtensionAdapter` incrementally builds `RenderState` per panel

### Internal Store Actions
- `"update"` — new `PlayerState` received from the player listener
- `"set-subscriptions"` — a panel's subscriptions changed
- `"playback-seek"` — user seeks to a new time
- `"set-playback-speed"` — playback rate changed

## Subscription System

Panels declare the topics they need:

```typescript
context.subscribe([{ topic: "/camera/image" }]);
```

The pipeline:
1. Collects subscriptions from all active panels
2. Merges overlapping subscriptions (deduplicates topics)
3. Forwards the merged set to the Player via `player.setSubscriptions()`
4. The Player only iterates topics that are actually subscribed

### Subscription Memoization
- `subscriptions.ts` uses reference equality to avoid recomputing the merged subscription set
- A Player update is only triggered when the effective topic set changes

## MessagePipelineContext (what panels access)

- `playerState` — current player status (playing, paused, error)
- `activeData` — messages, `currentTime`, `startTime`, `endTime`, topics, datatypes
- `messagesByTopic` — `Map<topic, messages>` for the current frame
- `sortedTopics` — alphabetically sorted topic list
- `subscriptions` — currently active subscriptions
- `seekPlayback(time)` — seek to a specific time
- `setPlaybackSpeed(speed)` — change playback rate

## Performance Notes

- Zustand selectors enable per-panel, fine-grained updates (no full re-renders)
- `messagesByTopic` is rebuilt only when new messages arrive (not every frame)
- Subscription merging prevents redundant data iteration in the Player
- Render state is built incrementally — only changed fields are recomputed

## Skills Reference
- For the panel-side bridge and `RenderState` contract: load `panel-extension-api` skill
- For Player internals upstream of the pipeline: load `player-internals` skill

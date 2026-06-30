---
description: "Deep StateTransitions panel knowledge: TimeBasedChart segments, message-path extraction, preloaded-range subscription with 250ms batch flush, block+currentFrame merge, and messagesToDataset."
---

# Panel State Transitions Skill

A timeline visualization for discrete state changes extracted from messages.

## Structure

```
panels/StateTransitions/
├── index.tsx                       # main panel, TimeBasedChart usage, message-path config
├── messagesToDataset.ts            # message → Chart.js dataset (perf-critical)
└── hooks/
    ├── useDecodedMessageRange.ts   # preloaded-range subscription, 250ms batch flush
    └── useStateTransitionsData.ts  # merges preloaded blocks + current frame
```

## Data Flow

1. User configures message paths (e.g. `/robot/state.mode`)
2. `useDecodedMessageRange` subscribes to preloaded blocks for those paths
3. Messages arrive in batches (250ms flush interval)
4. `messagesToDataset` extracts discrete values and builds chart segments
5. `useStateTransitionsData` merges block data with live current-frame data
6. `TimeBasedChart` renders colored segments on a timeline

## messagesToDataset (Performance Critical)

```typescript
function messagesToDataset(messages: MessageEvent[], path: MessagePath): ChartDataset {
  // iterate all messages, extract value at path
  // create segment boundaries at state-change points
  // return { data: [{ x: startTime, x2: endTime, y: stateLabel }] }
}
```

Runs on every data update — must stay fast for large datasets.

## 250ms Batch Flush

`useDecodedMessageRange` debounces:
- Accumulates incoming messages for 250ms
- Triggers a single state update with the full batch
- Prevents a React re-render per message — critical for topics with thousands of preloaded messages

## TimeBasedChart

Shared chart component (also used by other panels):
- Time on the X-axis, discrete values on the Y-axis
- Supports multiple series (each path = a row)
- Zoom/pan synchronized with global playback time
- Colored segments represent distinct state values

## Performance Notes

- 250ms batch flush prevents render storms from high-frequency messages
- `messagesToDataset` is `O(n)` per path — keep `n` bounded (downsample if needed)
- Avoid re-processing already-processed blocks during the block + currentFrame merge
- Message-path parsing is cached (nearley grammar not re-parsed)

## Key Files
- `packages/suite-base/src/panels/StateTransitions/index.tsx`
- `packages/suite-base/src/panels/StateTransitions/messagesToDataset.ts`
- `packages/suite-base/src/panels/StateTransitions/hooks/useDecodedMessageRange.ts`
- `packages/suite-base/src/panels/StateTransitions/hooks/useStateTransitionsData.ts`

## Skills Reference
- For message-path syntax and extraction: load `message-path` skill

---
description: "Deep Log panel knowledge: react-window VariableSizeList virtualization, dynamic measured row heights, autoscroll/tail behavior, multi-format log normalization, and level/text filtering."
---

# Panel Log Skill

A high-performance log viewer with virtualized rendering and filtering.

## Structure

```
panels/Log/
├── index.tsx          # main panel, filter state, topic selection, settings
├── LogList.tsx        # react-window VariableSizeList, dynamic heights, autoscroll
├── filterMessages.ts  # level + text filtering
└── conversion.tsx     # normalize ROS1/ROS2/Foxglove log formats
```

## Virtualized Rendering (react-window)

```typescript
<VariableSizeList
  height={containerHeight}
  itemCount={filteredMessages.length}
  itemSize={getItemSize}   // dynamic: cached height per row
  ref={listRef}
>
  {LogRow}
</VariableSizeList>
```

### Dynamic Row Heights
- Each entry can differ (multi-line messages, stack traces)
- Heights are **measured after first render** and cached
- `resetAfterIndex()` is called when content changes (recalculates from that point)
- Cache is invalidated on resize or filter change

### Autoscroll (tail)
- At bottom → auto-scroll to new messages
- Scrolled up → autoscroll disabled (reading history)
- Scroll-to-bottom button re-enables it

## Message Normalization (`conversion.tsx`)

Unifies multiple formats into one structure:

```typescript
interface NormalizedLogMessage {
  level: LogLevel;   // DEBUG, INFO, WARN, ERROR, FATAL
  message: string;
  name?: string;     // logger name
  timestamp: Time;
  file?: string;
  line?: number;
}
```

Supported inputs: `rosgraph_msgs/Log` (ROS 1), `rcl_interfaces/msg/Log` (ROS 2), `foxglove.Log`.

## Filtering (`filterMessages.ts`)

```typescript
function filterMessages(
  messages: NormalizedLogMessage[],
  minLevel: LogLevel,
  searchTerm: string,
): NormalizedLogMessage[];
```

- **Level filter**: messages at or above the selected level
- **Text search**: case-insensitive substring match (no regex by default)
- Runs on every new batch — must stay fast for 10k+ messages

## Performance Notes

- Only visible rows are rendered (react-window)
- Measured heights are cached to avoid layout thrashing
- Messages are accumulated and filtered in batches (250ms debounce)
- `scrollToItem` is only called when actually at the bottom

## Key Files
- `packages/suite-base/src/panels/Log/index.tsx`
- `packages/suite-base/src/panels/Log/LogList.tsx`
- `packages/suite-base/src/panels/Log/filterMessages.ts`
- `packages/suite-base/src/panels/Log/conversion.tsx`

---
description: "Deep knowledge about the message-path package: path syntax, parsing grammar, data extraction from nested messages, and React hook integration. Shared across Plot, RawMessages, StateTransitions, and general panel agents."
---

# Message Path Skill

## Overview

The `message-path` package (`packages/message-path/`) provides a DSL for addressing fields within ROS/Foxglove messages. It's the foundation for user-defined data extraction in multiple panels.

## Path Syntax

```
/topic.field.nested_field
/topic.field[:]{value==42}
/topic.field[0]
/topic.field.@length
```

### Components
- **Topic**: `/topic_name` — selects messages from a topic
- **Field access**: `.field` — navigates into message fields
- **Array index**: `[0]`, `[1]` — selects specific array element
- **Array slice**: `[:]` — iterates over all array elements
- **Filter**: `{field_name==value}` — filters array elements by field value
- **Special**: `.@length` — returns array length instead of elements

## Parsing

Located in `packages/message-path/src/parseMessagePath.ts`:
- Uses **nearley** grammar for parsing (context-free grammar)
- Parses path string → `MessagePath` AST
- Results are **cached** (same string → same parsed object)

### MessagePath Type
```typescript
type MessagePath = {
  topicName: string;
  topicNameRepr: string;
  messagePath: MessagePathPart[];
  modifier?: string;
};

type MessagePathPart =
  | { type: "name"; name: string; repr: string }
  | { type: "slice"; start?: number; end?: number }
  | { type: "filter"; path: string[]; value: unknown; repr: string };
```

## Data Extraction

`packages/message-path/src/simpleGetMessagePathDataItems.ts`:

```typescript
function simpleGetMessagePathDataItems(
  messages: MessageEvent[],
  path: MessagePath,
): MessagePathDataItem[];
```

- Recursively traverses message objects following the parsed path
- Handles nested fields, array slicing, filtering
- Returns `{ value, path, constantName? }` for each extracted datum

### Performance Characteristics
- Recursive traversal — depth depends on path complexity
- Array slicing with filter can be O(n) per message
- Used in hot paths (every render frame for Plot panel)
- **Memoization is critical** — see React integration below

## React Integration

`packages/message-path/src/useCachedGetMessagePathDataItems.ts`:

```typescript
function useCachedGetMessagePathDataItems(paths: string[]): CachedGetMessagePathDataItems;
```

- React hook that caches extraction results
- Uses **global variable filling** pattern for performance (avoids closure allocations)
- Results are memoized per (path + message identity) — same messages + same path = cached result
- Critical for panels displaying multiple paths (Plot with 10+ series)

## Usage by Panels

| Panel | How it uses message-path |
|-------|------------------------|
| **Plot** | Extracts numeric time series from messages for each configured path |
| **RawMessages** | Navigates to specific fields for display/filtering |
| **StateTransitions** | Extracts discrete state values for timeline visualization |
| **General panels** | Any panel using `useMessagesByPath` or `useMessageDataItem` |

## Common Patterns

### Panel settings with message paths
```typescript
// User configures paths in panel settings
config.paths = ["/odom.pose.position.x", "/odom.twist.linear.x"];
```

### Extracting data in a panel
```typescript
const pathItems = useCachedGetMessagePathDataItems(config.paths);
// Returns extracted values for each path, memoized
```

## Performance Tips

1. Parse paths once and reuse the `MessagePath` object (parsing uses nearley, not free)
2. Use `useCachedGetMessagePathDataItems` over manual extraction (handles memoization)
3. Avoid deeply nested paths with array filters on high-frequency topics
4. Path changes trigger full re-extraction — minimize path reconfiguration during playback

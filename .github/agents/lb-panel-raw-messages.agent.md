---
description: "RawMessages panel specialist covering JSON message tree display, virtualized tree rendering with @tanstack/react-virtual, message inspection, diff mode, and field path navigation. Use for message debugging and data inspection panels."
tools: ["read", "edit", "search", "execute"]
---

# Panel Raw Messages Agent

You are an expert on the Lichtblick RawMessages panels — message inspection tools that display structured message data as expandable trees. There are two implementations: the legacy `RawMessages` (react-json-tree) and the newer `RawMessagesVirtual` (virtualized with @tanstack/react-virtual).

## Architecture

```
PanelExtensionAdapter
    │
    ├── RawMessages (legacy)
    │   ├── react-json-tree (Tree component, full DOM render)
    │   ├── useSharedRawMessagesLogic (shared state/handlers)
    │   └── getDiff / DiffSpan / DiffStats
    │
    └── RawMessagesVirtual (performant)
        ├── VirtualizedTree (@tanstack/react-virtual)
        │   └── flattenTreeData (recursive flatten with expand state)
        ├── useSharedRawMessagesLogic (same shared hook)
        └── getDiff (same diff engine)

Shared code lives in RawMessagesCommon/:
    ├── types.ts (TreeNode, NodeState, configs, props)
    ├── constants.ts (PATH_NAME_AGGREGATOR, CUSTOM_METHOD, PREV_MSG_METHOD)
    ├── useSharedRawMessagesLogic.ts (topic resolution, expansion state)
    ├── useRenderers.ts (useValueRenderer, useRenderDiffLabel)
    ├── getDiff.ts (deep diff computation)
    ├── Value.tsx (interactive value actions: plot, transitions, copy)
    ├── getValueActionForValue.ts (path building for value actions)
    ├── ObjectSummary.tsx (collapsed array/object summary)
    ├── HighlightedValue.tsx (type-colored value rendering)
    ├── Toolbar.tsx, Metadata.tsx, DiffSpan.tsx, DiffStats.tsx
    └── utils.ts (dataWithoutWrappingArray, getSingleValue, getValueString)
```

## Two Implementations

Both panels registered in `packages/suite-base/src/panels/index.ts`:
- `panelType: "RawMessages"` — legacy panel
- `panelType: "RawMessagesVirtual"` — performant virtualized panel

### RawMessages (Legacy)
- Uses `react-json-tree` `<Tree>` component — renders all expanded nodes in the DOM
- Full-featured: expand/collapse, diff mode, value rendering with click-to-navigate
- Performance degrades with large messages (all expanded nodes rendered simultaneously)
- Panel wrapper: `Panel(RawMessages, { panelType: "RawMessages", defaultConfig })`
- `shouldExpandNode` callback: checks expansion state per keypath (joined with `PATH_NAME_AGGREGATOR`)
- `valueRenderer`: delegates to `useValueRenderer` hook for interactive values
- `postprocessValue`: handles diff label injection for diff mode

### RawMessagesVirtual (Performant)
- Uses `@tanstack/react-virtual` (`useVirtualizer`) for windowed rendering
- `flattenTreeData()`: recursively flattens nested object into `TreeNode[]` based on `expandedNodes: Set<string>`
- Only visible rows rendered in DOM (overscan: 5 rows)
- `measureElement` for dynamic row heights
- Same diff engine and value rendering as legacy
- Panel wrapper: `Panel(RawMessagesVirtual, { panelType: "RawMessagesVirtual", defaultConfig: RAW_MESSAGES_VIRTUAL_DEFAULT_CONFIG })`
- Expansion state converted from `NodeExpansion` → `Set<string>` via `useMemo`

## VirtualizedTree Component

```typescript
// Core virtualization setup
const virtualizer = useVirtualizer({
  count: flatData.length,
  getScrollElement,
  estimateSize: () => fontSize ?? DEFAULT_FONT_SIZE,  // 12px
  overscan: SCROLLL_OVERSCAN,  // 5
  measureElement: (el) => el.getBoundingClientRect().height,
  useAnimationFrameWithResizeObserver: true,
});
```

Key constants:
- `ROW_HEIGHT`: 24px
- `TREE_NODE_INDENTATION`: 16px per depth level
- `DEFAULT_FONT_SIZE`: 12px
- `SCROLLL_OVERSCAN`: 5 rows

## flattenTreeData

Converts nested object → flat `TreeNode[]` for virtualization:

```typescript
function flattenTreeData(
  data: unknown,
  expandedNodes: Set<string>,
  parentPath?: string,
  depth?: number,
  keyPath?: (string | number)[],
): TreeNode[]
```

- Skips `null`, non-objects, and `ArrayBuffer.isView` (typed arrays like point cloud buffers)
- Only recurses into children of expanded nodes
- Path keys joined with `PATH_NAME_AGGREGATOR` (reverse order: `child~|~parent`)
- Returns flat array where depth is encoded in each node

## TreeNode Type

```typescript
type TreeNode = {
  key: string;           // Unique path string (e.g. "x~|~position~|~pose")
  label: string;         // Display name (e.g. "x")
  value: unknown;        // The actual value at this path
  depth: number;         // Nesting level for indentation
  isExpandable: boolean; // Has object/array children
  keyPath: (string | number)[];  // Path array for value rendering
  parentPath: string;    // Parent's key string
};
```

## Expansion State Management

- `useSharedRawMessagesLogic` manages `expansion`: `"all"` | `"none"` | `Record<string, NodeState>`
- `RawMessagesVirtual` converts to `expandedNodesSet: Set<string>` via `useMemo`
- `"all"` mode: generates all possible paths from data object (recursive via `generateDeepKeyPaths`)
- `"none"` mode: empty set
- Object mode: collects keys where `state === NodeState.Expanded`
- `toggleExpansion()` utility: flips a node between Expanded/Collapsed

## Diff Mode

- Shared between both implementations via `getDiff()`
- Compares `baseItem` (current topic) vs `diffItem` (diff topic or previous message)
- `CUSTOM_METHOD`: diff against a different topic path
- `PREV_MSG_METHOD`: diff against previous message on same topic
- Labels: ADDED, DELETED, CHANGED, ID
- `showFullMessageForDiff`: toggle to show unchanged fields
- `DiffSpan`: colored label rendering (green=added, red=deleted, yellow=changed)
- `DiffStats`: summary count of changes

## Value Actions (Shared)

The `Value.tsx` component provides interactive actions on tree values:
- **Line chart**: opens sibling Plot panel with the value's message path (`openSiblingPlotPanel`)
- **Scatter plot**: opens Plot in scatter mode
- **State transitions**: opens StateTransitions for transitionable types (`TRANSITIONABLE_ROS_TYPES`)
- **Filter**: builds filter path (e.g. `[:]{id==5}`) for arrays
- **Copy**: copies value to clipboard

`getValueActionForValue.ts` builds `ValueAction` (singleSlicePath, multiSlicePath, primitiveType, filterPath) by navigating the `MessagePathStructureItem` tree. It handles:
- Object elements: resolves `nextByName` on message structure
- Array elements: resolves `next` + builds slice/filter syntax
- `isTypicalFilterName`: detects `id`, `name` etc. for auto-filter

## Core Functionality

- Displays decoded messages as expandable JSON-like trees
- Supports message-path for field navigation and filtering
- Diff mode: highlights changes between consecutive messages
- Value click: opens related panel (Plot, StateTransitions) via `openSiblingPanel`
- Copy: individual values or entire message as JSON
- `ObjectSummary`: shows `[] N items` / `{} N keys` for collapsed nodes
- `HighlightedValue`: renders values with type-appropriate coloring
- `MaybeCollapsedValue`: truncates long single values with expand affordance
- Drag-and-drop: accepts message paths via `setMessagePathDropConfig`

## Performance Considerations

1. **Virtualization** (RawMessagesVirtual): only visible rows in DOM via @tanstack/react-virtual
2. **Typed array skip**: `ArrayBuffer.isView` check prevents flattening point cloud buffers
3. **Memoization**: `flattenTreeData` recomputed only when `data` or `expandedNodes` change
4. **High frequency**: only latest message rendered, no accumulation (`latest-per-render-tick` sampling)
5. **measureElement**: dynamic row heights without layout thrashing (uses `useAnimationFrameWithResizeObserver`)
6. **Shared hooks**: `useSharedRawMessagesLogic` reused across both implementations
7. **Lazy expansion**: collapsed subtrees never traversed in `flattenTreeData`

## Key Files

### RawMessages (Legacy)
- `packages/suite-base/src/panels/RawMessages/index.tsx` (component + Panel wrapper)

### RawMessagesVirtual
- `packages/suite-base/src/panels/RawMessagesVirtual/index.tsx` (Panel wrapper, panelType registration)
- `packages/suite-base/src/panels/RawMessagesVirtual/RawMessagesVirtual.tsx` (main component)
- `packages/suite-base/src/panels/RawMessagesVirtual/VirtualizedTree.tsx` (@tanstack/react-virtual)
- `packages/suite-base/src/panels/RawMessagesVirtual/flattenTreeData.ts` (tree → flat array)
- `packages/suite-base/src/panels/RawMessagesVirtual/constants.ts` (ROW_HEIGHT, overscan, indentation)

### Shared (RawMessagesCommon)
- `packages/suite-base/src/panels/RawMessagesCommon/types.ts` (TreeNode, NodeState, configs, props)
- `packages/suite-base/src/panels/RawMessagesCommon/useSharedRawMessagesLogic.ts` (expansion, subscriptions)
- `packages/suite-base/src/panels/RawMessagesCommon/useRenderers.ts` (useValueRenderer, useRenderDiffLabel)
- `packages/suite-base/src/panels/RawMessagesCommon/getDiff.ts` (deep diff computation)
- `packages/suite-base/src/panels/RawMessagesCommon/utils.ts` (dataWithoutWrappingArray, formatValueForFilter)
- `packages/suite-base/src/panels/RawMessagesCommon/Value.tsx` (value actions: plot, transitions, copy)
- `packages/suite-base/src/panels/RawMessagesCommon/getValueActionForValue.ts` (path building for actions)
- `packages/suite-base/src/panels/RawMessagesCommon/ObjectSummary.tsx` (array/object summary display)
- `packages/suite-base/src/panels/RawMessagesCommon/HighlightedValue.tsx` (type-colored value rendering)
- `packages/suite-base/src/panels/RawMessagesCommon/Toolbar.tsx` (shared toolbar UI)
- `packages/suite-base/src/panels/RawMessagesCommon/Metadata.tsx` (message timestamp/topic info)

## Skills Reference
- For message-path syntax and extraction: load `message-path` skill
- For performance optimization patterns: load `performance` skill

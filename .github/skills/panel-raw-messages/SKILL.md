---
description: "Deep RawMessages panel knowledge: legacy (react-json-tree) vs virtual (@tanstack/react-virtual) implementations, flattenTreeData, TreeNode shape, expansion-state management, shared logic hook, and diff mode."
---

# Panel Raw Messages Skill

Message-inspection panels that display structured message data as expandable trees. There are
**two** implementations sharing one logic/diff core.

## Two Implementations

Both registered in `packages/suite-base/src/panels/index.ts`:
- `panelType: "RawMessages"` — legacy (`react-json-tree` `<Tree>`, full DOM render of expanded nodes)
- `panelType: "RawMessagesVirtual"` — performant (`@tanstack/react-virtual` windowed rendering)

Shared code lives in `panels/RawMessagesCommon/`:
- `types.ts` (`TreeNode`, `NodeState`, configs, props)
- `constants.ts` (`PATH_NAME_AGGREGATOR`, `CUSTOM_METHOD`, `PREV_MSG_METHOD`)
- `useSharedRawMessagesLogic.ts` (topic resolution, expansion state)
- `useRenderers.ts`, `getDiff.ts`, `Value.tsx`, `getValueActionForValue.ts`, `utils.ts`, …

## VirtualizedTree (Performant Path)

```typescript
const virtualizer = useVirtualizer({
  count: flatData.length,
  getScrollElement,
  estimateSize: () => fontSize ?? DEFAULT_FONT_SIZE,  // 12px
  overscan: SCROLLL_OVERSCAN,                          // 5
  measureElement: (el) => el.getBoundingClientRect().height,
  useAnimationFrameWithResizeObserver: true,
});
```

Key constants: `ROW_HEIGHT` 24px, `TREE_NODE_INDENTATION` 16px/level, `DEFAULT_FONT_SIZE` 12px,
`SCROLLL_OVERSCAN` 5.

## flattenTreeData

Converts a nested object → flat `TreeNode[]` for virtualization:

```typescript
function flattenTreeData(
  data: unknown,
  expandedNodes: Set<string>,
  parentPath?: string,
  depth?: number,
  keyPath?: (string | number)[],
): TreeNode[]
```

- Skips `null`, non-objects, and `ArrayBuffer.isView` values (typed arrays like point-cloud buffers)
- Only recurses into children of expanded nodes
- Path keys joined with `PATH_NAME_AGGREGATOR` in reverse order (`child~|~parent`)

```typescript
type TreeNode = {
  key: string;           // unique path string, e.g. "x~|~position~|~pose"
  label: string;         // display name, e.g. "x"
  value: unknown;
  depth: number;         // nesting level for indentation
  isExpandable: boolean;
  keyPath: (string | number)[];
  parentPath: string;
};
```

## Expansion State

- `useSharedRawMessagesLogic` manages `expansion`: `"all" | "none" | Record<string, NodeState>`
- `RawMessagesVirtual` converts it to `Set<string>` via `useMemo`
  - `"all"` → all possible paths (recursive `generateDeepKeyPaths`)
  - `"none"` → empty set
  - object mode → keys where `state === NodeState.Expanded`
- `toggleExpansion()` flips a node Expanded ↔ Collapsed

## Diff Mode

- Shared via `getDiff()` — compares `baseItem` (current topic) vs `diffItem` (another topic or
  the previous message)
- `CUSTOM_METHOD` diffs against a different topic path; `PREV_MSG_METHOD` against the prior message

## Key Files
- `packages/suite-base/src/panels/RawMessages/`
- `packages/suite-base/src/panels/RawMessagesVirtual/`
- `packages/suite-base/src/panels/RawMessagesCommon/`

## Skills Reference
- For message-path value actions: load `message-path` skill

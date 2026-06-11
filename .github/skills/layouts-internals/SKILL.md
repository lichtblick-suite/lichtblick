---
description: "Deep layout system implementation knowledge: ILayoutStorage contracts, IndexedDB schema, sync operation computation, mutex-locked LayoutManager, conflict resolution, exponential backoff, WriteThroughLayoutCache, and CurrentLayoutProvider reducers."
---

# Layouts Internals Skill

## ILayoutStorage Interface

```typescript
interface ILayoutStorage {
  // CRUD
  getLayouts(): Promise<Layout[]>;
  getLayout(id: LayoutID): Promise<Layout | undefined>;
  saveLayout(layout: Layout): Promise<void>;
  deleteLayout(id: LayoutID): Promise<void>;

  // Sync metadata
  getLastSyncTime(): Promise<Date | undefined>;
  setLastSyncTime(time: Date): Promise<void>;
}
```

## IdbLayoutStorage (IndexedDB Detail)

### Database Schema
```typescript
// DB name: "layouts" (version 1)
// Object store: "layouts"
// keyPath: ["namespace", "id"]
// Indexes:
//   - "by-namespace": keyPath "namespace" (non-unique)

interface StoredLayout {
  namespace: string;    // "local" | "org"
  id: LayoutID;        // UUID string
  name: string;
  data: LayoutData;    // Full panel tree + configs
  permission: LayoutPermission;
  savedAt: string;     // ISO 8601
  syncStatus: LayoutSyncStatus;
  baseline?: LayoutData; // Last synced version (for conflict detection)
}
```

### Baseline Tracking
- `baseline` stores the last known synced state
- When user edits: `data` changes, `baseline` stays
- On sync: if remote unchanged and local modified → upload local `data`, update baseline
- On conflict: show diff between local `data` and remote (both diverged from baseline)

## NamespacedLayoutStorage

Wrapper that scopes all operations to a specific namespace:

```typescript
class NamespacedLayoutStorage implements ILayoutStorage {
  constructor(
    private inner: IdbLayoutStorage,
    private namespace: string,
  ) {}

  async getLayouts(): Promise<Layout[]> {
    return this.inner.getLayoutsByNamespace(this.namespace);
  }
  // All operations automatically scoped
}
```

## WriteThroughLayoutCache

```typescript
class WriteThroughLayoutCache implements ILayoutStorage {
  #cache: Map<LayoutID, Layout> = new Map();
  #inner: ILayoutStorage;

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    // Fast path: return from cache
    if (this.#cache.has(id)) return this.#cache.get(id);
    // Slow path: fetch from IDB, populate cache
    const layout = await this.#inner.getLayout(id);
    if (layout) this.#cache.set(id, layout);
    return layout;
  }

  async saveLayout(layout: Layout): Promise<void> {
    // Write-through: update both simultaneously
    this.#cache.set(layout.id, layout);
    await this.#inner.saveLayout(layout);
  }
}
```

## LayoutManager (Sync Orchestrator)

### Mutex Pattern
```typescript
class LayoutManager {
  #syncMutex = new Mutex();

  async syncLayouts(): Promise<void> {
    await this.#syncMutex.runExclusive(async () => {
      // Only one sync at a time
      await this.#performSync();
    });
  }
}
```

### Exponential Backoff Implementation
```typescript
class LayoutManager {
  #baseInterval = 30_000;      // 30 seconds
  #maxInterval = 180_000;      // 3 minutes
  #currentInterval: number;
  #syncTimer: ReturnType<typeof setTimeout>;

  #scheduleNextSync(): void {
    // Add jitter (±15%)
    const jitter = this.#currentInterval * (0.85 + Math.random() * 0.3);
    this.#syncTimer = setTimeout(() => this.syncLayouts(), jitter);

    // Exponential increase (capped)
    this.#currentInterval = Math.min(
      this.#currentInterval * 2,
      this.#maxInterval,
    );
  }

  #resetBackoff(): void {
    this.#currentInterval = this.#baseInterval;
  }
}
```

### User actions that reset backoff:
- Save layout
- Create new layout
- Delete layout
- Import layout
- Manual sync trigger

## computeLayoutSyncOperations() (Detail)

```typescript
interface SyncOperation {
  type: "upload" | "download" | "delete-local" | "delete-remote" | "conflict";
  layoutId: LayoutID;
  local?: Layout;
  remote?: Layout;
}

function computeLayoutSyncOperations(
  localLayouts: Layout[],
  remoteLayouts: RemoteLayout[],
): SyncOperation[] {
  const operations: SyncOperation[] = [];

  // Build lookup maps
  const localMap = new Map(localLayouts.map(l => [l.id, l]));
  const remoteMap = new Map(remoteLayouts.map(l => [l.id, l]));

  // Process all known IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (local && !remote) {
      // Local only
      if (local.syncStatus === "new") {
        operations.push({ type: "upload", layoutId: id, local });
      } else if (local.syncStatus === "deleted") {
        operations.push({ type: "delete-local", layoutId: id, local });
      }
    } else if (!local && remote) {
      // Remote only → download
      operations.push({ type: "download", layoutId: id, remote });
    } else if (local && remote) {
      // Both exist → compare timestamps
      if (local.syncStatus === "locally-modified") {
        if (remote.savedAt === local.baseline?.savedAt) {
          // Remote unchanged → safe to upload
          operations.push({ type: "upload", layoutId: id, local });
        } else {
          // Both changed → conflict
          operations.push({ type: "conflict", layoutId: id, local, remote });
        }
      } else if (remote.savedAt !== local.savedAt) {
        // Remote newer, local unmodified → download
        operations.push({ type: "download", layoutId: id, remote });
      }
      // else: same version, no action needed
    }
  }

  return operations;
}
```

## CurrentLayoutProvider Reducers

### Panel Tree Operations

**ADD_PANEL**:
```
Find insertion point → split existing node → create new leaf
```

**REMOVE_PANEL**:
```
Remove leaf → if parent has single child → collapse parent
```

**MOVE_PANEL**:
```
Remove from source → add to destination → recompute sizes
```

**SPLIT_PANEL**:
```
Replace leaf with { direction, children: [existingLeaf, newLeaf], sizes: [0.5, 0.5] }
```

### Config Update Pattern
```typescript
case "UPDATE_PANEL_CONFIG": {
  const { path, config } = action;
  const panelId = getPanelIdFromPath(state.layout, path);
  return {
    ...state,
    configById: {
      ...state.configById,
      [panelId]: { ...state.configById[panelId], ...config },
    },
  };
}
```

## DesktopLayoutLoader

Desktop-specific loader that reads layouts from filesystem via IPC:

```typescript
class DesktopLayoutLoader {
  async getLayouts(): Promise<Layout[]> {
    // IPC to main process → read layout directory
    return desktopBridge.fetchLayouts();
  }

  async saveLayout(layout: Layout): Promise<void> {
    // IPC to main process → write JSON file
    await desktopBridge.saveLayout(layout.id, JSON.stringify(layout));
  }
}
```

## Common Issues

1. **Sync conflicts**: User edits while offline → both sides changed → manual resolution needed
2. **Mutex deadlock**: If sync operation throws without releasing → next sync hangs (mitigated by timeout)
3. **IndexedDB quota**: Large layouts with many panels → check quota before save
4. **Baseline drift**: If baseline gets corrupted → all syncs show as conflicts (reset baseline)

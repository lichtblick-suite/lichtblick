---
description: "Deep layout system implementation knowledge: ILayoutStorage contracts, IndexedDB schema, sync operation computation, mutex-locked LayoutManager, conflict resolution, WriteThroughLayoutCache, NamespacedLayoutStorage, and CurrentLayoutProvider reducers."
---

# Layouts Internals Skill

## ILayoutStorage Interface

Defined in `packages/suite-base/src/services/ILayoutStorage.ts`. **Every** CRUD method takes a
`namespace` argument — there are no sync-time methods like `getLastSyncTime`.

```typescript
export interface ILayoutStorage {
  list(namespace: string): Promise<readonly Layout[]>;
  get(namespace: string, id: LayoutID): Promise<Layout | undefined>;
  put(namespace: string, layout: Layout): Promise<Layout>;
  delete(namespace: string, id: LayoutID): Promise<void>;

  // Optional one-time migration of pre-namespace local layouts
  migrateUnnamespacedLayouts?(namespace: string): Promise<void>;

  // Convert local layouts to personal layouts on login
  importLayouts(params: { fromNamespace: string; toNamespace: string }): Promise<void>;
}
```

The `Layout` type tracks `baseline` (last explicit save), `working` (unsaved edits, or `undefined`),
and `syncInfo` (remote status). `LayoutSyncStatus` is
`"new" | "updated" | "tracked" | "locally-deleted" | "remotely-deleted"`.

## IdbLayoutStorage (IndexedDB Detail)

`packages/suite-base/src/IdbLayoutStorage.ts`:

```typescript
// DB name: `${KEY_WORKSPACE_PREFIX}lichtblick-layouts` (version 1)
// Object store: "layouts"
//   keyPath: ["namespace", "layout.id"]   (composite primary key)
//   index "namespace": keyPath "namespace" (non-unique)

interface LayoutsDB extends DBSchema {
  layouts: {
    key: [namespace: string, id: LayoutID];
    value: { namespace: string; layout: Layout };
    indexes: { namespace: string };
  };
}
```

- `list()` uses `getAllFromIndex("layouts", "namespace", namespace)`
- Every read passes the record through `migrateLayout()` before returning
- The stored value wraps the layout: `{ namespace, layout }` — the primary key reaches into
  `layout.id` via the `"layout.id"` keyPath segment

## NamespacedLayoutStorage

`packages/suite-base/src/services/LayoutManager/NamespacedLayoutStorage.ts` — wraps an
`ILayoutStorage` and binds a namespace so callers omit it. It is **not** itself an `ILayoutStorage`
(its methods drop the namespace argument). The constructor kicks off an async migration/import:

```typescript
export class NamespacedLayoutStorage {
  #migration: Promise<void>;
  constructor(
    private storage: ILayoutStorage,
    private namespace: string,
    opts: { migrateUnnamespacedLayouts: boolean; importFromNamespace: string | undefined },
  ) {
    // runs migrateUnnamespacedLayouts?() and/or importLayouts() once
  }

  async list(): Promise<readonly Layout[]>   { await this.#migration; return this.storage.list(this.namespace); }
  async get(id: LayoutID)                     { await this.#migration; return this.storage.get(this.namespace, id); }
  async put(layout: Layout)                   { await this.#migration; return this.storage.put(this.namespace, layout); }
  async delete(id: LayoutID)                  { await this.#migration; return this.storage.delete(this.namespace, id); }
}
```

## WriteThroughLayoutCache

`packages/suite-base/src/services/LayoutManager/WriteThroughLayoutCache.ts` — an `ILayoutStorage`
that calls the underlying `list()` once per namespace (via `LazilyInitialized`) and serves
subsequent reads from an in-memory `Map`, writing through to the inner storage on `put`/`delete`.
Assumes nothing else mutates the underlying storage.

```typescript
export default class WriteThroughLayoutCache implements ILayoutStorage {
  #cacheByNamespace = new Map<string, LazilyInitialized<Map<string, Layout>>>();
  constructor(private storage: ILayoutStorage) {}

  async put(namespace: string, layout: Layout): Promise<Layout> {
    const result = await this.storage.put(namespace, layout);
    (await this.#getOrCreateCache(namespace).get()).set(result.id, result);
    return result;
  }
  // get/list/delete read/write the per-namespace cache map
}
```

## LayoutManager (Sync Orchestrator)

`packages/suite-base/src/services/LayoutManager/LayoutManager.ts`.

### Mutex Pattern
All local storage access is wrapped in a `MutexLocked` (from `@lichtblick/den/async`) so multi-step
operations are atomic. A single in-flight sync is tracked by `currentSync?: Promise<void>`.

```typescript
class LayoutManager {
  private local: MutexLocked<NamespacedLayoutStorage>;
  private currentSync?: Promise<void>;

  async getLayouts(): Promise<readonly Layout[]> {
    return await this.local.runExclusive(async (local) => await local.list());
  }
}
```

> ⚠️ `LayoutManager` does **not** implement exponential backoff / jitter / `#baseInterval` /
> `#maxInterval`. Sync scheduling (and any retry/online-trigger behavior) lives in the provider
> layer, not in `LayoutManager`. Do not assume a built-in backoff timer here.

## computeLayoutSyncOperations() (Detail)

`packages/suite-base/src/services/LayoutManager/utils/computeLayoutSyncOperations.ts`. The real
`SyncOperation` is a tagged union carrying a `local` boolean and the operation `type`:

```typescript
export type SyncOperation =
  | { local: true;  type: "add-to-cache";   remoteLayout: RemoteLayout }
  | { local: true;  type: "delete-local";   localLayout: Layout }
  | { local: true;  type: "mark-deleted";   localLayout: Layout }
  | { local: false; type: "delete-remote";  localLayout: Layout }
  | { local: false; type: "upload-new";     localLayout: Layout }
  | { local: false; type: "upload-updated"; localLayout: Layout }
  | {
      local: true;
      type: "update-baseline";
      localLayout: Layout & { syncInfo: NonNullable<Layout["syncInfo"]> };
      remoteLayout: RemoteLayout;
    };
```

> ⚠️ There is no `"upload" | "download" | "conflict"` union, no `layoutId` field, and no
> `syncStatus`/`baseline.savedAt` comparison as shown previously. Operations are keyed by
> `localLayout` / `remoteLayout`, and the `local` flag indicates whether the op mutates local
> (cache) or remote storage.

The function iterates local layouts (matching against a `remoteLayoutsById` map) and then any
remaining remote-only layouts, pushing the appropriate operation for each.

## CurrentLayoutProvider Reducers

`packages/suite-base/src/providers/CurrentLayoutProvider/reducers.ts`. The actual action `type`
values handled are:

`CHANGE_PANEL_LAYOUT`, `SAVE_PANEL_CONFIGS`, `SAVE_FULL_PANEL_CONFIG`, `CREATE_TAB_PANEL`,
`OVERWRITE_GLOBAL_DATA`, `SET_GLOBAL_DATA`, `SET_USER_NODES`, `SET_PLAYBACK_CONFIG`, `CLOSE_PANEL`,
`SPLIT_PANEL`, `SWAP_PANEL`, `MOVE_TAB`, `ADD_PANEL`, `DROP_PANEL`, `START_DRAG`, `END_DRAG`.

> ⚠️ There are no `REMOVE_PANEL`, `MOVE_PANEL`, or `UPDATE_PANEL_CONFIG` actions. Panel removal is
> `CLOSE_PANEL`; config writes go through `SAVE_PANEL_CONFIGS` / `SAVE_FULL_PANEL_CONFIG`.

### Panel Tree Operations (examples)

**ADD_PANEL** — find insertion point → add new leaf to the mosaic tree.

**CLOSE_PANEL** — remove leaf → if parent collapses to a single child, hoist it.

**SPLIT_PANEL**:
```
Replace leaf with { direction, first: existingLeaf, second: newLeaf, splitPercentage: 50 }
```

### Config Update Pattern (SAVE_PANEL_CONFIGS)
```typescript
case "SAVE_PANEL_CONFIGS":
  // merges each { id, config } entry into state's configById,
  // optionally via a per-panel override function
```

## DesktopLayoutLoader

`packages/suite-desktop/src/renderer/services/DesktopLayoutLoader.ts` — `namespace = "local"`. Reads
layouts from the desktop file system through the preload `storageBridge` (`list` / `get` / `put` /
`delete`), not a `desktopBridge.fetchLayouts()` call.

## Common Issues

1. **Sync conflicts**: User edits while offline → both sides changed → manual resolution needed
2. **Mutex deadlock**: If sync operation throws without releasing → next sync hangs (mitigated by timeout)
3. **IndexedDB quota**: Large layouts with many panels → check quota before save
4. **Baseline drift**: If baseline gets corrupted → all syncs show as conflicts (reset baseline)

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CachedLayout } from "@foxglove/studio-base/services/ILayoutCache";
import { ConflictType, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import { RemoteLayoutMetadata } from "@foxglove/studio-base/services/IRemoteLayoutStorage";

type CachedLayoutWithState = CachedLayout & { state: NonNullable<CachedLayout["state"]> };

export type SyncOperation =
  | { type: "add-to-cache"; remoteLayout: RemoteLayoutMetadata }
  | { type: "delete-local"; cachedLayout: CachedLayout }
  | { type: "delete-remote"; cachedLayout: CachedLayout; remoteLayout: RemoteLayoutMetadata }
  | { type: "upload-new"; cachedLayout: CachedLayoutWithState }
  | { type: "upload-updated"; cachedLayout: CachedLayout; remoteLayout: RemoteLayoutMetadata }
  | {
      type: "update-cached-metadata";
      cachedLayout: CachedLayout;
      remoteLayout: RemoteLayoutMetadata;
    }
  | {
      type: "conflict";
      cachedLayout: CachedLayout;
      conflictType: ConflictType;
    };

export default function computeLayoutSyncOperations(
  cachedLayoutsById: ReadonlyMap<string, CachedLayout>,
  remoteLayoutsById: ReadonlyMap<LayoutID, RemoteLayoutMetadata>,
): SyncOperation[] {
  const ops: SyncOperation[] = [];
  const newLayoutsToCache = new Map(remoteLayoutsById);

  for (const cachedLayout of cachedLayoutsById.values()) {
    // If the layout was created locally, upload it
    if (cachedLayout.serverMetadata == undefined) {
      // If it's already been deleted or there is nothing to upload, delete.
      if (cachedLayout.locallyDeleted === true || cachedLayout.state == undefined) {
        ops.push({ type: "delete-local", cachedLayout });
      } else {
        ops.push({
          type: "upload-new",
          // Convince TS that state is present
          cachedLayout: { ...cachedLayout, state: cachedLayout.state },
        });
      }
      continue;
    }
    newLayoutsToCache.delete(cachedLayout.serverMetadata.id);

    // If we know the layout's server id, but it no longer exists on the server, delete it
    const remoteLayout = remoteLayoutsById.get(cachedLayout.serverMetadata.id);
    if (remoteLayout == undefined) {
      if (cachedLayout.locallyDeleted === true || cachedLayout.locallyModified !== true) {
        ops.push({ type: "delete-local", cachedLayout });
      } else {
        ops.push({ type: "conflict", cachedLayout, conflictType: "local-update-remote-delete" });
      }
      continue;
    }

    const cachedUpdatedAt = Date.parse(cachedLayout.serverMetadata.updatedAt);
    const serverUpdatedAt = Date.parse(remoteLayout.updatedAt);

    if (serverUpdatedAt > cachedUpdatedAt) {
      if (cachedLayout.locallyModified === true || cachedLayout.locallyDeleted === true) {
        ops.push({
          type: "conflict",
          cachedLayout,
          conflictType:
            cachedLayout.locallyDeleted === true ? "local-delete-remote-update" : "both-update",
        });
      } else {
        ops.push({ type: "update-cached-metadata", cachedLayout, remoteLayout });
      }
    } else if (cachedLayout.locallyDeleted === true) {
      ops.push({ type: "delete-remote", cachedLayout, remoteLayout });
    } else if (cachedLayout.locallyModified === true) {
      ops.push({ type: "upload-updated", cachedLayout, remoteLayout });
    }
  }

  for (const remoteLayout of newLayoutsToCache.values()) {
    ops.push({ type: "add-to-cache", remoteLayout });
  }

  return ops;
}

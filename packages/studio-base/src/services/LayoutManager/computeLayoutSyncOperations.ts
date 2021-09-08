// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";
import { Layout, layoutIsShared } from "@foxglove/studio-base/services/ILayoutStorage";
import { RemoteLayout } from "@foxglove/studio-base/services/IRemoteLayoutStorage";

const log = Logger.getLogger(__filename);

export type SyncOperation =
  | { local: true; type: "add-to-cache"; remoteLayout: RemoteLayout }
  | { local: true; type: "delete-local"; localLayout: Layout }
  | { local: true; type: "mark-deleted"; localLayout: Layout }
  | { local: false; type: "delete-remote"; localLayout: Layout }
  | { local: false; type: "upload-new"; localLayout: Layout }
  | { local: false; type: "upload-updated"; localLayout: Layout }
  | {
      local: true;
      type: "update-baseline";
      localLayout: Layout & { syncInfo: NonNullable<Layout["syncInfo"]> };
      remoteLayout: RemoteLayout;
    };

export default function computeLayoutSyncOperations(
  localLayouts: readonly Layout[],
  remoteLayouts: readonly RemoteLayout[],
): SyncOperation[] {
  const ops: SyncOperation[] = [];

  const remoteLayoutsById = new Map(remoteLayouts.map((layout) => [layout.id, layout]));

  for (const localLayout of localLayouts) {
    const remoteLayout = remoteLayoutsById.get(localLayout.id);
    if (remoteLayout) {
      remoteLayoutsById.delete(localLayout.id);
      switch (localLayout.syncInfo?.status) {
        case undefined:
        case "new":
          log.warn(
            `Remote layout is present but local has sync status: ${localLayout.syncInfo?.status}`,
          );
          if (layoutIsShared(localLayout)) {
            log.warn(`Shared layout ${localLayout.id} shouldn't be untracked`);
            continue;
          }
          ops.push({ local: false, type: "upload-new", localLayout });
          break;
        case "updated":
          ops.push({ local: false, type: "upload-updated", localLayout });
          break;
        case "tracked":
          // if the server doesn't provide a savedAt we consider the layout old and ignore it
          if (!remoteLayout.savedAt) {
            break;
          }

          if (localLayout.syncInfo.lastRemoteSavedAt !== remoteLayout.savedAt) {
            ops.push({
              local: true,
              type: "update-baseline",
              localLayout: { ...localLayout, syncInfo: localLayout.syncInfo },
              remoteLayout,
            });
          }
          break;
        case "locally-deleted":
          if (layoutIsShared(localLayout)) {
            log.warn(`Shared layout ${localLayout.id} shouldn't be marked as locally deleted`);
          }
          ops.push({ local: false, type: "delete-remote", localLayout });
          break;
        case "remotely-deleted":
          log.warn(
            `Remote layout is present but cache is marked as remotely deleted: ${localLayout.id}`,
          );
          break;
      }
    } else {
      switch (localLayout.syncInfo?.status) {
        case undefined:
        case "new":
          if (layoutIsShared(localLayout)) {
            log.warn(`Shared layout ${localLayout.id} should have been uploaded at creation`);
            continue;
          }
          ops.push({ local: false, type: "upload-new", localLayout });
          break;
        case "updated":
          if (!layoutIsShared(localLayout)) {
            ops.push({ local: true, type: "delete-local", localLayout });
          } else {
            ops.push({ local: true, type: "mark-deleted", localLayout });
          }
          break;
        case "tracked":
          if (localLayout.working == undefined || !layoutIsShared(localLayout)) {
            ops.push({ local: true, type: "delete-local", localLayout });
          } else {
            ops.push({ local: true, type: "mark-deleted", localLayout });
          }
          break;
        case "locally-deleted":
          if (layoutIsShared(localLayout)) {
            log.warn(`Shared layout ${localLayout.id} shouldn't be marked as locally deleted`);
          }
          ops.push({ local: true, type: "delete-local", localLayout });
          break;
        case "remotely-deleted":
          if (localLayout.working == undefined) {
            ops.push({ local: true, type: "delete-local", localLayout });
          }
          break;
      }
    }
  }

  for (const remoteLayout of remoteLayoutsById.values()) {
    ops.push({ local: true, type: "add-to-cache", remoteLayout });
  }

  return ops;
}

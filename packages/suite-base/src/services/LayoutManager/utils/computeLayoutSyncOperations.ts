// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";
import { RemoteLayout } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";

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
  const syncOperations: SyncOperation[] = [];

  const remoteLayoutsById = new Map<string, RemoteLayout>(
    remoteLayouts.map((remoteLayout) => [remoteLayout.id, remoteLayout]),
  );

  for (const localLayout of localLayouts) {
    const remoteLayout = remoteLayoutsById.get(localLayout.id);
    if (remoteLayout) {
      remoteLayoutsById.delete(localLayout.id);
      syncRemoteLayout(localLayout, remoteLayout, syncOperations);
    } else {
      syncLocalLayout(localLayout, syncOperations);
    }
  }

  for (const remoteLayout of remoteLayoutsById.values()) {
    syncOperations.push({ local: true, type: "add-to-cache", remoteLayout });
  }

  return syncOperations;
}

function syncRemoteLayout(
  localLayout: Layout,
  remoteLayout: RemoteLayout,
  operations: SyncOperation[],
): void {
  switch (localLayout.syncInfo?.status) {
    case undefined:
    case "new":
      log.warn(
        `Remote layout is present but local has sync status: ${localLayout.syncInfo?.status}`,
      );
      if (layoutIsShared(localLayout)) {
        log.warn(`Shared layout ${localLayout.id} shouldn't be untracked`);
        break;
      }
      operations.push({ local: false, type: "upload-new", localLayout });
      break;
    case "updated":
      operations.push({ local: false, type: "upload-updated", localLayout });
      break;
    case "tracked":
      // if the server doesn't provide a savedAt we consider the layout old and ignore it
      if (!remoteLayout.savedAt) {
        break;
      }

      if (localLayout.syncInfo.lastRemoteSavedAt !== remoteLayout.savedAt) {
        operations.push({
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
      operations.push({ local: false, type: "delete-remote", localLayout });
      break;
    case "remotely-deleted":
      log.warn(
        `Remote layout is present but cache is marked as remotely deleted: ${localLayout.id}`,
      );
      break;
  }
}

function syncLocalLayout(localLayout: Layout, operations: SyncOperation[]): void {
  switch (localLayout.syncInfo?.status) {
    case undefined:
    case "new":
      if (layoutIsShared(localLayout)) {
        log.warn(`Shared layout ${localLayout.id} should have been uploaded at creation`);
        break;
      }
      // operations.push({ local: false, type: "upload-new", localLayout });
      break;
    case "updated":
      if (!layoutIsShared(localLayout)) {
        operations.push({ local: true, type: "delete-local", localLayout });
      } else {
        operations.push({ local: true, type: "mark-deleted", localLayout });
      }
      break;
    case "tracked":
      if (localLayout.working == undefined || !layoutIsShared(localLayout)) {
        operations.push({ local: true, type: "delete-local", localLayout });
      } else {
        operations.push({ local: true, type: "mark-deleted", localLayout });
      }
      break;
    case "locally-deleted":
      if (layoutIsShared(localLayout)) {
        log.warn(`Shared layout ${localLayout.id} shouldn't be marked as locally deleted`);
      }
      operations.push({ local: true, type: "delete-local", localLayout });
      break;
    case "remotely-deleted":
      if (localLayout.working == undefined) {
        operations.push({ local: true, type: "delete-local", localLayout });
      }
      break;
  }
}

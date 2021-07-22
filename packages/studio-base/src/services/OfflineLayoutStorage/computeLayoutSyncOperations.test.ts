// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { CachedLayout } from "@foxglove/studio-base/services/ILayoutCache";
import { ISO8601Timestamp, LayoutID, UserID } from "@foxglove/studio-base/services/ILayoutStorage";
import { RemoteLayoutMetadata } from "@foxglove/studio-base/services/IRemoteLayoutStorage";

import computeLayoutSyncOperations, { SyncOperation } from "./computeLayoutSyncOperations";

function makeMetadata(
  id: string,
  name: string,
  { updatedAt }: { updatedAt: number } = { updatedAt: 2 },
): RemoteLayoutMetadata {
  return {
    id: id as LayoutID,
    name,
    createdAt: new Date(1).toISOString() as ISO8601Timestamp,
    updatedAt: new Date(updatedAt).toISOString() as ISO8601Timestamp,
    creatorUserId: "user1" as UserID,
    permission: "creator_write",
  };
}

describe("computeLayoutSyncOperations", () => {
  const state: PanelsState = {
    configById: {},
    globalVariables: {},
    linkedGlobalVariables: [],
    playbackConfig: defaultPlaybackConfig,
    userNodes: {},
    layout: undefined,
  };
  const local1 = { id: "local1", name: "1", state, serverMetadata: undefined };
  const local2 = { id: "local2", name: "2", state, serverMetadata: undefined };

  it.each<{
    name: string;
    local: [string, CachedLayout][];
    remote: [LayoutID, RemoteLayoutMetadata][];
    expected: SyncOperation[];
  }>([
    { name: "no layouts", local: [], remote: [], expected: [] },

    {
      name: "no changes",
      local: [
        ["local1", { ...local1, serverMetadata: makeMetadata("remote1", "1") }],
        ["local2", { ...local2, serverMetadata: makeMetadata("remote2", "2") }],
      ],
      remote: [
        ["remote1" as LayoutID, makeMetadata("remote1", "1")],
        ["remote2" as LayoutID, makeMetadata("remote2", "2")],
      ],
      expected: [],
    },

    {
      name: "caches new layout from server",
      local: [],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1")]],
      expected: [{ type: "add-to-cache", remoteLayout: makeMetadata("remote1", "1") }],
    },

    {
      name: "cleans up empty layout from cache",
      local: [["local1", local1]],
      remote: [],
      expected: [{ type: "upload-new", cachedLayout: local1 }],
    },

    {
      name: "uploads new layout",
      local: [["local1", local1]],
      remote: [],
      expected: [{ type: "upload-new", cachedLayout: local1 }],
    },

    {
      name: "updates cached metadata when updated remotely",
      local: [
        ["local1", { ...local1, serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }) }],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 10 })]],
      expected: [
        {
          type: "update-cached-metadata",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
          },
          remoteLayout: makeMetadata("remote1", "1", { updatedAt: 10 }),
        },
      ],
    },

    {
      name: "uploads when locally modified",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        ],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 5 })]],
      expected: [
        {
          type: "upload-updated",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
          remoteLayout: makeMetadata("remote1", "1", { updatedAt: 5 }),
        },
      ],
    },

    {
      name: "uploads when locally renamed, even with no state",
      local: [
        [
          "local1",
          {
            ...local1,
            name: "2",
            state: undefined,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        ],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 5 })]],
      expected: [
        {
          type: "upload-updated",
          cachedLayout: {
            ...local1,
            name: "2",
            state: undefined,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
          remoteLayout: makeMetadata("remote1", "1", { updatedAt: 5 }),
        },
      ],
    },

    {
      name: "deletes from server if locally deleted",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
        ],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 5 })]],
      expected: [
        {
          type: "delete-remote",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
          remoteLayout: makeMetadata("remote1", "1", { updatedAt: 5 }),
        },
      ],
    },

    {
      name: "detects conflict when updated both locally and remotely",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        ],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 10 })]],
      expected: [
        {
          type: "conflict",
          conflictType: "both-update",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        },
      ],
    },

    {
      name: "detects conflict when updated locally and deleted remotely",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        ],
      ],
      remote: [],
      expected: [
        {
          type: "conflict",
          conflictType: "local-update-remote-delete",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyModified: true,
          },
        },
      ],
    },

    {
      name: "detects conflict when deleted locally and updated remotely",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
        ],
      ],
      remote: [["remote1" as LayoutID, makeMetadata("remote1", "1", { updatedAt: 10 })]],
      expected: [
        {
          type: "conflict",
          conflictType: "local-delete-remote-update",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
        },
      ],
    },

    {
      name: "deletes locally when deleted remotely and unmodified locally",
      local: [
        ["local1", { ...local1, serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }) }],
      ],
      remote: [],
      expected: [
        {
          type: "delete-local",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
          },
        },
      ],
    },

    {
      name: "deletes locally when marked as deleted without server metadata",
      local: [["local1", { ...local1, locallyDeleted: true }]],
      remote: [],
      expected: [
        {
          type: "delete-local",
          cachedLayout: { ...local1, locallyDeleted: true },
        },
      ],
    },

    {
      name: "deletes locally when deleted both locally and remotely",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
        ],
      ],
      remote: [],
      expected: [
        {
          type: "delete-local",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
          },
        },
      ],
    },

    {
      name: "deletes locally when deleted and modified locally and deleted remotely",
      local: [
        [
          "local1",
          {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
            locallyModified: true,
          },
        ],
      ],
      remote: [],
      expected: [
        {
          type: "delete-local",
          cachedLayout: {
            ...local1,
            serverMetadata: makeMetadata("remote1", "1", { updatedAt: 5 }),
            locallyDeleted: true,
            locallyModified: true,
          },
        },
      ],
    },
  ])("$name", ({ local, remote, expected }) => {
    expect(computeLayoutSyncOperations(new Map(local), new Map(remote))).toEqual(expected);
  });
});

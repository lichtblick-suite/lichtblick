// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutData, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  Layout,
  LayoutPermission,
  LayoutSyncStatus,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { PlaybackConfig } from "@lichtblick/suite-base/types/panels";

const defaultPlaybackConfigValue: PlaybackConfig = {
  speed: 1.0,
};

const DEFAULT_LAYOUT_FOR_TESTS: LayoutData = {
  configById: {},
  globalVariables: {},
  userNodes: {},
  playbackConfig: defaultPlaybackConfigValue,
};

function randomLayoutPermission(): LayoutPermission {
  const layoutPermissions: LayoutPermission[] = ["CREATOR_WRITE", "ORG_READ", "ORG_WRITE"];
  const randomSelector = BasicBuilder.number({ min: 0, max: layoutPermissions.length - 1 });
  return layoutPermissions[randomSelector]!;
}

function randomLayoutSyncStatus(): LayoutSyncStatus {
  const layoutSyncStatuses: LayoutSyncStatus[] = [
    "new",
    "updated",
    "tracked",
    "locally-deleted",
    "remotely-deleted",
  ];
  const randomSelector = BasicBuilder.number({ min: 0, max: layoutSyncStatuses.length - 1 });
  return layoutSyncStatuses[randomSelector]!;
}

export default class LayoutBuilder {
  public static layout(props: Partial<Layout> = {}): Layout {
    return defaults<Layout>(props, {
      id: BasicBuilder.string() as LayoutID,
      name: BasicBuilder.string(),
      from: BasicBuilder.string(),
      permission: randomLayoutPermission(),
      baseline: { data: DEFAULT_LAYOUT_FOR_TESTS, savedAt: undefined },
      working: { data: DEFAULT_LAYOUT_FOR_TESTS, savedAt: undefined },
      syncInfo: { status: randomLayoutSyncStatus(), lastRemoteSavedAt: undefined },
    });
  }
}

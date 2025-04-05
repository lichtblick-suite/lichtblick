// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutData, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutBaseline,
  LayoutSyncInfo,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { PlaybackConfig } from "@lichtblick/suite-base/types/panels";

export default class LayoutBuilder {
  public static layoutPlaybackConfig(props: Partial<PlaybackConfig> = {}): PlaybackConfig {
    return defaults<PlaybackConfig>(props, {
      speed: BasicBuilder.float(),
    });
  }

  public static layoutData(props: Partial<LayoutData> = {}): LayoutData {
    return defaults<LayoutData>(props, {
      configById: {},
      globalVariables: {},
      userNodes: {},
      playbackConfig: LayoutBuilder.layoutPlaybackConfig(),
    });
  }

  public static layoutBaseline(props: Partial<LayoutBaseline> = {}): LayoutBaseline {
    return defaults<LayoutBaseline>(props, {
      data: LayoutBuilder.layoutData(),
      savedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static layoutSyncInfo(props: Partial<LayoutSyncInfo> = {}): LayoutSyncInfo {
    return defaults<LayoutSyncInfo>(props, {
      status: BasicBuilder.sample([
        "new",
        "updated",
        "tracked",
        "locally-deleted",
        "remotely-deleted",
      ]),
      lastRemoteSavedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static layout(props: Partial<Layout> = {}): Layout {
    return defaults<Layout>(props, {
      id: BasicBuilder.string() as LayoutID,
      name: BasicBuilder.string(),
      from: BasicBuilder.string(),
      permission: BasicBuilder.sample(["CREATOR_WRITE", "ORG_READ", "ORG_WRITE"]),
      baseline: LayoutBuilder.layoutBaseline(),
      working: LayoutBuilder.layoutBaseline(),
      syncInfo: LayoutBuilder.layoutSyncInfo(),
      //Deprecated fields
      data: LayoutBuilder.layoutData(),
      state: LayoutBuilder.layoutData(),
    });
  }
}

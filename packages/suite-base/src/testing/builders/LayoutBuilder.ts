// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutData, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutBaseline,
  LayoutPermission,
  LayoutSyncInfo,
  LayoutSyncStatus,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import GlobalVariableBuilder from "@lichtblick/suite-base/testing/builders/GlobalVariableBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { PlaybackConfig, UserScript, UserScripts } from "@lichtblick/suite-base/types/panels";

export default class LayoutBuilder {
  public static playbackConfig(props: Partial<PlaybackConfig> = {}): PlaybackConfig {
    return defaults<PlaybackConfig>(props, {
      speed: BasicBuilder.float(),
    });
  }

  public static userScript(props: Partial<UserScript> = {}): UserScript {
    return defaults<UserScript>(props, {
      name: BasicBuilder.string(),
      sourceCode: BasicBuilder.string(),
    });
  }

  public static userScripts(count = 3): UserScripts {
    return BasicBuilder.genericDictionary(LayoutBuilder.userScript, { count });
  }

  public static data(props: Partial<LayoutData> = {}): LayoutData {
    return defaults<LayoutData>(props, {
      configById: BasicBuilder.genericDictionary(Object),
      globalVariables: GlobalVariableBuilder.globalVariables(),
      userNodes: LayoutBuilder.userScripts(),
      playbackConfig: LayoutBuilder.playbackConfig(),
    });
  }

  public static baseline(props: Partial<LayoutBaseline> = {}): LayoutBaseline {
    return defaults<LayoutBaseline>(props, {
      data: LayoutBuilder.data(),
      savedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static syncInfo(props: Partial<LayoutSyncInfo> = {}): LayoutSyncInfo {
    return defaults<LayoutSyncInfo>(props, {
      status: BasicBuilder.sample([
        "new",
        "updated",
        "tracked",
        "locally-deleted",
        "remotely-deleted",
      ]) as LayoutSyncStatus,
      lastRemoteSavedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static layout(props: Partial<Layout> = {}): Layout {
    return defaults<Layout>(props, {
      id: BasicBuilder.string() as LayoutID,
      name: BasicBuilder.string(),
      from: BasicBuilder.string(),
      permission: BasicBuilder.sample([
        "CREATOR_WRITE",
        "ORG_READ",
        "ORG_WRITE",
      ]) as LayoutPermission,
      baseline: LayoutBuilder.baseline(),
      working: LayoutBuilder.baseline(),
      syncInfo: LayoutBuilder.syncInfo(),
    });
  }
}

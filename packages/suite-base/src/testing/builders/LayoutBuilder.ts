// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import { RemoteLayout } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import GlobalVariableBuilder from "@lichtblick/suite-base/testing/builders/GlobalVariableBuilder";
import {
  PanelConfig,
  PlaybackConfig,
  UserScript,
  UserScripts,
} from "@lichtblick/suite-base/types/panels";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class LayoutBuilder {
  public static readonly permission: LayoutPermission = BasicBuilder.sample([
    "CREATOR_WRITE",
    "ORG_READ",
    "ORG_WRITE",
  ]);

  public static readonly syncStatus: LayoutSyncStatus = BasicBuilder.sample([
    "new",
    "updated",
    "tracked",
    "locally-deleted",
    "remotely-deleted",
  ]);

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
      configById: BasicBuilder.genericDictionary(LayoutBuilder.panelConfig),
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
      status: LayoutBuilder.syncStatus,
      lastRemoteSavedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static layout(props: Partial<Layout> = {}): Layout {
    return defaults<Layout>(props, {
      id: LayoutBuilder.layoutId(),
      externalId: BasicBuilder.string(),
      name: BasicBuilder.string(),
      from: BasicBuilder.string(),
      permission: LayoutBuilder.permission,
      baseline: LayoutBuilder.baseline(),
      working: LayoutBuilder.baseline(),
      syncInfo: LayoutBuilder.syncInfo(),
    });
  }

  public static layouts(count = 3): Layout[] {
    return BasicBuilder.multiple(LayoutBuilder.layout, count);
  }

  public static panelConfig(props: Partial<PanelConfig> = {}): PanelConfig {
    return defaults<PanelConfig>(props, BasicBuilder.genericDictionary(String));
  }

  public static remoteLayout(props: Partial<RemoteLayout> = {}): RemoteLayout {
    return defaults<RemoteLayout>(props, {
      id: BasicBuilder.string() as LayoutID,
      externalId: BasicBuilder.string(),
      name: BasicBuilder.string(),
      permission: LayoutBuilder.permission,
      data: LayoutBuilder.data(),
      savedAt: new Date(BasicBuilder.number()).toISOString() as ISO8601Timestamp,
    });
  }

  public static layoutId(defaultId?: string): LayoutID {
    return (defaultId ?? BasicBuilder.string()) as LayoutID;
  }
}

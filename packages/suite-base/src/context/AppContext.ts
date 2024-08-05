// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable, SettingsTreeField, SettingsTreeNode } from "@lichtblick/suite";
import { AppBarMenuItem } from "@lichtblick/suite-base/components/AppBar/types";
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { WorkspaceContextStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import type { SceneExtensionConfig } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import type { Player } from "@lichtblick/suite-base/players/types";
import { createContext, useContext } from "react";
import { DeepPartial } from "ts-essentials";
import { StoreApi } from "zustand";

interface IAppContext {
  appBarLayoutButton?: JSX.Element;
  appBarMenuItems?: readonly AppBarMenuItem[];
  createEvent?: (args: {
    deviceId: string;
    timestamp: string;
    durationNanos: string;
    metadata: Record<string, string>;
  }) => Promise<void>;
  injectedFeatures?: InjectedFeatures;
  importLayoutFile?: (fileName: string, data: LayoutData) => Promise<void>;
  layoutEmptyState?: JSX.Element;
  layoutBrowser?: () => JSX.Element;
  sidebarItems?: readonly [[string, { iconName: string; title: string }]];
  syncAdapters?: readonly JSX.Element[];
  workspaceExtensions?: readonly JSX.Element[];
  extensionSettings?: JSX.Element;
  renderSettingsStatusButton?: (
    nodeOrField: Immutable<SettingsTreeNode | SettingsTreeField>,
  ) => JSX.Element | undefined;
  workspaceStoreCreator?: (
    initialState?: Partial<WorkspaceContextStore>,
  ) => StoreApi<WorkspaceContextStore>;
  PerformanceSidebarComponent?: React.ComponentType;
  wrapPlayer: (child: Player) => Player;
}

export const INJECTED_FEATURE_KEYS = {
  customSceneExtensions: "ThreeDeeRender.customSceneExtensions",
} as const;

export type InjectedFeatureMap = {
  [INJECTED_FEATURE_KEYS.customSceneExtensions]?: {
    customSceneExtensions: DeepPartial<SceneExtensionConfig>;
  };
};

export type InjectedFeatures = {
  availableFeatures: InjectedFeatureMap;
};

const AppContext = createContext<IAppContext>({
  // Default wrapPlayer is a no-op and is a pass-through of the provided child player
  wrapPlayer: (child) => child,
});
AppContext.displayName = "AppContext";

export function useAppContext(): IAppContext {
  return useContext(AppContext);
}

export { AppContext };
export type { IAppContext };

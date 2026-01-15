// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@lichtblick/hooks";
import { AppSettingsTab } from "@lichtblick/suite-base/components/AppSettingsDialog/types";
import { DataSourceDialogItem } from "@lichtblick/suite-base/components/DataSourceDialog";
import { IDataSourceFactory } from "@lichtblick/suite-base/context/PlayerSelectionContext";

export const SidebarItemKeys = [
  "account",
  "add-panel",
  "app-bar-tour",
  "app-settings",
  "connection",
  "extensions",
  "help",
  "layouts",
  "panel-settings",
  "logs-settings",
  "variables",
] as const;
export type SidebarItemKey = (typeof SidebarItemKeys)[number];

export const LeftSidebarItemKeys = ["panel-settings", "topics", "alerts", "layouts"] as const;
export type LeftSidebarItemKey = (typeof LeftSidebarItemKeys)[number];

export const RightSidebarItemKeys = [
  "events",
  "variables",
  "logs-settings",
  "performance",
] as const;
export type RightSidebarItemKey = (typeof RightSidebarItemKeys)[number];

export type WorkspaceContextStore = {
  dialogs: {
    dataSource: {
      activeDataSource: undefined | IDataSourceFactory;
      item: undefined | DataSourceDialogItem;
      open: boolean;
    };
    preferences: {
      initialTab: undefined | AppSettingsTab;
      open: boolean;
    };
  };
  featureTours: {
    active: undefined | string;
    shown: string[];
  };
  playbackControls: {
    repeat: boolean;
    syncInstances: boolean;
  };
  sidebars: {
    left: {
      item: undefined | LeftSidebarItemKey;
      open: boolean;
      size: undefined | number;
    };
    right: {
      item: undefined | RightSidebarItemKey;
      open: boolean;
      size: undefined | number;
    };
  };
};

export const WorkspaceContext = createContext<undefined | StoreApi<WorkspaceContextStore>>(
  undefined,
);

WorkspaceContext.displayName = "WorkspaceContext";

export const WorkspaceStoreSelectors = {
  selectPanelSettingsOpen: (store: WorkspaceContextStore): boolean => {
    return store.sidebars.left.open && store.sidebars.left.item === "panel-settings";
  },
};

/**
 * Fetches values from the workspace store.
 */
export function useWorkspaceStore<T>(selector: (store: WorkspaceContextStore) => T): T {
  const context = useGuaranteedContext(WorkspaceContext);
  return useStore(context, selector);
}

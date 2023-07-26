// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSettingsTab } from "@foxglove/studio-base/components/AppSettingsDialog/AppSettingsDialog";
import { DataSourceDialogItem } from "@foxglove/studio-base/components/DataSourceDialog";
import { IDataSourceFactory } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  LeftSidebarItemKey,
  RightSidebarItemKey,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";

// Type of version 0 store, used for migration.
type WorkspaceContextStoreV0 = {
  dataSourceDialog: {
    activeDataSource: undefined | IDataSourceFactory;
    item: undefined | DataSourceDialogItem;
    open: boolean;
  };
  featureTours: {
    active: undefined | string;
    shown: string[];
  };
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarItem: undefined | LeftSidebarItemKey;
  leftSidebarSize: undefined | number;
  rightSidebarItem: undefined | RightSidebarItemKey;
  rightSidebarSize: undefined | number;
  playbackControls: {
    repeat: boolean;
  };
  prefsDialogState: {
    initialTab: undefined | AppSettingsTab;
    open: boolean;
  };
};

export function migrateV0WorkspaceState(
  oldState: unknown,
  _version: number,
): WorkspaceContextStore {
  // Currently v0 is the only obsolete state. If we do more migrations this
  // needs to consider the version number.
  const v0State = oldState as WorkspaceContextStoreV0;
  const migrated: WorkspaceContextStore = {
    dialogs: {
      dataSource: {
        activeDataSource: undefined,
        item: undefined,
        open: false,
      },
      preferences: {
        initialTab: undefined,
        open: false,
      },
    },
    featureTours: {
      active: undefined,
      shown: v0State.featureTours.shown,
    },
    sidebars: {
      left: {
        item: v0State.leftSidebarItem,
        open: v0State.leftSidebarOpen,
        size: v0State.leftSidebarSize,
      },
      right: {
        item: v0State.rightSidebarItem,
        open: v0State.rightSidebarOpen,
        size: v0State.rightSidebarSize,
      },
    },
    playbackControls: {
      repeat: v0State.playbackControls.repeat,
    },
  };
  return migrated;
}

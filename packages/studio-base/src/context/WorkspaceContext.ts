// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, Dispatch, SetStateAction, useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";
import { StoreApi, useStore } from "zustand";

import { IDataSourceFactory } from "@foxglove/studio-base";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { AppSettingsTab } from "@foxglove/studio-base/components/AppSettingsDialog/AppSettingsDialog";
import { DataSourceDialogItem } from "@foxglove/studio-base/components/DataSourceDialog";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

export type SidebarItemKey =
  | "account"
  | "add-panel"
  | "connection"
  | "extensions"
  | "help"
  | "layouts"
  | "panel-settings"
  | "app-settings"
  | "studio-logs-settings"
  | "variables";

const LeftSidebarItemKeys = ["panel-settings", "topics"] as const;
export type LeftSidebarItemKey = (typeof LeftSidebarItemKeys)[number];

const RightSidebarItemKeys = ["events", "variables", "studio-logs-settings"] as const;
export type RightSidebarItemKey = (typeof RightSidebarItemKeys)[number];

export type WorkspaceContextStore = DeepReadonly<{
  dataSourceDialog: {
    activeDataSource: undefined | IDataSourceFactory;
    item: undefined | DataSourceDialogItem;
    open: boolean;
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
  sidebarItem: undefined | SidebarItemKey;
}>;

export const WorkspaceContext = createContext<undefined | StoreApi<WorkspaceContextStore>>(
  undefined,
);

WorkspaceContext.displayName = "WorkspaceContext";

export const WorkspaceStoreSelectors = {
  selectPanelSettingsOpen: (store: WorkspaceContextStore): boolean => {
    return (
      store.sidebarItem === "panel-settings" ||
      (store.leftSidebarOpen && store.leftSidebarItem === "panel-settings")
    );
  },
};

/**
 * Fetches values from the workspace store.
 */
export function useWorkspaceStore<T>(
  selector: (store: WorkspaceContextStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(WorkspaceContext);
  return useStore(context, selector, equalityFn);
}

export type WorkspaceActions = {
  dataSourceDialogActions: {
    close: () => void;
    open: (item: DataSourceDialogItem, dataSource?: IDataSourceFactory) => void;
  };
  openAccountSettings: () => void;
  openPanelSettings: () => void;
  openLayoutBrowser: () => void;
  playbackControlActions: {
    setRepeat: Dispatch<SetStateAction<boolean>>;
  };
  prefsDialogActions: {
    close: () => void;
    open: (initialTab?: AppSettingsTab) => void;
  };
  selectSidebarItem: (selectedSidebarItem: undefined | SidebarItemKey) => void;
  selectLeftSidebarItem: (item: undefined | LeftSidebarItemKey) => void;
  selectRightSidebarItem: (item: undefined | RightSidebarItemKey) => void;
  setLeftSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setLeftSidebarSize: (size: undefined | number) => void;
  setRightSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setRightSidebarSize: (size: undefined | number) => void;
};

function setterValue<T>(action: SetStateAction<T>, value: T): T {
  if (action instanceof Function) {
    return action(value);
  }

  return action;
}

/**
 * Provides various actions to manipulate the workspace state.
 */
export function useWorkspaceActions(): WorkspaceActions {
  const { setState: set } = useGuaranteedContext(WorkspaceContext);

  const { signIn } = useCurrentUser();
  const supportsAccountSettings = signIn != undefined;

  const [currentEnableNewTopNav = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_NEW_TOPNAV,
  );
  const [initialEnableNewTopNav] = useState(currentEnableNewTopNav);
  const enableNewTopNav = isDesktopApp() ? initialEnableNewTopNav : currentEnableNewTopNav;

  return useMemo(() => {
    return {
      dataSourceDialogActions: {
        close: () => {
          set({ dataSourceDialog: { activeDataSource: undefined, item: undefined, open: false } });
        },

        open: (
          selectedDataSourceDialogItem: DataSourceDialogItem,
          dataSource?: IDataSourceFactory,
        ) => {
          set({
            dataSourceDialog: {
              activeDataSource: dataSource,
              item: selectedDataSourceDialogItem,
              open: true,
            },
          });
        },
      },

      openAccountSettings: () => supportsAccountSettings && set({ sidebarItem: "account" }),

      openPanelSettings: () =>
        enableNewTopNav
          ? set({ leftSidebarItem: "panel-settings", leftSidebarOpen: true })
          : set({ sidebarItem: "panel-settings" }),

      openLayoutBrowser: () => set({ sidebarItem: "layouts" }),

      playbackControlActions: {
        setRepeat: (setter: SetStateAction<boolean>) => {
          set((oldValue) => {
            const repeat = setterValue(setter, oldValue.playbackControls.repeat);
            return { playbackControls: { repeat } };
          });
        },
      },

      prefsDialogActions: {
        close: () => set({ prefsDialogState: { open: false, initialTab: undefined } }),
        open: (initialTab?: AppSettingsTab) => {
          set({ prefsDialogState: { open: true, initialTab } });
        },
      },

      selectSidebarItem: (selectedSidebarItem: undefined | SidebarItemKey) => {
        if (selectedSidebarItem === "app-settings") {
          set({ prefsDialogState: { open: true, initialTab: undefined } });
        } else {
          set({ sidebarItem: selectedSidebarItem });
        }
      },

      selectLeftSidebarItem: (selectedLeftSidebarItem: undefined | LeftSidebarItemKey) => {
        set({
          leftSidebarItem: selectedLeftSidebarItem,
          leftSidebarOpen: selectedLeftSidebarItem != undefined,
        });
      },

      selectRightSidebarItem: (selectedRightSidebarItem: undefined | RightSidebarItemKey) => {
        set({
          rightSidebarItem: selectedRightSidebarItem,
          rightSidebarOpen: selectedRightSidebarItem != undefined,
        });
      },

      setLeftSidebarOpen: (setter: SetStateAction<boolean>) => {
        set((oldValue) => {
          const leftSidebarOpen = setterValue(setter, oldValue.leftSidebarOpen);
          if (leftSidebarOpen) {
            const oldItem = LeftSidebarItemKeys.find((item) => item === oldValue.leftSidebarItem);
            return {
              leftSidebarOpen,
              leftSidebarItem: oldItem ?? "panel-settings",
            };
          } else {
            return { leftSidebarOpen: false };
          }
        });
      },

      setLeftSidebarSize: (leftSidebarSize: undefined | number) => set({ leftSidebarSize }),

      setRightSidebarOpen: (setter: SetStateAction<boolean>) => {
        set((oldValue) => {
          const rightSidebarOpen = setterValue(setter, oldValue.rightSidebarOpen);
          const oldItem = RightSidebarItemKeys.find((item) => item === oldValue.rightSidebarItem);
          if (rightSidebarOpen) {
            return {
              rightSidebarOpen,
              rightSidebarItem: oldItem ?? "variables",
            };
          } else {
            return { rightSidebarOpen: false };
          }
        });
      },

      setRightSidebarSize: (rightSidebarSize: undefined | number) => set({ rightSidebarSize }),
    };
  }, [enableNewTopNav, set, supportsAccountSettings]);
}

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Draft, produce } from "immer";
import * as _ from "lodash-es";
import { Dispatch, SetStateAction, useCallback, useMemo } from "react";

import { useGuaranteedContext } from "@lichtblick/hooks";
import { AppSettingsTab } from "@lichtblick/suite-base/components/AppSettingsDialog/types";
import { DataSourceDialogItem } from "@lichtblick/suite-base/components/DataSourceDialog";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";

import {
  LeftSidebarItemKey,
  LeftSidebarItemKeys,
  RightSidebarItemKey,
  RightSidebarItemKeys,
  WorkspaceContext,
  WorkspaceContextStore,
} from "./WorkspaceContext";
import { useOpenFile } from "./useOpenFile";

export type WorkspaceActions = {
  dialogActions: {
    dataSource: {
      close: () => void;
      open: (item: DataSourceDialogItem, dataSource?: IDataSourceFactory) => void;
    };
    openFile: {
      open: () => Promise<void>;
    };
    preferences: {
      close: () => void;
      open: (initialTab?: AppSettingsTab) => void;
    };
  };

  featureTourActions: {
    startTour: (tour: string) => void;
    finishTour: (tour: string) => void;
  };

  openAccountSettings: () => void;
  openPanelSettings: () => void;
  openLayoutBrowser: () => void;

  playbackControlActions: {
    setRepeat: Dispatch<SetStateAction<boolean>>;
    setSyncInstances: Dispatch<SetStateAction<boolean>>;
  };

  sidebarActions: {
    left: {
      selectItem: (item: undefined | LeftSidebarItemKey) => void;
      setOpen: Dispatch<SetStateAction<boolean>>;
      setSize: (size: undefined | number) => void;
    };
    right: {
      selectItem: (item: undefined | RightSidebarItemKey) => void;
      setOpen: Dispatch<SetStateAction<boolean>>;
      setSize: (size: undefined | number) => void;
    };
  };
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
  const { setState } = useGuaranteedContext(WorkspaceContext);

  const { availableSources } = usePlayerSelection();

  const openFile = useOpenFile(availableSources);

  const set = useCallback(
    (setter: (draft: Draft<WorkspaceContextStore>) => void) => {
      setState(produce<WorkspaceContextStore>(setter));
    },
    [setState],
  );

  return useMemo(() => {
    return {
      dialogActions: {
        dataSource: {
          close: () => {
            set((draft) => {
              draft.dialogs.dataSource = {
                activeDataSource: undefined,
                item: undefined,
                open: false,
              };
            });
          },

          open: (
            selectedDataSourceDialogItem: DataSourceDialogItem,
            dataSource?: IDataSourceFactory,
          ) => {
            set((draft) => {
              // This cast is necessary to keep typescript from complaining about type depth.
              (draft as WorkspaceContextStore).dialogs.dataSource.activeDataSource = dataSource;
              draft.dialogs.dataSource.item = selectedDataSourceDialogItem;
              draft.dialogs.dataSource.open = true;
            });
          },
        },

        openFile: {
          open: openFile,
        },

        preferences: {
          close: () => {
            set((draft) => {
              draft.dialogs.preferences = { open: false, initialTab: undefined };
            });
          },
          open: (initialTab?: AppSettingsTab) => {
            set((draft) => {
              draft.dialogs.preferences = { open: true, initialTab };
            });
          },
        },
      },

      featureTourActions: {
        startTour: (tour: string) => {
          set((draft) => {
            draft.featureTours.active = tour;
          });
        },
        finishTour: (tour: string) => {
          set((draft) => {
            draft.featureTours.active = undefined;
            draft.featureTours.shown = _.union(draft.featureTours.shown, [tour]);
          });
        },
      },
      openAccountSettings: () => {},
      openPanelSettings: () => {
        set((draft) => {
          draft.sidebars.left.item = "panel-settings";
          draft.sidebars.left.open = true;
        });
      },
      openLayoutBrowser: () => {
        set((draft) => {
          draft.sidebars.left.item = "layouts";
        });
      },

      playbackControlActions: {
        setRepeat: (setter: SetStateAction<boolean>) => {
          set((draft) => {
            const repeat = setterValue(setter, draft.playbackControls.repeat);
            draft.playbackControls.repeat = repeat;
          });
        },

        setSyncInstances: (setter: SetStateAction<boolean>) => {
          set((draft) => {
            const sync = setterValue(setter, draft.playbackControls.syncInstances);
            draft.playbackControls.syncInstances = sync;
          });
        },
      },

      sidebarActions: {
        left: {
          selectItem: (selectedLeftSidebarItem: undefined | LeftSidebarItemKey) => {
            set((draft) => {
              draft.sidebars.left.item = selectedLeftSidebarItem;
              draft.sidebars.left.open = selectedLeftSidebarItem != undefined;
            });
          },

          setOpen: (setter: SetStateAction<boolean>) => {
            set((draft) => {
              const leftSidebarOpen = setterValue(setter, draft.sidebars.left.open);
              if (leftSidebarOpen) {
                const oldItem = LeftSidebarItemKeys.find(
                  (item) => item === draft.sidebars.left.item,
                );
                draft.sidebars.left.open = leftSidebarOpen;
                draft.sidebars.left.item = oldItem ?? "panel-settings";
              } else {
                draft.sidebars.left.open = false;
              }
            });
          },

          setSize: (leftSidebarSize: undefined | number) => {
            set((draft) => {
              draft.sidebars.left.size = leftSidebarSize;
            });
          },
        },
        right: {
          selectItem: (selectedRightSidebarItem: undefined | RightSidebarItemKey) => {
            set((draft) => {
              draft.sidebars.right.item = selectedRightSidebarItem;
              draft.sidebars.right.open = selectedRightSidebarItem != undefined;
            });
          },

          setOpen: (setter: SetStateAction<boolean>) => {
            set((draft) => {
              const rightSidebarOpen = setterValue(setter, draft.sidebars.right.open);
              const oldItem = RightSidebarItemKeys.find(
                (item) => item === draft.sidebars.right.item,
              );
              if (rightSidebarOpen) {
                draft.sidebars.right.open = rightSidebarOpen;
                draft.sidebars.right.item = oldItem ?? "variables";
              } else {
                draft.sidebars.right.open = false;
              }
            });
          },

          setSize: (rightSidebarSize: undefined | number) => {
            set((draft) => {
              draft.sidebars.right.size = rightSidebarSize;
            });
          },
        },
      },
    };
  }, [openFile, set]);
}

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

type WorkspaceContextType = {
  panelSettingsOpen: boolean;
  openPanelSettings: () => void;
  openHelp: () => void;
  openAccountSettings: () => void;
  openLayoutBrowser: () => void;
  rightSidebarOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setRightSidebarOpen: (open: boolean) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType>({
  panelSettingsOpen: false,
  rightSidebarOpen: false,

  openPanelSettings: (): void => {
    throw new Error("Must be in a WorkspaceContext.Provider to open panel settings");
  },
  openHelp: (): void => {
    throw new Error("Must be in a WorkspaceContext.Provider to open help");
  },
  openAccountSettings: (): void => {
    throw new Error("Must be in a WorkspaceContext.Provider to open account settings");
  },
  openLayoutBrowser: (): void => {
    throw new Error("Must be in a WorkspaceContext.Provider to open layout browser");
  },
  setRightSidebarOpen: (): void => {
    throw new Error("Must be in a WorkspaceContext.Provider to open the right sidebar");
  },
});
WorkspaceContext.displayName = "WorkspaceContext";

export function useWorkspace(): WorkspaceContextType {
  return useContext(WorkspaceContext);
}

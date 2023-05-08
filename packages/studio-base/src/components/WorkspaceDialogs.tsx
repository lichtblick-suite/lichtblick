// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSettingsDialog } from "@foxglove/studio-base/components/AppSettingsDialog";
import {
  useWorkspaceStore,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";

import { useWorkspaceActions } from "../context/Workspace/useWorkspaceActions";

const selectWorkspacePrefsDialogOpen = (store: WorkspaceContextStore) =>
  store.dialogs.preferences.open;

/**
 * Encapsulates dialogs shown and controlled at workspace level.
 */
export function WorkspaceDialogs(): JSX.Element {
  const prefsDialogOpen = useWorkspaceStore(selectWorkspacePrefsDialogOpen);
  const { dialogActions } = useWorkspaceActions();

  return (
    <>
      {prefsDialogOpen && (
        <AppSettingsDialog
          id="app-settings-dialog"
          open
          onClose={() => dialogActions.preferences.close()}
        />
      )}
    </>
  );
}

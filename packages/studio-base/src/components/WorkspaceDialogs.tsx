// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSettingsDialog } from "@foxglove/studio-base/components/AppSettingsDialog";
import {
  useWorkspaceActions,
  useWorkspaceStore,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/WorkspaceContext";

const selectWorkspacePrefsDialogOpen = (store: WorkspaceContextStore) =>
  store.prefsDialogState.open;

/**
 * Encapsulates dialogs shown and controlled at workspace level.
 */
export function WorkspaceDialogs(): JSX.Element {
  const prefsDialogOpen = useWorkspaceStore(selectWorkspacePrefsDialogOpen);
  const { prefsDialogActions } = useWorkspaceActions();

  return (
    <>
      {prefsDialogOpen && (
        <AppSettingsDialog
          id="app-settings-dialog"
          open
          onClose={() => prefsDialogActions.close()}
        />
      )}
    </>
  );
}

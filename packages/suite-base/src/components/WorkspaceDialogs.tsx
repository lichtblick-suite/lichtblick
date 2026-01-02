// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSettingsDialog } from "@lichtblick/suite-base/components/AppSettingsDialog";
import {
  useWorkspaceStore,
  WorkspaceContextStore,
} from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";

import { useWorkspaceActions } from "../context/Workspace/useWorkspaceActions";

const selectWorkspacePrefsDialogOpen = (store: WorkspaceContextStore) =>
  store.dialogs.preferences.open;

/**
 * Encapsulates dialogs shown and controlled at workspace level.
 */
export function WorkspaceDialogs(): React.JSX.Element {
  const prefsDialogOpen = useWorkspaceStore(selectWorkspacePrefsDialogOpen);
  const { dialogActions } = useWorkspaceActions();

  return (
    <>
      {prefsDialogOpen && (
        <AppSettingsDialog
          id="app-settings-dialog"
          open
          onClose={() => {
            dialogActions.preferences.close();
          }}
        />
      )}
    </>
  );
}

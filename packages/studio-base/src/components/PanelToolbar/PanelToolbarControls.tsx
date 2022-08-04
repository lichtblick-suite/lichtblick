// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import SettingsIcon from "@mui/icons-material/Settings";
import { forwardRef, useCallback, useContext } from "react";

import PanelContext from "@foxglove/studio-base/components/PanelContext";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import {
  PanelSettingsEditorStore,
  usePanelSettingsEditorStore,
} from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
  menuOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setMenuOpen: (_: boolean) => void;
};

const PanelToolbarControlsComponent = forwardRef<HTMLDivElement, PanelToolbarControlsProps>(
  (props, ref) => {
    const { additionalIcons, isUnknownPanel, menuOpen, setMenuOpen } = props;
    const panelId = useContext(PanelContext)?.id;
    const { setSelectedPanelIds } = useSelectedPanels();
    const { openPanelSettings } = useWorkspace();

    const hasSettingsSelector = useCallback(
      (store: PanelSettingsEditorStore) =>
        panelId ? store.settingsTrees[panelId] != undefined : false,
      [panelId],
    );

    const hasSettings = usePanelSettingsEditorStore(hasSettingsSelector);

    const openSettings = useCallback(() => {
      if (panelId) {
        setSelectedPanelIds([panelId]);
        openPanelSettings();
      }
    }, [setSelectedPanelIds, openPanelSettings, panelId]);

    return (
      <Stack direction="row" alignItems="center" paddingLeft={1} ref={ref}>
        {additionalIcons}
        {hasSettings && (
          <ToolbarIconButton title="Settings" onClick={openSettings}>
            <SettingsIcon />
          </ToolbarIconButton>
        )}
        <PanelActionsDropdown
          isOpen={menuOpen}
          setIsOpen={setMenuOpen}
          isUnknownPanel={isUnknownPanel}
        />
      </Stack>
    );
  },
);

PanelToolbarControlsComponent.displayName = "PanelToolbarControls";

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
export const PanelToolbarControls = React.memo(PanelToolbarControlsComponent);

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
import { forwardRef, useCallback, useContext, useMemo } from "react";

import PanelContext from "@foxglove/studio-base/components/PanelContext";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  PanelStateStore,
  usePanelStateStore,
} from "@foxglove/studio-base/context/PanelStateContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
};

const PanelToolbarControlsComponent = forwardRef<HTMLDivElement, PanelToolbarControlsProps>(
  (props, ref) => {
    const { additionalIcons, isUnknownPanel } = props;
    const { id: panelId, type: panelType } = useContext(PanelContext) ?? {};
    const panelCatalog = useContext(PanelCatalogContext);
    const { setSelectedPanelIds } = useSelectedPanels();
    const { openPanelSettings } = useWorkspaceActions();

    const hasSettingsSelector = useCallback(
      (store: PanelStateStore) => (panelId ? store.settingsTrees[panelId] != undefined : false),
      [panelId],
    );

    const panelInfo = useMemo(
      () => (panelType != undefined ? panelCatalog?.getPanelByType(panelType) : undefined),
      [panelCatalog, panelType],
    );

    const hasSettings = usePanelStateStore(hasSettingsSelector);

    const openSettings = useCallback(async () => {
      if (panelId) {
        setSelectedPanelIds([panelId]);
        openPanelSettings();
      }
    }, [panelId, setSelectedPanelIds, openPanelSettings]);

    // Show the settings button so that panel title is editable, unless we have a custom
    // toolbar in which case the title wouldn't be visible.
    const showSettingsButton = panelInfo?.hasCustomToolbar !== true || hasSettings;

    return (
      <Stack direction="row" alignItems="center" paddingLeft={1} ref={ref}>
        {additionalIcons}
        {showSettingsButton && (
          <ToolbarIconButton title="Settings" onClick={openSettings}>
            <SettingsIcon />
          </ToolbarIconButton>
        )}
        <PanelActionsDropdown isUnknownPanel={isUnknownPanel} />
      </Stack>
    );
  },
);

PanelToolbarControlsComponent.displayName = "PanelToolbarControls";

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
export const PanelToolbarControls = React.memo(PanelToolbarControlsComponent);

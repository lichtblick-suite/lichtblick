// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ListAltIcon from "@mui/icons-material/ListAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import { Badge } from "@mui/material";
import { forwardRef, useCallback, useContext, useMemo } from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { useStyles } from "@lichtblick/suite-base/components/PanelToolbar/PanelToolbarControls.style";
import ToolbarIconButton from "@lichtblick/suite-base/components/PanelToolbar/ToolbarIconButton";
import { PanelToolbarControlsProps } from "@lichtblick/suite-base/components/PanelToolbar/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@lichtblick/suite-base/context/PanelCatalogContext";
import {
  PanelStateStore,
  usePanelStateStore,
} from "@lichtblick/suite-base/context/PanelStateContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

const PanelToolbarControlsComponent = forwardRef<HTMLDivElement, PanelToolbarControlsProps>(
  (props, ref) => {
    const { additionalIcons, isUnknownPanel } = props;
    const { classes } = useStyles();
    const panelContext = useContext(PanelContext);
    const { id: panelId, type: panelType, showLogs, setShowLogs, logCount } = panelContext ?? {};
    const toggleLogs = () => {
      if (setShowLogs) {
        setShowLogs({ show: !(showLogs ?? false) });
      }
    };
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
      <Stack
        direction="row"
        alignItems="center"
        paddingLeft={1}
        ref={ref}
        fullHeight={true}
        paddingTop={1}
      >
        {additionalIcons}
        <Badge
          color="error"
          variant="dot"
          invisible={(logCount ?? 0) === 0}
          className={classes.logsBadge}
        >
          <ToolbarIconButton
            disabled={(logCount ?? 0) === 0}
            title={
              showLogs === true
                ? "Hide logs"
                : `Show logs${(logCount ?? 0) > 0 ? ` (${logCount})` : ""}`
            }
            onClick={toggleLogs}
          >
            <ListAltIcon color={showLogs === true ? "primary" : undefined} />
          </ToolbarIconButton>
        </Badge>
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

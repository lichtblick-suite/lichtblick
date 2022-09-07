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

import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import { IconButton, Tooltip } from "@mui/material";
import produce from "immer";
import { forwardRef, useCallback, useContext, useEffect } from "react";
import { useAsyncFn } from "react-use";
import { makeStyles } from "tss-react/mui";

import PanelContext from "@foxglove/studio-base/components/PanelContext";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  PanelSettingsEditorStore,
  usePanelSettingsEditorStore,
} from "@foxglove/studio-base/context/PanelSettingsEditorContext";
import { UserProfileStorageContext } from "@foxglove/studio-base/context/UserProfileStorageContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
  menuOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setMenuOpen: (_: boolean) => void;
};

const useStyles = makeStyles()((theme) => ({
  popper: {
    zIndex: theme.zIndex.modal - 1,
  },
  tooltip: {
    padding: theme.spacing(1, 1.5),
    boxShadow: theme.shadows[8],
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    marginTop: `${theme.spacing(1)} !important`,
  },
}));

const PanelToolbarControlsComponent = forwardRef<HTMLDivElement, PanelToolbarControlsProps>(
  (props, ref) => {
    const { additionalIcons, isUnknownPanel, menuOpen, setMenuOpen } = props;
    const { id: panelId, type: panelType } = useContext(PanelContext) ?? {};
    const panelCatalog = useContext(PanelCatalogContext);
    const { setSelectedPanelIds } = useSelectedPanels();
    const { openPanelSettings } = useWorkspace();
    const { classes } = useStyles();

    const hasSettingsSelector = useCallback(
      (store: PanelSettingsEditorStore) =>
        panelId ? store.settingsTrees[panelId] != undefined : false,
      [panelId],
    );

    const hasSettings = usePanelSettingsEditorStore(hasSettingsSelector);

    const userProfileStorage = useContext(UserProfileStorageContext);
    const [{ value: settingsOnboardingTooltip }, loadOnboardingState] =
      useAsyncFn(async (): Promise<string | undefined> => {
        if (panelType == undefined || userProfileStorage == undefined || !hasSettings) {
          return undefined;
        }
        const tooltip = panelCatalog?.getPanelByType(panelType)?.settingsOnboardingTooltip;
        if (tooltip == undefined) {
          return undefined;
        }
        const { onboarding } = await userProfileStorage.getUserProfile();
        const { settingsTooltipShownForPanelTypes = [] } = onboarding ?? {};
        if (settingsTooltipShownForPanelTypes.includes(panelType)) {
          return undefined;
        }
        return tooltip;
      }, [hasSettings, panelCatalog, panelType, userProfileStorage]);
    useEffect(() => {
      void loadOnboardingState();
    }, [loadOnboardingState]);

    const onDismissTooltip = useCallback(async () => {
      if (panelType && userProfileStorage) {
        await userProfileStorage.setUserProfile((profile) =>
          produce(profile, (draft) => {
            draft.onboarding ??= { settingsTooltipShownForPanelTypes: [] };
            if (draft.onboarding.settingsTooltipShownForPanelTypes?.includes(panelType) !== true) {
              draft.onboarding.settingsTooltipShownForPanelTypes?.push(panelType);
            }
          }),
        );
        await loadOnboardingState();
      }
    }, [loadOnboardingState, panelType, userProfileStorage]);

    const openSettings = useCallback(async () => {
      if (panelId) {
        setSelectedPanelIds([panelId]);
        openPanelSettings();
      }
      await onDismissTooltip();
    }, [panelId, onDismissTooltip, setSelectedPanelIds, openPanelSettings]);

    let settingsButton = (
      <ToolbarIconButton onClick={openSettings}>
        <SettingsIcon />
      </ToolbarIconButton>
    );
    if (settingsOnboardingTooltip) {
      settingsButton = (
        <Tooltip
          open
          classes={{ popper: classes.popper, tooltip: classes.tooltip }}
          title={
            <Stack direction="row" alignItems="center" style={{ maxWidth: 190 }}>
              <span>{settingsOnboardingTooltip}</span>
              <IconButton
                aria-label="Dismiss"
                role="button"
                size="small"
                color="inherit"
                onClick={(event) => {
                  event.stopPropagation();
                  void onDismissTooltip();
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          }
          arrow
          TransitionProps={{ in: true }}
          PopperProps={{
            modifiers: [
              {
                name: "preventOverflow",
                options: { altAxis: true, padding: 4 },
              },
            ],
          }}
        >
          {settingsButton}
        </Tooltip>
      );
    }

    return (
      <Stack direction="row" alignItems="center" paddingLeft={1} ref={ref}>
        {additionalIcons}
        {hasSettings && settingsButton}
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

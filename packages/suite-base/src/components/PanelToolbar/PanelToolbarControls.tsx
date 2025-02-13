// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { CloseOutlined } from "@ant-design/icons";
import SettingsIcon from "@mui/icons-material/Settings";
import { forwardRef, useCallback, useContext, useMemo } from "react";
import { MosaicContext, MosaicWindowContext, MosaicNode } from "react-mosaic-component";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import ToolbarIconButton from "@lichtblick/suite-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@lichtblick/suite-base/context/PanelCatalogContext";
import {
  PanelStateStore,
  usePanelStateStore,
} from "@lichtblick/suite-base/context/PanelStateContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

import { PanelActionsDropdown } from "./PanelActionsDropdown";

type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
};

const PanelToolbarControlsComponent = forwardRef<HTMLDivElement, PanelToolbarControlsProps>(
  (props, ref) => {
    const { additionalIcons, isUnknownPanel } = props;
    const { id: panelId, type: panelType } = useContext(PanelContext) ?? {};
    const panelContext = useContext(PanelContext);
    const tabId = panelContext?.tabId;
    const panelCatalog = useContext(PanelCatalogContext);
    const { setSelectedPanelIds } = useSelectedPanels();
    const { openPanelSettings } = useWorkspaceActions();
    const { mosaicActions } = useContext(MosaicContext);
    const { mosaicWindowActions } = useContext(MosaicWindowContext);
    const { closePanel } = useCurrentLayoutActions();

    const close = useCallback(() => {
      closePanel({
        tabId,
        root: mosaicActions.getRoot() as MosaicNode<string>,
        path: mosaicWindowActions.getPath(),
      });
    }, [closePanel, mosaicActions, mosaicWindowActions, tabId]);

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
        <ToolbarIconButton title="Close" onClick={close}>
          <CloseOutlined onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />
        </ToolbarIconButton>
      </Stack>
    );
  },
);

PanelToolbarControlsComponent.displayName = "PanelToolbarControls";

// Keep controls, which don't change often, in a pure component in order to avoid re-rendering the
// whole PanelToolbar when only children change.
export const PanelToolbarControls = React.memo(PanelToolbarControlsComponent);

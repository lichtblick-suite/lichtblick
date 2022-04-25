// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Link, SvgIcon, Typography } from "@mui/material";
import { StrictMode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAsync, useUnmount } from "react-use";

import { useConfigById } from "@foxglove/studio-base/PanelAPI";
import SettingsEditor from "@foxglove/studio-base/components/SettingsTreeEditor";
import ShareJsonModal from "@foxglove/studio-base/components/ShareJsonModal";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  ImmutableSettingsTree,
  PanelSettingsEditorContext,
} from "@foxglove/studio-base/context/PanelSettingsEditorContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import SchemaEditor from "./SchemaEditor";

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

const singlePanelIdSelector = (state: LayoutState) =>
  typeof state.selectedLayout?.data?.layout === "string"
    ? state.selectedLayout.data.layout
    : undefined;

export default function PanelSettings({
  selectedPanelIdsForTests,
}: React.PropsWithChildren<{
  selectedPanelIdsForTests?: readonly string[];
}>): JSX.Element {
  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const singlePanelId = useCurrentLayoutSelector(singlePanelIdSelector);
  const {
    selectedPanelIds: originalSelectedPanelIds,
    setSelectedPanelIds,
    selectAllPanels,
  } = useSelectedPanels();
  const selectedPanelIds = selectedPanelIdsForTests ?? originalSelectedPanelIds;

  // If no panel is selected and there is only one panel in the layout, select it
  useEffect(() => {
    if (selectedPanelIds.length === 0 && singlePanelId != undefined) {
      selectAllPanels();
    }
  }, [selectAllPanels, selectedPanelIds, singlePanelId]);

  const { openLayoutBrowser } = useWorkspace();
  const selectedPanelId = useMemo(
    () => (selectedPanelIds.length === 1 ? selectedPanelIds[0] : undefined),
    [selectedPanelIds],
  );

  // Automatically deselect the panel we were editing when the settings sidebar closes
  useUnmount(() => {
    if (selectedPanelId != undefined) {
      setSelectedPanelIds([]);
    }
  });

  const panelCatalog = usePanelCatalog();
  const { getCurrentLayoutState: getCurrentLayout, savePanelConfigs } = useCurrentLayoutActions();
  const panelType = useMemo(
    () => (selectedPanelId != undefined ? getPanelTypeFromId(selectedPanelId) : undefined),
    [selectedPanelId],
  );
  const panelInfo = useMemo(
    () => (panelType != undefined ? panelCatalog.getPanelByType(panelType) : undefined),
    [panelCatalog, panelType],
  );

  const [showShareModal, setShowShareModal] = useState(false);
  const shareModal = useMemo(() => {
    const panelConfigById = getCurrentLayout().selectedLayout?.data?.configById;
    if (selectedPanelId == undefined || !showShareModal || !panelConfigById) {
      return ReactNull;
    }
    return (
      <ShareJsonModal
        onRequestClose={() => setShowShareModal(false)}
        initialValue={panelConfigById[selectedPanelId] ?? {}}
        onChange={(config) =>
          savePanelConfigs({
            configs: [{ id: selectedPanelId, config: config as PanelConfig, override: true }],
          })
        }
        title="Import/export settings"
        noun="panel settings"
      />
    );
  }, [selectedPanelId, showShareModal, getCurrentLayout, savePanelConfigs]);

  const [config, saveConfig] = useConfigById<Record<string, unknown>>(selectedPanelId);

  const [settingsTree, setSettingsTree] = useState<undefined | ImmutableSettingsTree>();

  const updateSubscriber = useCallback((settings: ImmutableSettingsTree) => {
    setSettingsTree(settings);
  }, []);

  const { addUpdateSubscriber, removeUpdateSubscriber } = useContext(PanelSettingsEditorContext);

  useEffect(() => {
    if (selectedPanelId) {
      setSettingsTree(undefined);
      addUpdateSubscriber(selectedPanelId, updateSubscriber);
      return () => removeUpdateSubscriber(selectedPanelId, updateSubscriber);
    } else {
      return () => undefined;
    }
  }, [addUpdateSubscriber, removeUpdateSubscriber, selectedPanelId, updateSubscriber]);

  const { value: schema, error } = useAsync(async () => {
    if (panelInfo?.type == undefined) {
      return undefined;
    }

    return await panelCatalog.getConfigSchema(panelInfo.type);
  }, [panelCatalog, panelInfo?.type]);

  if (error) {
    return (
      <SidebarContent title="Panel settings">
        <Typography color="error.main">{error.message}</Typography>
      </SidebarContent>
    );
  }

  if (selectedLayoutId == undefined) {
    return (
      <SidebarContent title="Panel settings">
        <Typography color="text.secondary">
          <Link onClick={openLayoutBrowser}>Select a layout</Link> to get started!
        </Typography>
      </SidebarContent>
    );
  }
  if (selectedPanelId == undefined) {
    return (
      <SidebarContent title="Panel settings">
        <Typography color="text.secondary">Select a panel to edit its settings.</Typography>
      </SidebarContent>
    );
  }
  if (!panelInfo) {
    throw new Error(
      `Attempt to render settings but no panel component could be found for panel id ${selectedPanelId}`,
    );
  }

  if (!config) {
    return (
      <SidebarContent title="Panel settings">
        <Typography color="text.secondary">Loading panel settings...</Typography>
      </SidebarContent>
    );
  }

  const isSettingsTree = settingsTree != undefined;

  return (
    <SidebarContent disablePadding={isSettingsTree} title={`${panelInfo.title} panel settings`}>
      {shareModal}
      <Stack gap={2} justifyContent="flex-start">
        <div>
          {settingsTree && <SettingsEditor settings={settingsTree} />}
          {!settingsTree && schema && (
            <StrictMode>
              <SchemaEditor configSchema={schema} config={config} saveConfig={saveConfig} />
            </StrictMode>
          )}
          {!settingsTree && !schema && (
            <Typography color="text.secondary">No additional settings available.</Typography>
          )}
        </div>
        <Stack
          paddingX={isSettingsTree ? 2 : 0}
          paddingBottom={isSettingsTree ? 2 : 0}
          gap={1}
          alignItems="flex-start"
        >
          <Button
            size="large"
            fullWidth
            disableRipple
            variant="contained"
            color="inherit"
            disabled={panelType === TAB_PANEL_TYPE}
            onClick={() => setShowShareModal(true)}
            startIcon={
              <SvgIcon viewBox="0 0 2048 2048">
                <path d="M219 1024l205 205-37 145-350-350 430-429 90 90-338 339zm1792 0l-430 429-90-90 338-339-149-149q26-26 47-48t38-48l246 245zm-547-640q42 0 78 15t64 42 42 63 16 78q0 39-15 76t-43 65l-717 719-377 94 94-377 717-718q28-28 65-42t76-15zm51 249q21-21 21-51 0-31-20-50t-52-20q-14 0-27 4t-23 15l-692 694-34 135 135-34 692-693z" />
              </SvgIcon>
            }
          >
            Import/export settings…
          </Button>
          <Button
            size="large"
            fullWidth
            disableRipple
            variant="contained"
            color="inherit"
            onClick={() =>
              savePanelConfigs({
                configs: [{ id: selectedPanelId, config: {}, override: true }],
              })
            }
            startIcon={
              <SvgIcon viewBox="0 0 2048 2048">
                <path d="M1713 896q69 0 130 26t106 72 72 107 27 131q0 66-25 127t-73 110l-449 448-90-90 448-449q29-29 45-67t16-79q0-43-16-80t-45-66-66-45-81-17q-41 0-79 16t-67 45l-195 195h165v128h-384v-384h128v165q47-47 93-99t97-95 111-71 132-28zm79-128h-128V640h128v128zm0-256h-128V384h128v128zm0-256h-128V128h128v128zm-256 0h-128V128h128v128zm-256 0h-128V128h128v128zM896 128h128v128H896V128zm-256 0h128v128H640V128zm-256 0h128v128H384V128zm-256 0h128v128H128V128zm0 256h128v128H128V384zm0 256h128v128H128V640zm0 256h128v128H128V896zm0 256h128v128H128v-128zm0 256h128v128H128v-128zm0 256h128v128H128v-128zm256 0h128v128H384v-128zm256 0h128v128H640v-128zm256 0h128v128H896v-128zm256 0h128v128h-128v-128z" />
              </SvgIcon>
            }
          >
            Reset to defaults
          </Button>
        </Stack>
      </Stack>
    </SidebarContent>
  );
}

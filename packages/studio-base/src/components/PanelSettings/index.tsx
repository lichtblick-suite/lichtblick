// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, Link, Text, useTheme } from "@fluentui/react";
import { Stack } from "@mui/material";
import { StrictMode, useMemo, useState } from "react";
import { useAsync, useUnmount } from "react-use";

import { useConfigById } from "@foxglove/studio-base/PanelAPI";
import ShareJsonModal from "@foxglove/studio-base/components/ShareJsonModal";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useHelpInfo } from "@foxglove/studio-base/context/HelpInfoContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import SchemaEditor from "./SchemaEditor";

export default function PanelSettings({
  selectedPanelIdsForTests,
}: React.PropsWithChildren<{
  selectedPanelIdsForTests?: readonly string[];
}>): JSX.Element {
  const selectedLayoutId = useCurrentLayoutSelector((state) => state.selectedLayout?.id);
  const { selectedPanelIds: originalSelectedPanelIds, setSelectedPanelIds } = useSelectedPanels();
  const selectedPanelIds = selectedPanelIdsForTests ?? originalSelectedPanelIds;
  const { openLayoutBrowser, openHelp } = useWorkspace();
  const selectedPanelId = useMemo(
    () => (selectedPanelIds.length === 1 ? selectedPanelIds[0] : undefined),
    [selectedPanelIds],
  );
  useUnmount(() => {
    // Automatically deselect the panel we were editing when the settings sidebar closes
    if (selectedPanelId != undefined) {
      setSelectedPanelIds([]);
    }
  });

  const theme = useTheme();
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
  const { setHelpInfo } = useHelpInfo();

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

  const { value: schema, error } = useAsync(async () => {
    if (panelInfo?.type == undefined) {
      return undefined;
    }

    return await panelCatalog.getConfigSchema(panelInfo.type);
  }, [panelCatalog, panelInfo?.type]);

  if (error) {
    return (
      <SidebarContent title="Panel settings">
        <Text styles={{ root: { color: theme.semanticColors.errorText } }}>{error.message}</Text>
      </SidebarContent>
    );
  }

  if (selectedLayoutId == undefined) {
    return (
      <SidebarContent title="Panel settings">
        <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>
          <Link onClick={openLayoutBrowser}>Select a layout</Link> to get started!
        </Text>
      </SidebarContent>
    );
  }
  if (selectedPanelId == undefined) {
    return (
      <SidebarContent title="Panel settings">
        <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>
          Select a panel to edit its settings.
        </Text>
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
        <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>
          Loading panel settings...
        </Text>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent title={`${panelInfo.title} panel settings`}>
      {shareModal}
      <Stack spacing={2} alignItems="flex-start">
        {panelInfo?.help != undefined && (
          <div>
            <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>
              See docs{" "}
              <Link
                onClick={() => {
                  setHelpInfo({ title: panelInfo?.type, content: panelInfo?.help });
                  openHelp();
                }}
              >
                here
              </Link>
              .
            </Text>
          </div>
        )}
        <div>
          {schema ? (
            <StrictMode>
              <SchemaEditor configSchema={schema} config={config} saveConfig={saveConfig} />
            </StrictMode>
          ) : (
            <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>
              No additional settings available.
            </Text>
          )}
        </div>
        <div style={{ height: theme.spacing.m }} />
        <div>
          <DefaultButton
            text="Import/export settings…"
            styles={{ label: { fontWeight: "normal" } }}
            iconProps={{
              iconName: "CodeEdit",
              styles: { root: { "& span": { verticalAlign: "baseline" } } },
            }}
            onClick={() => setShowShareModal(true)}
            disabled={panelType === TAB_PANEL_TYPE}
          />
        </div>
        <div>
          <DefaultButton
            text="Reset to defaults"
            styles={{ label: { fontWeight: "normal" } }}
            iconProps={{
              iconName: "ClearSelection",
              styles: { root: { "& span": { verticalAlign: "baseline" } } },
            }}
            onClick={() =>
              savePanelConfigs({
                configs: [{ id: selectedPanelId, config: {}, override: true }],
              })
            }
          />
        </div>
      </Stack>
    </SidebarContent>
  );
}

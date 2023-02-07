// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, IconButton, TextField } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { useCallback, useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";
import { makeStyles } from "tss-react/mui";

import { SettingsTree, SettingsTreeAction, SettingsTreeField } from "@foxglove/studio";
import { useConfigById } from "@foxglove/studio-base/PanelAPI";
import { FieldEditor } from "@foxglove/studio-base/components/SettingsTreeEditor/FieldEditor";
import Stack from "@foxglove/studio-base/components/Stack";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { usePanelStateStore } from "@foxglove/studio-base/context/PanelStateContext";
import { getPanelTypeFromId, PANEL_TITLE_CONFIG_KEY } from "@foxglove/studio-base/util/layout";

import { NodeEditor } from "./NodeEditor";
import { filterTreeNodes, prepareSettingsNodes } from "./utils";

const useStyles = makeStyles()((theme) => ({
  appBar: {
    top: -1,
    zIndex: theme.zIndex.appBar - 1,
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(20%, 20ch) auto",
    columnGap: theme.spacing(1),
  },
}));

const makeStablePath = memoizeWeak((key: string) => [key]);

export default function SettingsTreeEditor({
  settings,
}: {
  settings: DeepReadonly<SettingsTree>;
}): JSX.Element {
  const { classes } = useStyles();
  const { actionHandler, focusedPath } = settings;
  const [filterText, setFilterText] = useState<string>("");

  const filteredNodes = useMemo(() => {
    if (filterText.length > 0) {
      return filterTreeNodes(settings.nodes, filterText);
    } else {
      return settings.nodes;
    }
  }, [settings.nodes, filterText]);

  const definedNodes = useMemo(() => prepareSettingsNodes(filteredNodes), [filteredNodes]);

  const { selectedPanelIds } = useSelectedPanels();
  const selectedPanelId = useMemo(
    () => (selectedPanelIds.length === 1 ? selectedPanelIds[0] : undefined),
    [selectedPanelIds],
  );
  const panelCatalog = usePanelCatalog();
  const panelType = useMemo(
    () => (selectedPanelId != undefined ? getPanelTypeFromId(selectedPanelId) : undefined),
    [selectedPanelId],
  );
  const panelInfo = useMemo(
    () => (panelType != undefined ? panelCatalog.getPanelByType(panelType) : undefined),
    [panelCatalog, panelType],
  );
  const [config, saveConfig] = useConfigById(selectedPanelId);
  const defaultPanelTitle = usePanelStateStore((state) =>
    selectedPanelId ? state.defaultTitles[selectedPanelId] : undefined,
  );
  const customPanelTitle =
    typeof config?.[PANEL_TITLE_CONFIG_KEY] === "string"
      ? config[PANEL_TITLE_CONFIG_KEY]
      : undefined;
  const panelTitleField = useMemo<SettingsTreeField>(
    () => ({
      input: "string",
      label: "Title",
      placeholder: defaultPanelTitle ?? panelInfo?.title,
      value: customPanelTitle,
    }),
    [customPanelTitle, defaultPanelTitle, panelInfo?.title],
  );
  const handleTitleChange = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update" && action.payload.path[0] === PANEL_TITLE_CONFIG_KEY) {
        saveConfig({ [PANEL_TITLE_CONFIG_KEY]: action.payload.value });
      }
    },
    [saveConfig],
  );

  const showTitleField = filterText.length === 0 && panelInfo?.hasCustomToolbar !== true;

  return (
    <Stack fullHeight>
      {settings.enableFilter === true && (
        <AppBar className={classes.appBar} position="sticky" color="default" elevation={0}>
          <TextField
            data-testid="settings-filter-field"
            onChange={(event) => setFilterText(event.target.value)}
            value={filterText}
            variant="filled"
            fullWidth
            placeholder="Filter"
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" />,
              endAdornment: filterText && (
                <IconButton
                  size="small"
                  title="Clear search"
                  onClick={() => setFilterText("")}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        </AppBar>
      )}
      <div className={classes.fieldGrid}>
        {showTitleField && (
          <>
            <Stack paddingBottom={0.5} style={{ gridColumn: "span 2" }} />
            <FieldEditor
              field={panelTitleField}
              path={[PANEL_TITLE_CONFIG_KEY]}
              actionHandler={handleTitleChange}
            />
          </>
        )}
        {definedNodes.map(([key, root]) => (
          <NodeEditor
            key={key}
            actionHandler={actionHandler}
            defaultOpen={root.defaultExpansionState === "collapsed" ? false : true}
            filter={filterText}
            focusedPath={focusedPath}
            path={makeStablePath(key)}
            settings={root}
          />
        ))}
      </div>
    </Stack>
  );
}

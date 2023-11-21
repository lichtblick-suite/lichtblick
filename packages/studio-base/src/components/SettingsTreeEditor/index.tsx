// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import { IconButton, TextField } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import { Immutable, SettingsTree, SettingsTreeAction, SettingsTreeField } from "@foxglove/studio";
import { useConfigById } from "@foxglove/studio-base/PanelAPI";
import { FieldEditor } from "@foxglove/studio-base/components/SettingsTreeEditor/FieldEditor";
import Stack from "@foxglove/studio-base/components/Stack";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { usePanelStateStore } from "@foxglove/studio-base/context/PanelStateContext";
import { PANEL_TITLE_CONFIG_KEY, getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import { NodeEditor } from "./NodeEditor";
import { filterTreeNodes, prepareSettingsNodes } from "./utils";

const useStyles = makeStyles()((theme) => ({
  appBar: {
    top: 0,
    marginRight: 1,
    zIndex: theme.zIndex.appBar,
    padding: theme.spacing(0.5),
    position: "sticky",
    backgroundColor: theme.palette.background.paper,
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(20%, 20ch) auto",
    columnGap: theme.spacing(1),
  },
  textField: {
    ".MuiOutlinedInput-notchedOutline": {
      border: "none",
    },
  },
  startAdornment: {
    display: "flex",
  },
}));

const makeStablePath = memoizeWeak((key: string) => [key]);

export default function SettingsTreeEditor({
  variant,
  settings,
}: {
  variant: "panel" | "log";
  settings: Immutable<SettingsTree>;
}): JSX.Element {
  const { classes } = useStyles();
  const { actionHandler, focusedPath } = settings;
  const [filterText, setFilterText] = useState<string>("");
  const { t } = useTranslation("settingsEditor");

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
      label: t("title"),
      placeholder: defaultPanelTitle ?? panelInfo?.title,
      value: customPanelTitle,
    }),
    [customPanelTitle, defaultPanelTitle, panelInfo?.title, t],
  );
  const handleTitleChange = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update" && action.payload.path[0] === PANEL_TITLE_CONFIG_KEY) {
        saveConfig({ [PANEL_TITLE_CONFIG_KEY]: action.payload.value });
      }
    },
    [saveConfig],
  );

  const showTitleField =
    filterText.length === 0 && panelInfo?.hasCustomToolbar !== true && variant !== "log";

  return (
    <Stack fullHeight>
      {settings.enableFilter === true && (
        <header className={classes.appBar}>
          <TextField
            id={`${variant}-settings-filter`}
            variant="filled"
            onChange={(event) => {
              setFilterText(event.target.value);
            }}
            value={filterText}
            className={classes.textField}
            fullWidth
            placeholder={t("searchPanelSettings")}
            inputProps={{
              "data-testid": `${variant}-settings-filter-input`,
            }}
            InputProps={{
              size: "small",
              startAdornment: (
                <label className={classes.startAdornment} htmlFor="settings-filter">
                  <SearchIcon fontSize="small" />
                </label>
              ),
              endAdornment: filterText && (
                <IconButton
                  size="small"
                  title={t("clearSearch")}
                  onClick={() => {
                    setFilterText("");
                  }}
                  edge="end"
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        </header>
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

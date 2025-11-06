// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import { IconButton, TextField } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingsTreeAction, SettingsTreeField } from "@lichtblick/suite";
import { useConfigById } from "@lichtblick/suite-base/PanelAPI";
import { FieldEditor } from "@lichtblick/suite-base/components/SettingsTreeEditor/FieldEditor";
import { useStyles } from "@lichtblick/suite-base/components/SettingsTreeEditor/SettingsTreeEditor.style";
import { SettingsTreeEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { PANEL_TITLE_CONFIG_KEY, getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

import { NodeEditor } from "./NodeEditor";
import { filterTreeNodes, prepareSettingsNodes } from "./utils";

const makeStablePath = memoizeWeak((key: string) => [key]);

export default function SettingsTreeEditor({
  variant,
  settings,
}: Readonly<SettingsTreeEditorProps>): React.JSX.Element {
  const { classes } = useStyles();
  const { actionHandler, focusedPath } = settings;
  const [filterText, setFilterText] = useState<string>("");
  const { t } = useTranslation("settingsEditor");

  const filteredNodes = useMemo(() => {
    if (filterText.length > 0) {
      return filterTreeNodes(settings.nodes, filterText);
    }
    return settings.nodes;
  }, [settings.nodes, filterText]);

  const memoizedNodes = useMemo(() => {
    const preparedNodes = prepareSettingsNodes(filteredNodes);
    return preparedNodes.map(([key, root]) => ({
      key,
      actionHandler,
      defaultOpen: root.defaultExpansionState !== "collapsed",
      filter: filterText,
      focusedPath,
      path: makeStablePath(key),
      settings: root,
    }));
  }, [filteredNodes, actionHandler, filterText, focusedPath]);

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

  const handleFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(event.target.value);
  }, []);

  return (
    <Stack fullHeight data-testid="settings-tree-editor">
      {settings.enableFilter === true && (
        <header className={classes.appBar}>
          <TextField
            id={`${variant}-settings-filter`}
            variant="filled"
            onChange={handleFilterChange}
            value={filterText}
            className={classes.textField}
            fullWidth
            placeholder={t("searchPanelSettings")}
            slotProps={{
              htmlInput: {
                "data-testid": `${variant}-settings-filter-input`,
              },
              input: {
                size: "small",
                startAdornment: (
                  <label className={classes.startAdornment} htmlFor="settings-filter">
                    <SearchIcon fontSize="small" />
                  </label>
                ),
                endAdornment: filterText && (
                  <IconButton
                    data-testid="clear-filter-button"
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
              },
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
        {memoizedNodes.map((nodeProps) => (
          <NodeEditor {...nodeProps} key={nodeProps.key} />
        ))}
      </div>
    </Stack>
  );
}

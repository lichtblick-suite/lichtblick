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

import { Autocomplete, TextField } from "@mui/material";
import produce from "immer";
import { set, sortBy, uniq } from "lodash";
import { useCallback, useMemo, useEffect } from "react";

import { SettingsTreeAction } from "@foxglove/studio";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import DiagnosticStatus from "./DiagnosticStatus";
import helpContent from "./DiagnosticStatusPanel.help.md";
import { buildStatusPanelSettingsTree } from "./settings";
import useAvailableDiagnostics from "./useAvailableDiagnostics";
import useDiagnostics from "./useDiagnostics";
import { DiagnosticStatusConfig as Config, getDisplayName } from "./util";

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const ALLOWED_DATATYPES: string[] = [
  "diagnostic_msgs/DiagnosticArray",
  "diagnostic_msgs/msg/DiagnosticArray",
  "ros.diagnostic_msgs.DiagnosticArray",
];

// component to display a single diagnostic status from list
function DiagnosticStatusPanel(props: Props) {
  const { saveConfig, config } = props;
  const { topics } = useDataSourceInfo();
  const { openSiblingPanel } = usePanelContext();
  const { selectedHardwareId, selectedName, splitFraction, topicToRender } = config;

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  // Filter down all topics to those that conform to our supported datatypes
  const availableTopics = useMemo(() => {
    const filtered = topics
      .filter((topic) => ALLOWED_DATATYPES.includes(topic.datatype))
      .map((topic) => topic.name);

    // Keeps only the first occurrence of each topic.
    return uniq([...filtered]);
  }, [topics]);

  // If the topicToRender is not in the availableTopics, then we should not try to use it
  const diagnosticTopic = useMemo(() => {
    return availableTopics.includes(topicToRender) ? topicToRender : undefined;
  }, [availableTopics, topicToRender]);

  const diagnostics = useDiagnostics(diagnosticTopic);
  const availableDiagnostics = useAvailableDiagnostics(diagnosticTopic);

  // generate Autocomplete entries from the available diagnostics
  const autocompleteOptions = useMemo(() => {
    const items = [];

    for (const [hardwareId, nameSet] of availableDiagnostics) {
      if (hardwareId) {
        items.push({ label: hardwareId, hardwareId, name: undefined });
      }

      for (const name of nameSet) {
        if (name) {
          const label = getDisplayName(hardwareId, name);
          items.push({ label, hardwareId, name });
        }
      }
    }

    return items;
  }, [availableDiagnostics]);

  const selectedDisplayName = useMemo(() => {
    return selectedHardwareId != undefined
      ? getDisplayName(selectedHardwareId, selectedName ?? "")
      : undefined;
  }, [selectedHardwareId, selectedName]);

  const selectedAutocompleteOption = useMemo(() => {
    return (
      autocompleteOptions.find((item) => {
        return item.label === selectedDisplayName;
      }) ?? ReactNull
    );
  }, [autocompleteOptions, selectedDisplayName]);

  const filteredDiagnostics = useMemo(() => {
    const diagnosticsByName = diagnostics.get(selectedHardwareId ?? "");
    const items = [];

    if (diagnosticsByName != undefined) {
      for (const diagnostic of diagnosticsByName.values()) {
        if (selectedName == undefined || selectedName === diagnostic.status.name) {
          items.push(diagnostic);
        }
      }
    }

    return items;
  }, [diagnostics, selectedHardwareId, selectedName]);

  // If there are available options but none match the user input we show a No matches
  // but if we don't have any options at all then we show waiting for diagnostics...
  const noOptionsText =
    autocompleteOptions.length > 0 ? "No matches" : "Waiting for diagnostics...";

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      saveConfig(produce((draft) => set(draft, path.slice(1), value)));
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildStatusPanelSettingsTree(topicToRender, availableTopics),
    });
  }, [actionHandler, availableTopics, topicToRender, updatePanelSettingsTree]);

  return (
    <Stack flex="auto" overflow="hidden">
      <PanelToolbar helpContent={helpContent}>
        <Autocomplete
          disablePortal
          blurOnSelect={true}
          disabled={autocompleteOptions.length === 0}
          options={autocompleteOptions}
          value={selectedAutocompleteOption ?? ReactNull}
          noOptionsText={noOptionsText}
          onChange={(_ev, value) => {
            if (!value) {
              saveConfig({
                selectedHardwareId: undefined,
                selectedName: undefined,
              });
              return;
            }

            saveConfig({
              selectedHardwareId: value.hardwareId,
              selectedName: value.name,
            });
          }}
          fullWidth
          size="small"
          renderInput={(params) => (
            <TextField
              variant="standard"
              {...params}
              InputProps={{ ...params.InputProps, disableUnderline: true }}
              placeholder={selectedDisplayName ?? "Filter"}
            />
          )}
        />
      </PanelToolbar>
      {filteredDiagnostics.length > 0 ? (
        <Stack flex="auto" overflowY="auto">
          {sortBy(filteredDiagnostics, ({ status }) => status.name.toLowerCase()).map((item) => (
            <DiagnosticStatus
              key={item.id}
              info={item}
              splitFraction={splitFraction}
              onChangeSplitFraction={(newSplitFraction) =>
                props.saveConfig({ splitFraction: newSplitFraction })
              }
              topicToRender={topicToRender}
              openSiblingPanel={openSiblingPanel}
            />
          ))}
        </Stack>
      ) : selectedDisplayName ? (
        <EmptyState>
          Waiting for diagnostics from <code>{selectedDisplayName}</code>
        </EmptyState>
      ) : (
        <EmptyState>No diagnostic node selected</EmptyState>
      )}
    </Stack>
  );
}

const defaultConfig: Config = { topicToRender: "/diagnostics" };

export default Panel(
  Object.assign(DiagnosticStatusPanel, {
    panelType: "DiagnosticStatusPanel",
    defaultConfig,
  }),
);

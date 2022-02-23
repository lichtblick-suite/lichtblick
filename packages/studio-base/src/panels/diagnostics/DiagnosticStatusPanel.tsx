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
import { makeStyles } from "@mui/styles";
import { sortBy } from "lodash";
import { useMemo } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import { DIAGNOSTIC_TOPIC } from "@foxglove/studio-base/util/globalConstants";

import DiagnosticStatus from "./DiagnosticStatus";
import helpContent from "./DiagnosticStatusPanel.help.md";
import useAvailableDiagnostics from "./useAvailableDiagnostics";
import useDiagnostics from "./useDiagnostics";
import { getDisplayName } from "./util";

export type Config = {
  selectedHardwareId?: string;
  selectedName?: string;
  splitFraction?: number;
  topicToRender: string;
  collapsedSections: { name: string; section: string }[];
};

type Props = {
  config: Config;
  saveConfig: (arg0: Partial<Config>) => void;
};

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    overflow: "scroll",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    overflowY: "auto",
  },
});

// component to display a single diagnostic status from list
function DiagnosticStatusPanel(props: Props) {
  const classes = useStyles();
  const { saveConfig, config } = props;
  const { topics } = useDataSourceInfo();
  const { openSiblingPanel } = usePanelContext();
  const {
    selectedHardwareId,
    selectedName,
    splitFraction,
    topicToRender,
    collapsedSections = [],
  } = config;

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={topicToRender}
      onChange={(newTopicToRender) => saveConfig({ topicToRender: newTopicToRender })}
      topics={topics}
      allowedDatatypes={[
        "diagnostic_msgs/DiagnosticArray",
        "diagnostic_msgs/msg/DiagnosticArray",
        "ros.diagnostic_msgs.DiagnosticArray",
      ]}
      defaultTopicToRender={DIAGNOSTIC_TOPIC}
    />
  );

  const availableDiagnostics = useAvailableDiagnostics(topicToRender);

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

  const diagnostics = useDiagnostics(topicToRender);

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

  return (
    <div className={classes.root}>
      <PanelToolbar floating helpContent={helpContent} additionalIcons={topicToRenderMenu}>
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
              placeholder={selectedDisplayName}
            />
          )}
        />
      </PanelToolbar>
      {filteredDiagnostics.length > 0 ? (
        <div className={classes.content}>
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
              saveConfig={saveConfig}
              collapsedSections={collapsedSections}
            />
          ))}
        </div>
      ) : selectedDisplayName ? (
        <EmptyState>
          Waiting for diagnostics from <code>{selectedDisplayName}</code>
        </EmptyState>
      ) : (
        <EmptyState>No diagnostic node selected</EmptyState>
      )}
    </div>
  );
}

const defaultConfig: Config = { topicToRender: DIAGNOSTIC_TOPIC, collapsedSections: [] };

export default Panel(
  Object.assign(DiagnosticStatusPanel, {
    panelType: "DiagnosticStatusPanel",
    defaultConfig,
  }),
);

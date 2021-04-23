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

import { sortBy } from "lodash";
import { useCallback } from "react";

import { useDataSourceInfo } from "@foxglove-studio/app/PanelAPI";
import Autocomplete from "@foxglove-studio/app/components/Autocomplete";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Flex from "@foxglove-studio/app/components/Flex";
import Panel from "@foxglove-studio/app/components/Panel";
import { usePanelContext } from "@foxglove-studio/app/components/PanelContext";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { DIAGNOSTIC_TOPIC } from "@foxglove-studio/app/util/globalConstants";

import DiagnosticStatus from "./DiagnosticStatus";
import helpContent from "./DiagnosticStatusPanel.help.md";
import DiagnosticsHistory, { DiagnosticAutocompleteEntry } from "./DiagnosticsHistory";
import { DiagnosticInfo, getDisplayName, trimHardwareId } from "./util";

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
// component to display a single diagnostic status from list
function DiagnosticStatusPanel(props: Props) {
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

  const onSelect = useCallback(
    (
      value: string,
      entry: DiagnosticAutocompleteEntry,
      autocomplete: Autocomplete<DiagnosticAutocompleteEntry>,
    ) => {
      const hasNewHardwareId = config.selectedHardwareId !== entry.hardware_id;
      const hasNewName = config.selectedName !== entry.name;
      saveConfig({
        selectedHardwareId: entry.hardware_id,
        selectedName: entry.name,
        collapsedSections: hasNewHardwareId || hasNewName ? [] : config.collapsedSections,
      });
      autocomplete.blur();
    },
    [config, saveConfig],
  );

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={topicToRender}
      onChange={(newTopicToRender) => saveConfig({ topicToRender: newTopicToRender })}
      topics={topics}
      singleTopicDatatype={"diagnostic_msgs/DiagnosticArray"}
      defaultTopicToRender={DIAGNOSTIC_TOPIC}
    />
  );

  const selectedDisplayName =
    selectedHardwareId != undefined
      ? getDisplayName(selectedHardwareId, selectedName ?? "")
      : undefined;
  return (
    <Flex scroll scrollX col>
      <DiagnosticsHistory topic={topicToRender}>
        {(buffer) => {
          let selectedItem; // selected by name+hardware_id
          let selectedItems: DiagnosticInfo[] | undefined; // [selectedItem], or all diagnostics with selectedHardwareId if no name is selected
          if (selectedHardwareId != undefined) {
            const items = [];
            const diagnosticsByName = buffer.diagnosticsByNameByTrimmedHardwareId.get(
              trimHardwareId(selectedHardwareId),
            );
            if (diagnosticsByName != undefined) {
              for (const diagnostic of diagnosticsByName.values()) {
                if (selectedName == undefined || selectedName === diagnostic.status.name) {
                  items.push(diagnostic);
                  if (selectedName != undefined) {
                    selectedItem = diagnostic;
                  }
                }
              }
            }
            selectedItems = items;
          }

          return (
            <>
              <PanelToolbar floating helpContent={helpContent} additionalIcons={topicToRenderMenu}>
                <Autocomplete
                  placeholder={selectedDisplayName ?? "Select a diagnostic"}
                  items={buffer.sortedAutocompleteEntries}
                  getItemText={(entry) => entry.displayName}
                  getItemValue={(entry) => entry.id}
                  onSelect={onSelect}
                  selectedItem={selectedItem as any}
                  inputStyle={{ height: "100%" }}
                />
              </PanelToolbar>
              {selectedItems?.length ? (
                <Flex col scroll>
                  {sortBy(selectedItems, ({ status }) => status.name.toLowerCase()).map((item) => (
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
                </Flex>
              ) : selectedDisplayName ? (
                <EmptyState>
                  Waiting for diagnostics from <code>{selectedDisplayName}</code>
                </EmptyState>
              ) : (
                <EmptyState>No diagnostic node selected</EmptyState>
              )}
            </>
          );
        }}
      </DiagnosticsHistory>
    </Flex>
  );
}

export default Panel(
  Object.assign(DiagnosticStatusPanel, {
    panelType: "DiagnosticStatusPanel",
    defaultConfig: { topicToRender: DIAGNOSTIC_TOPIC, collapsedSections: [] },
    supportsStrictMode: false,
  }),
);

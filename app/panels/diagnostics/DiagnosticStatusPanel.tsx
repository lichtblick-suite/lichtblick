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
import * as React from "react";
import { $Shape } from "utility-types";

import DiagnosticStatus from "./DiagnosticStatus";
import helpContent from "./DiagnosticStatusPanel.help.md";
import DiagnosticsHistory, { DiagnosticAutocompleteEntry } from "./DiagnosticsHistory";
import { getDisplayName, trimHardwareId } from "./util";
import Autocomplete from "@foxglove-studio/app/components/Autocomplete";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Flex from "@foxglove-studio/app/components/Flex";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { Topic } from "@foxglove-studio/app/players/types";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import { DIAGNOSTIC_TOPIC } from "@foxglove-studio/app/util/globalConstants";

export type Config = {
  selectedHardwareId?: string | null | undefined;
  selectedName?: string | null | undefined;
  splitFraction?: number;
  topicToRender: string;
  collapsedSections: { name: string; section: string }[];
};

type Props = {
  config: Config;
  saveConfig: (arg0: $Shape<Config>) => void;
  topics: Topic[];
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
};
// component to display a single diagnostic status from list
class DiagnosticStatusPanel extends React.Component<Props> {
  static panelType = "DiagnosticStatusPanel";
  static defaultConfig: Config = { topicToRender: DIAGNOSTIC_TOPIC, collapsedSections: [] };

  _onSelect = (value: string, entry: DiagnosticAutocompleteEntry, autocomplete: Autocomplete) => {
    const { saveConfig, config } = this.props;
    const hasNewHardwareId = config.selectedHardwareId !== entry.hardware_id;
    const hasNewName = config.selectedName !== entry.name;
    saveConfig({
      selectedHardwareId: entry.hardware_id,
      selectedName: entry.name,
      collapsedSections: hasNewHardwareId || hasNewName ? [] : config.collapsedSections,
    });
    autocomplete.blur();
  };

  renderTopicToRenderMenu = (topics: any) => {
    const {
      config: { topicToRender },
      saveConfig,
    } = this.props;
    return (
      <TopicToRenderMenu
        topicToRender={topicToRender}
        onChange={(newTopicToRender) => saveConfig({ topicToRender: newTopicToRender })}
        topics={topics}
        singleTopicDatatype={"diagnostic_msgs/DiagnosticArray"}
        defaultTopicToRender={DIAGNOSTIC_TOPIC}
      />
    );
  };

  render() {
    const { openSiblingPanel, config, saveConfig } = this.props;
    const {
      selectedHardwareId,
      selectedName,
      splitFraction,
      topicToRender,
      collapsedSections = [],
    } = config;

    const selectedDisplayName =
      selectedHardwareId != null ? getDisplayName(selectedHardwareId, selectedName || "") : null;
    return (
      <Flex scroll scrollX col>
        <DiagnosticsHistory topic={topicToRender}>
          {(buffer) => {
            let selectedItem; // selected by name+hardware_id
            let selectedItems; // [selectedItem], or all diagnostics with selectedHardwareId if no name is selected
            if (selectedHardwareId != null) {
              const items = [];
              const diagnosticsByName = buffer.diagnosticsByNameByTrimmedHardwareId.get(
                trimHardwareId(selectedHardwareId),
              );
              if (diagnosticsByName != null) {
                for (const diagnostic of diagnosticsByName.values()) {
                  if (selectedName == null || selectedName === diagnostic.status.name) {
                    items.push(diagnostic);
                    if (selectedName != null) {
                      selectedItem = diagnostic;
                    }
                  }
                }
              }
              selectedItems = items;
            }

            return (
              <>
                <PanelToolbar
                  floating
                  helpContent={helpContent}
                  additionalIcons={this.renderTopicToRenderMenu(this.props.topics)}
                >
                  <Autocomplete
                    placeholder={selectedDisplayName ?? "Select a diagnostic"}
                    items={buffer.sortedAutocompleteEntries}
                    getItemText={(entry) => (entry as any).displayName}
                    getItemValue={(entry) => (entry as any).id}
                    onSelect={this._onSelect as any}
                    selectedItem={selectedItem}
                    inputStyle={{ height: "100%" }}
                  />
                </PanelToolbar>
                {selectedItems && selectedItems.length ? (
                  <Flex col scroll>
                    {sortBy(selectedItems, ({ status }) => status.name.toLowerCase()).map(
                      (item) => (
                        <DiagnosticStatus
                          key={item.id}
                          info={item}
                          splitFraction={splitFraction}
                          onChangeSplitFraction={(newSplitFraction) =>
                            this.props.saveConfig({ splitFraction: newSplitFraction })
                          }
                          topicToRender={topicToRender}
                          openSiblingPanel={openSiblingPanel}
                          saveConfig={saveConfig}
                          collapsedSections={collapsedSections}
                        />
                      ),
                    )}
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
}

export default Panel<Config>(DiagnosticStatusPanel as any);

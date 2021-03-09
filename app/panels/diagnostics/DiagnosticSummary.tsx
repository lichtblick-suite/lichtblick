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

import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import PinIcon from "@mdi/svg/svg/pin.svg";
import cx from "classnames";
import { compact } from "lodash";
import * as React from "react";
import { List, AutoSizer } from "react-virtualized";
import { $Shape } from "utility-types";

import { Config as DiagnosticStatusConfig } from "./DiagnosticStatusPanel";
import helpContent from "./DiagnosticSummary.help.md";
import styles from "./DiagnosticSummary.module.scss";
import {
  LEVELS,
  DiagnosticId,
  DiagnosticInfo,
  getDiagnosticsByLevel,
  getSortedDiagnostics,
} from "./util";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import { Item } from "@foxglove-studio/app/components/Menu";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import DiagnosticsHistory from "@foxglove-studio/app/panels/diagnostics/DiagnosticsHistory";
import { Topic } from "@foxglove-studio/app/players/types";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import filterMap from "@foxglove-studio/app/util/filterMap";
import { DIAGNOSTIC_TOPIC } from "@foxglove-studio/app/util/globalConstants";
import toggle from "@foxglove-studio/app/util/toggle";

const LevelClasses = {
  [LEVELS.OK]: styles.ok,
  [LEVELS.WARN]: styles.warn,
  [LEVELS.ERROR]: styles.error,
  [LEVELS.STALE]: styles.stale,
};

type NodeRowProps = {
  info: DiagnosticInfo;
  isPinned: boolean;
  onClick: (info: DiagnosticInfo) => void;
  onClickPin: (info: DiagnosticInfo) => void;
};
class NodeRow extends React.PureComponent<NodeRowProps> {
  onClick = () => {
    const { info, onClick } = this.props;
    onClick(info);
  };
  onClickPin = () => {
    const { info, onClickPin } = this.props;
    onClickPin(info);
  };

  render() {
    const { info, isPinned } = this.props;

    return (
      <div
        className={cx(LevelClasses[info.status.level], styles.nodeRow)}
        onClick={this.onClick}
        data-test-diagnostic-row
      >
        <Icon
          fade={!isPinned}
          onClick={this.onClickPin}
          className={cx(styles.pinIcon, { [styles.pinned]: isPinned })}
        >
          <PinIcon />
        </Icon>
        <span>{info.displayName}</span> &ndash;{" "}
        <span className={styles.message}>{info.status.message}</span>
      </div>
    );
  }
}

type Config = {
  pinnedIds: DiagnosticId[];
  topicToRender: string;
  hardwareIdFilter: string;
  sortByLevel?: boolean;
};
type Props = {
  config: Config;
  saveConfig: (arg0: $Shape<Config>) => void;
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
  topics: Topic[];
};

class DiagnosticSummary extends React.Component<Props> {
  static panelType = "DiagnosticSummary";
  static defaultConfig = {
    ...(getGlobalHooks() as any).perPanelHooks().DiagnosticSummary.defaultConfig,
  };

  togglePinned = (info: DiagnosticInfo) => {
    this.props.saveConfig({ pinnedIds: toggle(this.props.config.pinnedIds, info.id) });
  };

  showDetails = (info: DiagnosticInfo) => {
    this.props.openSiblingPanel(
      "DiagnosticStatusPanel",
      () =>
        ({
          selectedHardwareId: info.status.hardware_id,
          selectedName: info.status.name,
          topicToRender: this.props.config.topicToRender,
          collapsedSections: [],
        } as DiagnosticStatusConfig),
    );
  };

  renderRow = ({ item, style, key }: any) => {
    return (
      <div key={key} style={style}>
        <NodeRow
          info={item}
          isPinned={this.props.config.pinnedIds.indexOf(item.id) !== -1}
          onClick={this.showDetails}
          onClickPin={this.togglePinned}
        />
      </div>
    );
  };

  renderHardwareFilter() {
    const {
      config: { hardwareIdFilter },
      saveConfig,
    } = this.props;
    return (
      <input
        style={{ width: "100%", padding: "0", background: "transparent", opacity: "0.5" }}
        value={hardwareIdFilter}
        placeholder={"Filter hardware id"}
        onChange={(e) => saveConfig({ hardwareIdFilter: e.target.value })}
      />
    );
  }

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

  _renderMenuContent() {
    const { config, saveConfig } = this.props;
    const { sortByLevel = true } = config;

    return (
      <Item
        icon={sortByLevel ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
        onClick={() => saveConfig({ sortByLevel: !sortByLevel })}
      >
        Sort by level
      </Item>
    );
  }

  render() {
    const {
      config: { topicToRender },
      topics,
    } = this.props;
    return (
      <Flex col className={styles.panel}>
        <PanelToolbar
          helpContent={helpContent}
          additionalIcons={this.renderTopicToRenderMenu(topics)}
          menuContent={this._renderMenuContent()}
        >
          {this.renderHardwareFilter()}
        </PanelToolbar>
        <Flex col>
          <DiagnosticsHistory topic={topicToRender}>
            {(buffer) => {
              if (buffer.diagnosticsByNameByTrimmedHardwareId.size === 0) {
                return (
                  <EmptyState>
                    Waiting for <code>{topicToRender}</code> messages
                  </EmptyState>
                );
              }
              const { pinnedIds, hardwareIdFilter, sortByLevel = true } = this.props.config;
              const pinnedNodes = filterMap(pinnedIds, (id) => {
                const [_, trimmedHardwareId, name] = id.split("|");
                const diagnosticsByName = buffer.diagnosticsByNameByTrimmedHardwareId.get(
                  trimmedHardwareId,
                );
                if (diagnosticsByName == null) {
                  return;
                }
                return diagnosticsByName.get(name);
              });

              const nodesByLevel = getDiagnosticsByLevel(buffer);
              const sortedNodes = sortByLevel
                ? [].concat(
                    ...([LEVELS.STALE, LEVELS.ERROR, LEVELS.WARN, LEVELS.OK].map((level) =>
                      getSortedDiagnostics(nodesByLevel[level], hardwareIdFilter, pinnedIds),
                    ) as any),
                  )
                : getSortedDiagnostics(
                    [].concat(
                      ...([LEVELS.STALE, LEVELS.ERROR, LEVELS.WARN, LEVELS.OK].map(
                        (level) => nodesByLevel[level],
                      ) as any),
                    ),
                    hardwareIdFilter,
                    pinnedIds,
                  );

              const nodes: DiagnosticInfo[] = [...compact(pinnedNodes), ...sortedNodes];
              return !nodes.length ? null : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      width={width}
                      height={height}
                      style={{ outline: "none" }}
                      rowHeight={25}
                      rowRenderer={(rowProps) =>
                        this.renderRow({ ...rowProps, item: nodes[rowProps.index] })
                      }
                      rowCount={nodes.length}
                      overscanRowCount={10}
                    />
                  )}
                </AutoSizer>
              );
            }}
          </DiagnosticsHistory>
        </Flex>
      </Flex>
    );
  }
}

export default Panel<Config>(DiagnosticSummary as any);

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

import PinIcon from "@mdi/svg/svg/pin.svg";
import cx from "classnames";
import { compact } from "lodash";
import { useCallback, useMemo } from "react";
import { List, AutoSizer, ListRowProps } from "react-virtualized";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import { PanelConfigSchema } from "@foxglove/studio-base/types/panels";
import filterMap from "@foxglove/studio-base/util/filterMap";
import { DIAGNOSTIC_TOPIC } from "@foxglove/studio-base/util/globalConstants";
import toggle from "@foxglove/studio-base/util/toggle";

import { Config as DiagnosticStatusConfig } from "./DiagnosticStatusPanel";
import helpContent from "./DiagnosticSummary.help.md";
import styles from "./DiagnosticSummary.module.scss";
import useDiagnostics from "./useDiagnostics";
import {
  DiagnosticId,
  DiagnosticInfo,
  getDiagnosticsByLevel,
  filterAndSortDiagnostics,
  LEVEL_NAMES,
} from "./util";

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

  override render() {
    const { info, isPinned } = this.props;
    const levelName = LEVEL_NAMES[info.status.level];

    return (
      <div
        className={cx(levelName != undefined ? styles[levelName] : undefined, styles.nodeRow)}
        onClick={this.onClick}
        data-test-diagnostic-row
      >
        <Icon
          fade={!isPinned}
          onClick={this.onClickPin}
          className={cx(styles.pinIcon, { [styles.pinned!]: isPinned })}
        >
          <PinIcon />
        </Icon>
        <span>{info.displayName}</span>
        {" – "}
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
  saveConfig: (arg0: Partial<Config>) => void;
};

function DiagnosticSummary(props: Props): JSX.Element {
  const { config, saveConfig } = props;
  const { topics } = useDataSourceInfo();
  const { topicToRender, pinnedIds, hardwareIdFilter, sortByLevel = true } = config;
  const { openSiblingPanel } = usePanelContext();

  const togglePinned = useCallback(
    (info: DiagnosticInfo) => {
      saveConfig({ pinnedIds: toggle(pinnedIds, info.id) });
    },
    [pinnedIds, saveConfig],
  );

  const showDetails = useCallback(
    (info: DiagnosticInfo) => {
      openSiblingPanel(
        "DiagnosticStatusPanel",
        () =>
          ({
            selectedHardwareId: info.status.hardware_id,
            selectedName: info.status.name,
            topicToRender,
            collapsedSections: [],
          } as DiagnosticStatusConfig),
      );
    },
    [topicToRender, openSiblingPanel],
  );

  const renderRow = useCallback(
    // eslint-disable-next-line react/no-unused-prop-types
    ({ item, style, key }: ListRowProps & { item: DiagnosticInfo }) => {
      return (
        <div key={key} style={style}>
          <NodeRow
            info={item}
            isPinned={pinnedIds.includes(item.id)}
            onClick={showDetails}
            onClickPin={togglePinned}
          />
        </div>
      );
    },
    [pinnedIds, showDetails, togglePinned],
  );

  const hardwareFilter = (
    <input
      style={{ width: "100%", padding: "0", background: "transparent", opacity: "0.5" }}
      value={hardwareIdFilter}
      placeholder={"Filter hardware id"}
      onChange={(e) => saveConfig({ hardwareIdFilter: e.target.value })}
    />
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

  const diagnostics = useDiagnostics(topicToRender);
  const summary = useMemo(() => {
    if (diagnostics.diagnosticsByNameByTrimmedHardwareId.size === 0) {
      return (
        <EmptyState>
          Waiting for <code>{topicToRender}</code> messages
        </EmptyState>
      );
    }
    const pinnedNodes = filterMap(pinnedIds, (id) => {
      const [_, trimmedHardwareId, name] = id.split("|");
      if (name == undefined || trimmedHardwareId == undefined) {
        return;
      }
      const diagnosticsByName =
        diagnostics.diagnosticsByNameByTrimmedHardwareId.get(trimmedHardwareId);
      return diagnosticsByName?.get(name);
    });

    const nodesByLevel = getDiagnosticsByLevel(diagnostics);
    const levels = Array.from(nodesByLevel.keys()).sort().reverse();
    const sortedNodes = sortByLevel
      ? ([] as DiagnosticInfo[]).concat(
          ...levels.map((level) =>
            filterAndSortDiagnostics(nodesByLevel.get(level) ?? [], hardwareIdFilter, pinnedIds),
          ),
        )
      : filterAndSortDiagnostics(
          ([] as DiagnosticInfo[]).concat(...nodesByLevel.values()),
          hardwareIdFilter,
          pinnedIds,
        );

    const nodes: DiagnosticInfo[] = [...compact(pinnedNodes), ...sortedNodes];
    if (nodes.length === 0) {
      return ReactNull;
    }
    return (
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            style={{ outline: "none" }}
            rowHeight={25}
            rowRenderer={(rowProps) => renderRow({ ...rowProps, item: nodes[rowProps.index]! })}
            rowCount={nodes.length}
            overscanRowCount={10}
          />
        )}
      </AutoSizer>
    );
  }, [diagnostics, hardwareIdFilter, pinnedIds, renderRow, sortByLevel, topicToRender]);

  return (
    <Flex col className={styles.panel}>
      <PanelToolbar helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        {hardwareFilter}
      </PanelToolbar>
      <Flex col>{summary}</Flex>
    </Flex>
  );
}

const configSchema: PanelConfigSchema<Config> = [
  { key: "sortByLevel", type: "toggle", title: "Sort by level" },
];

export default Panel(
  Object.assign(DiagnosticSummary, {
    panelType: "DiagnosticSummary",
    defaultConfig: {
      pinnedIds: [],
      hardwareIdFilter: "",
      topicToRender: DIAGNOSTIC_TOPIC,
      sortByLevel: true,
    },
    supportsStrictMode: false,
    configSchema,
  }),
);

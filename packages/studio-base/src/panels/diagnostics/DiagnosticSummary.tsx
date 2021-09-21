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

import { mergeStyleSets } from "@fluentui/merge-styles";
import { Dropdown, IDropdownOption, ISelectableOption } from "@fluentui/react";
import PinIcon from "@mdi/svg/svg/pin.svg";
import cx from "classnames";
import { compact } from "lodash";
import { useCallback, useMemo } from "react";
import { List, AutoSizer, ListRowProps } from "react-virtualized";

import { filterMap } from "@foxglove/den/collection";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import { Config as DiagnosticStatusConfig } from "@foxglove/studio-base/panels/diagnostics/DiagnosticStatusPanel";
import helpContent from "@foxglove/studio-base/panels/diagnostics/DiagnosticSummary.help.md";
import useDiagnostics from "@foxglove/studio-base/panels/diagnostics/useDiagnostics";
import { PanelConfigSchema } from "@foxglove/studio-base/types/panels";
import { DIAGNOSTIC_TOPIC } from "@foxglove/studio-base/util/globalConstants";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import toggle from "@foxglove/studio-base/util/toggle";

import {
  DiagnosticId,
  DiagnosticInfo,
  getDiagnosticsByLevel,
  filterAndSortDiagnostics,
  LEVEL_NAMES,
  KNOWN_LEVELS,
} from "./util";

type NodeRowProps = {
  info: DiagnosticInfo;
  isPinned: boolean;
  onClick: (info: DiagnosticInfo) => void;
  onClickPin: (info: DiagnosticInfo) => void;
};

const classes = mergeStyleSets({
  panel: {
    backgroundColor: colors.DARK,
  },
  ok: {
    color: colors.GREEN2,
  },
  warn: {
    color: colors.ORANGE2,
  },
  error: {
    color: colors.RED2,
  },
  stale: {
    color: colors.TEXT_MUTED,
  },
  pinIcon: {
    marginRight: 4,
    marginLeft: 4,
    verticalAlign: "middle",
    visibility: "hidden",

    svg: {
      fontSize: 16,
      position: "relative",
      top: -1,
    },
  },
  pinIconActive: {
    visibility: "visible",
  },
  nodeRow: {
    textDecoration: "none",
    cursor: "pointer",
    color: colors.TEXT_CONTROL,
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    padding: 0,
    lineHeight: "24px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",

    "&:hover": {
      color: "white",
      backgroundColor: colors.DARK5,

      "> .icon": {
        visibility: "visible",
      },
    },
  },
});

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
      <div className={classes.nodeRow} onClick={this.onClick} data-test-diagnostic-row>
        <Icon
          fade={!isPinned}
          onClick={this.onClickPin}
          className={cx(classes.pinIcon, {
            [classes.pinIconActive]: isPinned,
          })}
        >
          <PinIcon />
        </Icon>
        <div>{info.displayName}</div>
        &nbsp;–&nbsp;
        <div
          className={cx({
            [classes.ok]: levelName === "ok",
            [classes.warn]: levelName === "warn",
            [classes.error]: levelName === "error",
            [classes.stale]: levelName === "stale",
          })}
        >
          {info.status.message}
        </div>
      </div>
    );
  }
}

type Config = {
  minLevel: number;
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
  const { minLevel, topicToRender, pinnedIds, hardwareIdFilter, sortByLevel = true } = config;
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
    <LegacyInput
      style={{
        width: "100%",
        padding: "0",
        backgroundColor: "transparent",
        opacity: "0.5",
        marginLeft: "10px",
        fontSize: "14px",
      }}
      value={hardwareIdFilter}
      placeholder="Filter hardware id"
      onChange={(e) => saveConfig({ hardwareIdFilter: e.target.value })}
    />
  );

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={topicToRender}
      onChange={(newTopicToRender) => saveConfig({ topicToRender: newTopicToRender })}
      topics={topics}
      allowedDatatypes={["diagnostic_msgs/DiagnosticArray", "diagnostic_msgs/msg/DiagnosticArray"]}
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

    const nodes: DiagnosticInfo[] = [...compact(pinnedNodes), ...sortedNodes].filter(
      ({ status }) => status.level >= minLevel,
    );
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
  }, [diagnostics, hardwareIdFilter, pinnedIds, renderRow, sortByLevel, minLevel, topicToRender]);

  const renderOption = (option: ISelectableOption | undefined) =>
    option ? (
      <div
        className={cx({
          [classes.ok]: option.text === "ok",
          [classes.warn]: option.text === "warn",
          [classes.error]: option.text === "error",
          [classes.stale]: option.text === "stale",
        })}
      >
        &gt;= {option?.text.toUpperCase() ?? ""}
      </div>
    ) : (
      ReactNull
    );

  return (
    <Flex col className={classes.panel}>
      <PanelToolbar helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        <Dropdown
          styles={{
            root: { minWidth: "100px" },
            title: { backgroundColor: "transparent" },
          }}
          onRenderOption={renderOption}
          onRenderTitle={(option: IDropdownOption[] | undefined) =>
            option ? <>{option.map(renderOption)}</> : ReactNull
          }
          onChange={(_ev, option) => {
            if (option) {
              saveConfig({ minLevel: option.key as number });
            }
          }}
          options={KNOWN_LEVELS.map((key: number) => ({ key, text: LEVEL_NAMES[key] ?? "" }))}
          selectedKey={minLevel}
        />
        {hardwareFilter}
      </PanelToolbar>
      <Flex col>{summary}</Flex>
    </Flex>
  );
}

const configSchema: PanelConfigSchema<Config> = [
  { key: "sortByLevel", type: "toggle", title: "Sort by level" },
];

const defaultConfig: Config = {
  minLevel: 0,
  pinnedIds: [],
  hardwareIdFilter: "",
  topicToRender: DIAGNOSTIC_TOPIC,
  sortByLevel: true,
};
export default Panel(
  Object.assign(DiagnosticSummary, {
    panelType: "DiagnosticSummary",
    defaultConfig,
    supportsStrictMode: false,
    configSchema,
  }),
);

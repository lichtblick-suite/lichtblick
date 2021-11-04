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

import {
  Dropdown,
  IDropdownOption,
  IDropdownStyles,
  ISelectableOption,
  makeStyles,
  useTheme,
} from "@fluentui/react";
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

const useStyles = makeStyles((theme) => ({
  ok: { color: theme.semanticColors.successIcon },
  warn: { color: theme.semanticColors.warningBackground },
  error: { color: theme.semanticColors.errorBackground },
  stale: { color: theme.semanticColors.infoIcon },
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
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    padding: 0,
    lineHeight: "24px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",

    "&:hover": {
      backgroundColor: theme.semanticColors.listItemBackgroundHovered,

      "> .icon": {
        visibility: "visible",
      },
    },
  },
}));

const NodeRow = React.memo(function NodeRow(props: NodeRowProps) {
  const handleClick = useCallback(() => {
    const info = props.info;
    const onClick = props.onClick;
    onClick(info);
  }, [props.onClick, props.info]);
  const handleClickPin = useCallback(() => {
    const info = props.info;
    const onClickPin = props.onClickPin;
    onClickPin(info);
  }, [props.onClickPin, props.info]);

  const { info, isPinned } = props;
  const levelName = LEVEL_NAMES[info.status.level];
  const classes = useStyles();
  return (
    <div className={classes.nodeRow} onClick={handleClick} data-test-diagnostic-row>
      <Icon
        fade={!isPinned}
        onClick={handleClickPin}
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
});

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
  const theme = useTheme();
  const classes = useStyles();
  const dropdownStyles = useMemo(
    () =>
      ({
        root: {
          minWidth: "100px",
        },
        caretDownWrapper: {
          top: 0,
          lineHeight: 24,
          height: 24,
        },
        title: {
          backgroundColor: "transparent",
          fontSize: theme.fonts.small.fontSize,
          borderColor: theme.semanticColors.bodyDivider,
          lineHeight: 24,
          height: 24,
        },
        dropdownItemSelected: {
          fontSize: theme.fonts.small.fontSize,
          lineHeight: 24,
          height: 24,
          minHeight: 24,
        },
        dropdownItem: {
          lineHeight: 24,
          height: 24,
          minHeight: 24,
          fontSize: theme.fonts.small.fontSize,
        },
      } as Partial<IDropdownStyles>),
    [theme],
  );
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
      openSiblingPanel({
        panelType: "DiagnosticStatusPanel",
        siblingConfigCreator: () =>
          ({
            selectedHardwareId: info.status.hardware_id,
            selectedName: info.status.name,
            topicToRender,
            collapsedSections: [],
          } as DiagnosticStatusConfig),
        updateIfExists: true,
      });
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
        fontSize: "12px",
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
    <Flex col>
      <PanelToolbar helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        <Dropdown
          styles={dropdownStyles}
          onRenderOption={renderOption}
          onRenderTitle={(options: IDropdownOption[] | undefined) =>
            options?.[0] ? renderOption(options[0]) : ReactNull
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

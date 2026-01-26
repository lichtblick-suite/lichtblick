// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { InputBase, MenuItem, Select, Typography } from "@mui/material";
import { produce } from "immer";
import * as _ from "lodash-es";
import { CSSProperties, useCallback, useEffect, useMemo } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";

import { filterMap } from "@lichtblick/den/collection";
import { SettingsTreeAction } from "@lichtblick/suite";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import {
  DiagnosticInfo,
  DiagnosticStatusConfig,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import DiagnosticNodeRow from "@lichtblick/suite-base/panels/DiagnosticSummary/DiagnosticNodeRow";
import { useStyles } from "@lichtblick/suite-base/panels/DiagnosticSummary/DiagnosticSummary.style";
import {
  ALLOWED_DATATYPES,
  DEFAULT_SECONDS_UNTIL_STALE,
  KNOWN_LEVELS,
  LEVEL_NAMES,
  MESSAGE_COLORS,
} from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import useDiagnostics from "@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics";
import useStaleTime from "@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useStaleTime";
import {
  DiagnosticSummaryConfig,
  DiagnosticSummaryProps,
} from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import { getDiagnosticsWithStales } from "@lichtblick/suite-base/panels/DiagnosticSummary/utils/getDiagnosticsWithStales";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import toggle from "@lichtblick/suite-base/util/toggle";

import { buildSettingsTree } from "./utils/buildSettingsTree";
import { filterAndSortDiagnostics, getDiagnosticsByLevel } from "./utils/util";

const DiagnosticSummary = (props: DiagnosticSummaryProps): React.JSX.Element => {
  const { config, saveConfig } = props;
  const { classes } = useStyles();
  const { topics } = useDataSourceInfo();
  const {
    minLevel,
    topicToRender,
    pinnedIds,
    hardwareIdFilter,
    sortByLevel = true,
    secondsUntilStale = DEFAULT_SECONDS_UNTIL_STALE,
  } = config;
  const { openSiblingPanel } = usePanelContext();
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const staleTime = useStaleTime(secondsUntilStale);

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
          }) as DiagnosticStatusConfig,
        updateIfExists: true,
      });
    },
    [topicToRender, openSiblingPanel],
  );

  const renderRow = useCallback(
    (renderProps: { data: DiagnosticInfo[]; index: number; style: CSSProperties }) => {
      const item = renderProps.data[renderProps.index]!;
      return (
        <div
          style={{ ...renderProps.style }}
          data-testid={`diagnostic-summary-node-row-${renderProps.index}`}
        >
          <DiagnosticNodeRow
            key={item.id}
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

  // Filter down all topics to those that conform to our supported datatypes
  const availableTopics = useMemo(() => {
    const filtered = topics
      .filter(
        (topic) => topic.schemaName != undefined && ALLOWED_DATATYPES.includes(topic.schemaName),
      )
      .map((topic) => topic.name);

    // Keeps only the first occurrence of each topic.
    return _.uniq([...filtered]);
  }, [topics]);

  // If the topicToRender is not in the availableTopics, then we should not try to use it
  const diagnosticTopic = useMemo(() => {
    return availableTopics.includes(topicToRender) ? topicToRender : undefined;
  }, [availableTopics, topicToRender]);

  const diagnostics = useDiagnostics(diagnosticTopic);

  const diagnosticsWithOldMarkedAsStales = useMemo(() => {
    return staleTime ? getDiagnosticsWithStales(diagnostics, staleTime) : diagnostics;
  }, [diagnostics, staleTime]);

  const summary = useMemo(() => {
    if (diagnosticsWithOldMarkedAsStales.size === 0) {
      return (
        <EmptyState>
          Waiting for <code>{topicToRender}</code> messages
        </EmptyState>
      );
    }
    const pinnedNodes = filterMap(pinnedIds, (id) => {
      const [, trimmedHardwareId, name] = id.split("|");
      if (name == undefined || trimmedHardwareId == undefined) {
        return;
      }
      const diagnosticsByName = diagnosticsWithOldMarkedAsStales.get(trimmedHardwareId);
      return diagnosticsByName?.get(name);
    });

    const nodesByLevel = getDiagnosticsByLevel(diagnosticsWithOldMarkedAsStales);
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

    const nodes: DiagnosticInfo[] = [..._.compact(pinnedNodes), ...sortedNodes].filter(
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
            itemSize={30}
            itemData={nodes}
            itemCount={nodes.length}
            overscanCount={10}
          >
            {renderRow}
          </List>
        )}
      </AutoSizer>
    );
  }, [
    diagnosticsWithOldMarkedAsStales,
    hardwareIdFilter,
    pinnedIds,
    renderRow,
    sortByLevel,
    minLevel,
    topicToRender,
  ]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      saveConfig(produce<DiagnosticSummaryConfig>((draft) => _.set(draft, path.slice(1), value)));
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree({ config, topicToRender, availableTopics }),
    });
  }, [actionHandler, availableTopics, config, topicToRender, updatePanelSettingsTree]);

  return (
    <Stack flex="auto">
      <PanelToolbar>
        <Stack flex="auto" direction="row" gap={1}>
          <Select
            className={classes.select}
            value={minLevel}
            id="status-filter-menu"
            color="secondary"
            size="small"
            onChange={(event) => {
              saveConfig({ minLevel: event.target.value });
            }}
            MenuProps={{ MenuListProps: { dense: true } }}
          >
            {KNOWN_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                <Typography variant="inherit" color={MESSAGE_COLORS[level]}>
                  {LEVEL_NAMES[level]?.toUpperCase()}
                </Typography>
              </MenuItem>
            ))}
          </Select>
          <InputBase
            value={hardwareIdFilter}
            placeholder="Filter"
            onChange={(e) => {
              saveConfig({ hardwareIdFilter: e.target.value });
            }}
            style={{ flex: "auto", font: "inherit" }}
          />
        </Stack>
      </PanelToolbar>
      <Stack flex="auto">{summary}</Stack>
    </Stack>
  );
};

export default DiagnosticSummary;

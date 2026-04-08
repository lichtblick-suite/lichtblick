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

import { useCallback, useMemo, useState } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { add as addTimes, fromSec } from "@lichtblick/rostime";
import useMessagesByPath from "@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import TimeBasedChart from "@lichtblick/suite-base/components/TimeBasedChart";
import { PathLegend } from "@lichtblick/suite-base/panels/StateTransitions/PathLegend";
import { useStateTransitionsStyles } from "@lichtblick/suite-base/panels/StateTransitions/StateTransitions.style";
import {
  EMPTY_ITEMS_BY_PATH,
  STATE_TRANSITION_PLUGINS,
} from "@lichtblick/suite-base/panels/StateTransitions/constants";
import useChartScalesAndBounds from "@lichtblick/suite-base/panels/StateTransitions/hooks/useChartScalesAndBounds";
import { useDecodedMessageRange } from "@lichtblick/suite-base/panels/StateTransitions/hooks/useDecodedMessageRange";
import useMessagePathDropConfig from "@lichtblick/suite-base/panels/StateTransitions/hooks/useMessagePathDropConfig";
import { usePanelSettings } from "@lichtblick/suite-base/panels/StateTransitions/hooks/usePanelSettings";
import useStateTransitionsData from "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsData";
import useStateTransitionsTime from "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsTime";
import { OnClickArg as OnChartClickArgs } from "@lichtblick/suite-base/src/components/Chart";

import { StateTransitionConfig, StateTransitionPanelProps } from "./types";

function StateTransitions(props: StateTransitionPanelProps) {
  const { config, saveConfig } = props;
  const { paths } = config;
  const { classes } = useStateTransitionsStyles();

  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);

  useMessagePathDropConfig(saveConfig);

  const { startTime, currentTimeSinceStart, endTimeSinceStart } = useStateTransitionsTime();

  const { topics, pathStrings } = useMemo(() => {
    const newPathStrings = paths.map(({ value }) => value);
    const uniqueTopics = new Set<string>();

    for (const pathString of newPathStrings) {
      const parsed = parseMessagePath(pathString);
      if (parsed) {
        uniqueTopics.add(parsed.topicName);
      }
    }

    return {
      topics: [...uniqueTopics],
      pathStrings: newPathStrings,
    };
  }, [paths]);

  const decodedMessages = useDecodedMessageRange(topics, pathStrings);

  // When range data is active, skip useMessagesByPath subscriptions entirely
  // to avoid wasteful current-frame processing and decoding.
  const hasRangeData = useMemo(
    () =>
      decodedMessages.some((block) =>
        pathStrings.some((pathStr) => (block[pathStr]?.length ?? 0) > 0),
      ),
    [decodedMessages, pathStrings],
  );

  const itemsByPath = useMessagesByPath(hasRangeData ? [] : pathStrings);

  const { height, heightPerTopic } = useMemo(() => {
    const onlyTopicsHeight = paths.length * 64;
    const xAxisHeight = 30;
    return {
      height: Math.max(80, onlyTopicsHeight + xAxisHeight),
      heightPerTopic: paths.length === 0 ? 0 : onlyTopicsHeight / paths.length,
    };
  }, [paths.length]);

  const newItemsByPath = hasRangeData ? EMPTY_ITEMS_BY_PATH : itemsByPath;

  const showPoints = config.showPoints === true;

  const { pathState, data, minY } = useStateTransitionsData(
    paths,
    startTime,
    newItemsByPath,
    decodedMessages,
    showPoints,
  );

  const { yScale, xScale, databounds, width, sizeRef } = useChartScalesAndBounds(
    minY,
    currentTimeSinceStart,
    endTimeSinceStart,
    config,
  );

  const messagePipeline = useMessagePipelineGetter();

  const onClick = useCallback(
    ({ x: seekSeconds }: OnChartClickArgs) => {
      const {
        seekPlayback,
        playerState: { activeData: { startTime: start } = {} },
      } = messagePipeline();
      if (!seekPlayback || seekSeconds == undefined || start == undefined) {
        return;
      }
      const seekTime = addTimes(start, fromSec(seekSeconds));
      seekPlayback(seekTime);
    },
    [messagePipeline],
  );

  usePanelSettings(config, saveConfig, pathState, focusedPath);

  return (
    <Stack flexGrow={1} overflow="hidden" style={{ zIndex: 0 }}>
      <PanelToolbar />
      <Stack fullWidth fullHeight flex="auto" overflowX="hidden" overflowY="auto">
        <div className={classes.chartWrapper} ref={sizeRef}>
          <TimeBasedChart
            zoom
            isSynced={config.isSynced}
            showXAxisLabels
            width={width ?? 0}
            height={height}
            data={data}
            dataBounds={databounds}
            resetButtonPaddingBottom={2}
            type="scatter"
            xAxes={xScale}
            xAxisIsPlaybackTime
            yAxes={yScale}
            plugins={STATE_TRANSITION_PLUGINS}
            interactionMode="lastX"
            onClick={onClick}
            currentTime={currentTimeSinceStart}
          />
          <PathLegend
            paths={paths}
            heightPerTopic={heightPerTopic}
            setFocusedPath={setFocusedPath}
            saveConfig={saveConfig}
          />
        </div>
      </Stack>
    </Stack>
  );
}

const defaultConfig: StateTransitionConfig = {
  paths: [],
  isSynced: true,
};

export default Panel(
  Object.assign(StateTransitions, {
    panelType: "StateTransitions",
    defaultConfig,
  }),
);

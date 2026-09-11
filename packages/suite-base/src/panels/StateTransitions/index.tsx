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

import { Ruler20Regular } from "@fluentui/react-icons";
import { alpha, useTheme } from "@mui/material";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseMessagePath } from "@lichtblick/message-path";
import { add as addTimes, fromSec } from "@lichtblick/rostime";
import KeyListener from "@lichtblick/suite-base/components/KeyListener";
import useMessagesByPath from "@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import ToolbarIconButton from "@lichtblick/suite-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import TimeBasedChart from "@lichtblick/suite-base/components/TimeBasedChart";
import { PathLegend } from "@lichtblick/suite-base/panels/StateTransitions/PathLegend";
import { useStateTransitionsStyles } from "@lichtblick/suite-base/panels/StateTransitions/StateTransitions.style";
import {
  EMPTY_ITEMS_BY_PATH,
  EMPTY_PATHS,
  EMPTY_TOPICS,
  STATE_TRANSITION_PLUGINS,
} from "@lichtblick/suite-base/panels/StateTransitions/constants";
import useChartScalesAndBounds from "@lichtblick/suite-base/panels/StateTransitions/hooks/useChartScalesAndBounds";
import { useDecodedMessageRange } from "@lichtblick/suite-base/panels/StateTransitions/hooks/useDecodedMessageRange";
import useMessagePathDropConfig from "@lichtblick/suite-base/panels/StateTransitions/hooks/useMessagePathDropConfig";
import { usePanelSettings } from "@lichtblick/suite-base/panels/StateTransitions/hooks/usePanelSettings";
import useStateTransitionsData from "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsData";
import useStateTransitionsDeltaMode from "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsDeltaMode";
import useStateTransitionsTime from "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsTime";
import { stateTransitionPathDisplayName } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import {
  DeltaOverlay,
  DeltaOverlaySeriesLabel,
} from "@lichtblick/suite-base/panels/shared/DeltaOverlay";
import {
  computeDeltaDisplay,
  getDeltaSeriesConfigIndexes,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { OnClickArg as OnChartClickArgs } from "@lichtblick/suite-base/src/components/Chart";
import { getLineColor } from "@lichtblick/suite-base/util/plotColors";

import { StateTransitionConfig, StateTransitionPanelProps } from "./types";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

function StateTransitions(props: StateTransitionPanelProps) {
  const { config, saveConfig } = props;
  const { paths } = config;
  const { classes } = useStateTransitionsStyles();
  const theme = useTheme();
  const { t } = useTranslation("stateTransitions");
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const isPlayerPresent =
    playerPresence === PlayerPresence.PRESENT || playerPresence === PlayerPresence.BUFFERING;

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

  const decodedMessages = useDecodedMessageRange(
    isPlayerPresent ? topics : EMPTY_TOPICS,
    isPlayerPresent ? pathStrings : EMPTY_PATHS,
  );

  // When range data is active, skip useMessagesByPath subscriptions entirely
  // to avoid wasteful current-frame processing and decoding.
  const hasRangeData = useMemo(
    () =>
      decodedMessages.some((block) =>
        pathStrings.some((pathStr) => (block[pathStr]?.length ?? 0) > 0),
      ),
    [decodedMessages, pathStrings],
  );

  const itemsByPath = useMessagesByPath(hasRangeData ? EMPTY_PATHS : pathStrings);

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

  const deltaMode = useStateTransitionsDeltaMode({
    datasets: data.datasets,
    // Markers reference paths by index, so clear stale ones when any path input changes.
    resetKey:
      JSON.stringify(
        paths.map(({ color, value, label, enabled, timestampMethod }) => [
          color,
          value,
          label,
          enabled,
          timestampMethod,
        ]),
      ) ?? "",
  });
  const { markerA, markerB } = deltaMode;

  const keyDownHandlers = useMemo(
    () => ({
      escape: () => {
        if (deltaMode.active) {
          deltaMode.toggleActive();
        }
      },
    }),
    [deltaMode],
  );

  const messagePipeline = useMessagePipelineGetter();

  const onClick = useCallback(
    ({ x: seekSeconds }: OnChartClickArgs) => {
      if (seekSeconds == undefined) {
        return;
      }

      if (deltaMode.active) {
        deltaMode.handleChartClick(seekSeconds);
        return;
      }

      const {
        seekPlayback,
        playerState: { activeData: { startTime: start } = {} },
      } = messagePipeline();
      if (!seekPlayback || start == undefined) {
        return;
      }
      const seekTime = addTimes(start, fromSec(seekSeconds));
      seekPlayback(seekTime);
    },
    [deltaMode, messagePipeline],
  );

  const annotations = useMemo((): AnnotationOptions[] => {
    const markerAnnotation = (value: number, content: string): AnnotationOptions => ({
      type: "line",
      scaleID: "x",
      value,
      borderColor: alpha(theme.palette.error.main, 0.6),
      borderWidth: 2,
      borderDash: [6, 4],
      label: {
        display: true,
        content,
        position: "start",
        backgroundColor: alpha(theme.palette.error.main, 0.15),
        color: theme.palette.error.main,
        font: { size: 10 },
      },
    });

    return [
      ...(markerA ? [markerAnnotation(markerA.xValue, t("markerA"))] : []),
      ...(markerB ? [markerAnnotation(markerB.xValue, t("markerB"))] : []),
    ];
  }, [markerA, markerB, t, theme.palette.error.main]);

  const overlayData = useMemo(() => {
    if (!deltaMode.active) {
      return undefined;
    }

    const seriesLabels: DeltaOverlaySeriesLabel[] = getDeltaSeriesConfigIndexes(
      markerA,
      markerB,
    ).map((configIndex): DeltaOverlaySeriesLabel => {
      const path = paths[configIndex];
      return {
        configIndex,
        label: path ? stateTransitionPathDisplayName(path, configIndex) : "",
        color: getLineColor(path?.color, configIndex),
      };
    });

    return {
      xValueA: markerA?.xValue,
      xValueB: markerB?.xValue,
      delta: computeDeltaDisplay(markerA, markerB),
      seriesLabels,
    };
  }, [deltaMode.active, markerA, markerB, paths]);

  usePanelSettings(config, saveConfig, pathState, focusedPath);

  return (
    <Stack flexGrow={1} overflow="hidden" style={{ zIndex: 0 }}>
      <PanelToolbar
        additionalIcons={
          <ToolbarIconButton
            title={t("measureMode")}
            aria-label={t("measureMode")}
            aria-pressed={deltaMode.active}
            color={deltaMode.active ? "primary" : "default"}
            onClick={deltaMode.toggleActive}
            data-testid="state-transitions-measure-mode-toggle"
          >
            <Ruler20Regular />
          </ToolbarIconButton>
        }
      />
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
            annotations={annotations}
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
          {overlayData && (
            <div className={classes.deltaOverlayWrapper} data-testid="delta-overlay-wrapper">
              <DeltaOverlay
                deltaRowLabel={t("delta")}
                xColumnLabel={t("labels.timestamp")}
                markerALabel={t("markerA")}
                markerBLabel={t("markerB")}
                xValueA={overlayData.xValueA}
                xValueB={overlayData.xValueB}
                deltaX={overlayData.delta.deltaX}
                seriesLabels={overlayData.seriesLabels}
                series={overlayData.delta.series}
                onRemoveMarkerA={deltaMode.removeMarkerA}
                onRemoveMarkerB={deltaMode.removeMarkerB}
                onClose={deltaMode.toggleActive}
              />
            </div>
          )}
        </div>
      </Stack>
      <KeyListener global keyDownHandlers={keyDownHandlers} />
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

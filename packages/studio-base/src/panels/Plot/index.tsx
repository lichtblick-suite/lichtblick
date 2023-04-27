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

import DownloadIcon from "@mui/icons-material/Download";
import { useTheme } from "@mui/material";
import { compact, isNumber, uniq } from "lodash";
import { ComponentProps, useCallback, useEffect, useMemo, useState } from "react";

import {
  Time,
  add as addTimes,
  fromSec,
  subtract as subtractTimes,
  toSec,
} from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar, {
  PANEL_TOOLBAR_MIN_HEIGHT,
} from "@foxglove/studio-base/components/PanelToolbar";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { ChartDefaultView } from "@foxglove/studio-base/components/TimeBasedChart";
import { usePlotPanelMessageData } from "@foxglove/studio-base/panels/Plot/usePlotPanelMessageData";
import { OnClickArg as OnChartClickArgs } from "@foxglove/studio-base/src/components/Chart";
import { OpenSiblingPanel, PanelConfig, SaveConfig } from "@foxglove/studio-base/types/panels";
import { PANEL_TITLE_CONFIG_KEY } from "@foxglove/studio-base/util/layout";

import PlotChart from "./PlotChart";
import { PlotLegend } from "./PlotLegend";
import { downloadCSV } from "./csv";
import { getDatasets } from "./datasets";
import { usePlotPanelSettings } from "./settings";
import { PlotConfig } from "./types";

export { plotableRosTypes } from "./types";
export type { PlotConfig } from "./types";

const defaultSidebarDimension = 240;

export function openSiblingPlotPanel(openSiblingPanel: OpenSiblingPanel, topicName: string): void {
  openSiblingPanel({
    panelType: "Plot",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => ({
      ...config,
      paths: uniq(
        (config as PlotConfig).paths
          .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
          .filter(({ value }) => value),
      ),
    }),
  });
}

type Props = {
  config: PlotConfig;
  saveConfig: SaveConfig<PlotConfig>;
};

const ZERO_TIME = { sec: 0, nsec: 0 };

function selectStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
}

function selectEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

function Plot(props: Props) {
  const { saveConfig, config } = props;
  const {
    title: legacyTitle,
    followingViewWidth,
    paths: yAxisPaths,
    minXValue,
    maxXValue,
    minYValue,
    maxYValue,
    showXAxisLabels,
    showYAxisLabels,
    showLegend,
    legendDisplay = config.showSidebar === true ? "left" : "floating",
    showPlotValuesInLegend,
    isSynced,
    xAxisVal,
    xAxisPath,
    sidebarDimension = config.sidebarWidth ?? defaultSidebarDimension,
    [PANEL_TITLE_CONFIG_KEY]: customTitle,
  } = config;

  useEffect(() => {
    if (legacyTitle && (customTitle == undefined || customTitle === "")) {
      // Migrate legacy Plot-specific title setting to new global title setting
      // https://github.com/foxglove/studio/pull/5225
      saveConfig({
        title: undefined,
        [PANEL_TITLE_CONFIG_KEY]: legacyTitle,
      } as Partial<PlotConfig>);
    }
  }, [customTitle, legacyTitle, saveConfig]);

  const theme = useTheme();

  useEffect(() => {
    if (yAxisPaths.length === 0) {
      saveConfig({ paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }] });
    }
  }, [saveConfig, yAxisPaths.length]);

  const showSingleCurrentMessage = xAxisVal === "currentCustom" || xAxisVal === "index";

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);

  // Min/max x-values and playback position indicator are only used for preloaded plots. In non-
  // preloaded plots min x-value is always the last seek time, and the max x-value is the current
  // playback time.
  const timeSincePreloadedStart = (time?: Time): number | undefined => {
    if (xAxisVal === "timestamp" && time && startTime) {
      return toSec(subtractTimes(time, startTime));
    }
    return undefined;
  };

  const currentTimeSinceStart = timeSincePreloadedStart(currentTime);

  const followingView = useMemo<ChartDefaultView | undefined>(() => {
    if (followingViewWidth != undefined && +followingViewWidth > 0) {
      return { type: "following", width: +followingViewWidth };
    }
    return undefined;
  }, [followingViewWidth]);

  const endTimeSinceStart = timeSincePreloadedStart(endTime);
  const fixedView = useMemo<ChartDefaultView | undefined>(() => {
    // Apply min/max x-value if either min or max or both is defined.
    if ((isNumber(minXValue) && isNumber(endTimeSinceStart)) || isNumber(maxXValue)) {
      return {
        type: "fixed",
        minXValue: isNumber(minXValue) ? minXValue : 0,
        maxXValue: isNumber(maxXValue) ? maxXValue : endTimeSinceStart ?? 0,
      };
    }
    if (xAxisVal === "timestamp" && startTime && endTimeSinceStart != undefined) {
      return { type: "fixed", minXValue: 0, maxXValue: endTimeSinceStart };
    }
    return undefined;
  }, [maxXValue, minXValue, endTimeSinceStart, startTime, xAxisVal]);

  // following view and fixed view are split to keep defaultView identity stable when possible
  const defaultView = useMemo<ChartDefaultView | undefined>(() => {
    return followingView ?? fixedView ?? undefined;
  }, [fixedView, followingView]);

  const allPaths = useMemo(() => {
    return yAxisPaths.map(({ value }) => value).concat(compact([xAxisPath?.value]));
  }, [xAxisPath?.value, yAxisPaths]);

  const combinedPlotData = usePlotPanelMessageData({
    allPaths,
    followingView,
    showSingleCurrentMessage,
  });

  // Keep disabled paths when passing into getDatasets, because we still want
  // easy access to the history when turning the disabled paths back on.
  const { datasets, pathsWithMismatchedDataLengths } = useMemo(() => {
    return getDatasets({
      paths: yAxisPaths,
      itemsByPath: combinedPlotData,
      startTime: startTime ?? ZERO_TIME,
      xAxisVal,
      xAxisPath,
      invertedTheme: theme.palette.mode === "dark",
    });
  }, [yAxisPaths, combinedPlotData, startTime, xAxisVal, xAxisPath, theme.palette.mode]);

  const messagePipeline = useMessagePipelineGetter();
  const onClick = useCallback<NonNullable<ComponentProps<typeof PlotChart>["onClick"]>>(
    ({ x: seekSeconds }: OnChartClickArgs) => {
      const {
        seekPlayback,
        playerState: { activeData: { startTime: start } = {} },
      } = messagePipeline();
      if (!seekPlayback || !start || seekSeconds == undefined || xAxisVal !== "timestamp") {
        return;
      }
      // Avoid normalizing a negative time if the clicked point had x < 0.
      if (seekSeconds >= 0) {
        seekPlayback(addTimes(start, fromSec(seekSeconds)));
      }
    },
    [messagePipeline, xAxisVal],
  );

  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);

  usePlotPanelSettings(config, saveConfig, focusedPath);

  const stackDirection = useMemo(
    () => (legendDisplay === "top" ? "column" : "row"),
    [legendDisplay],
  );

  return (
    <Stack
      flex="auto"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <PanelToolbar
        additionalIcons={
          <ToolbarIconButton
            onClick={() => downloadCSV(datasets, xAxisVal)}
            title="Download plot data as CSV"
          >
            <DownloadIcon fontSize="small" />
          </ToolbarIconButton>
        }
      />
      <Stack
        direction={stackDirection}
        flex="auto"
        fullWidth
        style={{ height: `calc(100% - ${PANEL_TOOLBAR_MIN_HEIGHT}px)` }}
      >
        {legendDisplay !== "none" && (
          <PlotLegend
            paths={yAxisPaths}
            datasets={datasets}
            currentTime={currentTimeSinceStart}
            onClickPath={(index: number) => setFocusedPath(["paths", String(index)])}
            saveConfig={saveConfig}
            showLegend={showLegend}
            pathsWithMismatchedDataLengths={pathsWithMismatchedDataLengths}
            legendDisplay={legendDisplay}
            showPlotValuesInLegend={showPlotValuesInLegend}
            sidebarDimension={sidebarDimension}
          />
        )}
        <Stack flex="auto" alignItems="center" justifyContent="center" overflow="hidden">
          <PlotChart
            isSynced={xAxisVal === "timestamp" && isSynced}
            paths={yAxisPaths}
            minYValue={parseFloat((minYValue ?? "").toString())}
            maxYValue={parseFloat((maxYValue ?? "").toString())}
            showXAxisLabels={showXAxisLabels}
            showYAxisLabels={showYAxisLabels}
            datasets={datasets}
            xAxisVal={xAxisVal}
            currentTime={currentTimeSinceStart}
            onClick={onClick}
            defaultView={defaultView}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}

const defaultConfig: PlotConfig = {
  title: "Plot",
  paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: defaultSidebarDimension,
};

export default Panel(
  Object.assign(Plot, {
    panelType: "Plot",
    defaultConfig,
  }),
);

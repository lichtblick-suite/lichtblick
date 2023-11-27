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

import { Add16Filled, Edit16Filled } from "@fluentui/react-icons";
import { Button, Typography } from "@mui/material";
import { ChartOptions, ScaleOptions } from "chart.js";
import * as _ from "lodash-es";
import * as R from "ramda";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { filterMap } from "@foxglove/den/collection";
import { add as addTimes, fromSec, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import { useBlocksSubscriptions } from "@foxglove/studio-base/PanelAPI";
import {
  MessageDataItemsByPath,
  MessageAndData,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@foxglove/studio-base/components/MessagePathSyntax/useMessagesByPath";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import { ChartDatasets } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { subscribePayloadFromMessagePath } from "@foxglove/studio-base/players/subscribePayloadFromMessagePath";
import { SubscribePayload } from "@foxglove/studio-base/players/types";
import { OnClickArg as OnChartClickArgs } from "@foxglove/studio-base/src/components/Chart";
import { Bounds } from "@foxglove/studio-base/types/Bounds";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { fontMonospace } from "@foxglove/theme";

import { messagesToDataset } from "./messagesToDataset";
import { PathState, useStateTransitionsPanelSettings } from "./settings";
import { DEFAULT_PATH, stateTransitionPathDisplayName } from "./shared";
import { StateTransitionConfig } from "./types";

const fontSize = 10;
const fontWeight = "bold";
const EMPTY_ITEMS_BY_PATH: MessageDataItemsByPath = {};

const useStyles = makeStyles()((theme) => ({
  chartWrapper: {
    position: "relative",
    marginTop: theme.spacing(0.5),
    height: "100%",
  },
  chartOverlay: {
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: "none",
  },
  row: {
    paddingInline: theme.spacing(0.5),
    pointerEvents: "none",
  },
  button: {
    minWidth: "auto",
    textAlign: "left",
    pointerEvents: "auto",
    fontWeight: "normal",
    padding: theme.spacing(0, 1),
    maxWidth: "100%",

    "&:hover": {
      backgroundColor: tinycolor(theme.palette.background.paper).setAlpha(0.67).toString(),
      backgroundImage: `linear-gradient(to right, ${theme.palette.action.focus}, ${theme.palette.action.focus})`,
    },
    ".MuiButton-endIcon": {
      opacity: 0.8,
      fontSize: 14,
      marginLeft: theme.spacing(0.5),

      svg: {
        fontSize: "1em",
        height: "1em",
        width: "1em",
      },
    },
    ":not(:hover) .MuiButton-endIcon": {
      display: "none",
    },
  },
}));

const plugins: ChartOptions["plugins"] = {
  datalabels: {
    display: "auto",
    anchor: "center",
    align: -45,
    offset: 0,
    clip: true,
    font: {
      family: fontMonospace,
      size: fontSize,
      weight: fontWeight,
    },
  },
  zoom: {
    zoom: {
      enabled: true,
      mode: "x",
      sensitivity: 3,
      speed: 0.1,
    },
    pan: {
      mode: "x",
      enabled: true,
      speed: 20,
      threshold: 10,
    },
  },
};

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
}

function selectStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function selectEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

function datasetContainsArray(dataset: Immutable<(MessageAndData[] | undefined)[]>) {
  // We need to detect when the path produces more than one data point,
  // since that is invalid input
  const dataCounts = R.pipe(
    R.chain((data: Immutable<MessageAndData[] | undefined>): number[] => {
      if (data == undefined) {
        return [];
      }
      return data.map((message) => message.queriedData.length);
    }),
    R.uniq,
  )(dataset);
  return dataCounts.length > 0 && dataCounts.every((numPoints) => numPoints > 1);
}

type Props = {
  config: StateTransitionConfig;
  saveConfig: SaveConfig<StateTransitionConfig>;
};

function StateTransitions(props: Props) {
  const { config, saveConfig } = props;
  const { paths } = config;
  const { classes } = useStyles();

  const pathStrings = useMemo(() => paths.map(({ value }) => value), [paths]);

  const { openPanelSettings } = useWorkspaceActions();
  const { id: panelId, setMessagePathDropConfig } = usePanelContext();
  const { setSelectedPanelIds } = useSelectedPanels();
  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);

  useEffect(() => {
    setMessagePathDropConfig({
      getDropStatus(draggedPaths) {
        if (draggedPaths.some((path) => !path.isLeaf)) {
          return { canDrop: false };
        }
        return { canDrop: true, effect: "add" };
      },
      handleDrop(draggedPaths) {
        saveConfig((prevConfig) => ({
          ...prevConfig,
          paths: [
            ...prevConfig.paths,
            ...draggedPaths.map((path) => ({
              value: path.path,
              enabled: true,
              timestampMethod: "receiveTime" as const,
            })),
          ],
        }));
      },
    });
  }, [saveConfig, setMessagePathDropConfig]);

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const currentTimeSinceStart = useMemo(
    () => (currentTime && startTime ? toSec(subtractTimes(currentTime, startTime)) : undefined),
    [currentTime, startTime],
  );
  const endTime = useMessagePipeline(selectEndTime);
  const endTimeSinceStart = useMemo(
    () => (endTime && startTime ? toSec(subtractTimes(endTime, startTime)) : undefined),
    [endTime, startTime],
  );
  const itemsByPath = useMessagesByPath(pathStrings);

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);

  const subscriptions: SubscribePayload[] = useMemo(
    () =>
      filterMap(paths, (path) => {
        const payload = subscribePayloadFromMessagePath(path.value, "full");
        // Include the header in case we are ordering by header stamp.
        if (path.timestampMethod === "headerStamp" && payload?.fields != undefined) {
          payload.fields.push("header");
        }
        return payload;
      }),
    [paths],
  );

  const blocks = useBlocksSubscriptions(subscriptions);
  const decodedBlocks = useMemo(
    () => blocks.map(decodeMessagePathsForMessagesByTopic),
    [blocks, decodeMessagePathsForMessagesByTopic],
  );

  const { height, heightPerTopic } = useMemo(() => {
    const onlyTopicsHeight = paths.length * 64;
    const xAxisHeight = 30;
    return {
      height: Math.max(80, onlyTopicsHeight + xAxisHeight),
      heightPerTopic: onlyTopicsHeight / paths.length,
    };
  }, [paths.length]);

  // If our blocks data covers all paths in the chart then ignore the data in itemsByPath
  // since it's not needed to render the chart and would just cause unnecessary re-renders
  // if included in the dataset.
  const newItemsByPath = useMemo(() => {
    const newItemsNotInBlocks = _.pickBy(
      itemsByPath,
      (_items, path) => !decodedBlocks.some((block) => block[path]),
    );
    return _.isEmpty(newItemsNotInBlocks) ? EMPTY_ITEMS_BY_PATH : newItemsNotInBlocks;
  }, [decodedBlocks, itemsByPath]);

  const showPoints = config.showPoints === true;

  const { pathState, data, minY } = useMemo(() => {
    // ignore all data when we don't have a start time
    if (!startTime) {
      return {
        datasets: [],
        minY: undefined,
        pathState: [],
      };
    }

    let outMinY: number | undefined;
    const outDatasets: ChartDatasets = [];
    const outPathState: PathState[] = [];

    paths.forEach((path, pathIndex) => {
      // y axis values are set based on the path we are rendering
      // negative makes each path render below the previous
      const y = (pathIndex + 1) * 6 * -1;
      outMinY = Math.min(outMinY ?? y, y - 3);

      const blocksForPath = decodedBlocks.map((decodedBlock) => decodedBlock[path.value]);

      const newBlockDataSet = messagesToDataset({
        blocks: blocksForPath,
        path,
        pathIndex,
        startTime,
        y,
        showPoints,
      });

      // We have already filtered out paths we can find in blocks so anything left here
      // should be included in the dataset.
      const items = newItemsByPath[path.value];

      // We need to detect when the path produces more than one data point,
      // since that is invalid input
      const isArray = datasetContainsArray([...blocksForPath, items]);

      outPathState.push({
        path,
        isArray,
      });
      outDatasets.push(newBlockDataSet);

      if (items == undefined) {
        return;
      }
      const newPathDataSet = messagesToDataset({
        blocks: [items],
        path,
        pathIndex,
        startTime,
        y,
        showPoints,
      });
      outDatasets.push(newPathDataSet);
    });

    return {
      data: { datasets: outDatasets },
      minY: outMinY,
      pathState: outPathState,
    };
  }, [decodedBlocks, newItemsByPath, paths, startTime, showPoints]);

  const yScale = useMemo<ScaleOptions<"linear">>(() => {
    return {
      ticks: {
        // Hide all y-axis ticks since each bar on the y-axis is just a separate path.
        display: false,
      },
      grid: {
        display: false,
      },
      type: "linear",
      min: minY,
      max: -3,
    };
  }, [minY]);

  const xScale = useMemo<ScaleOptions<"linear">>(() => {
    return {
      type: "linear",
      border: {
        display: false,
      },
    };
  }, []);

  // Compute the fixed bounds (either via min/max x-axis config or end time since start).
  //
  // For recordings, the bounds are actually fixed but for live connections the "endTimeSinceStart"
  // will increase and these bounds are not technically fixed. But in those instances there is also
  // new data coming in when the bounds are changing.
  //
  // We need to keep the fixedBounds reference stable (if it can be stable) for the databounds memo
  // below, otherwise playing through a recording will update the currentTimeSince start and return
  // a new fixedBounds reference which causes expensive downstream rendering.
  const fixedBounds = useMemo(() => {
    if (endTimeSinceStart == undefined) {
      return undefined;
    }

    if (config.xAxisMinValue != undefined || config.xAxisMaxValue != undefined) {
      return {
        x: {
          min: config.xAxisMinValue ?? 0,
          max: config.xAxisMaxValue ?? endTimeSinceStart,
        },
        y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
      };
    }

    // If we have no configured xAxis min/max or range, then we set the x axis max to end time
    // This will mirror the plot behavior of showing the full x-axis for data time range rather
    // than constantly adjusting the end time to the latest loaded state transition while data
    // is loading.
    return {
      x: { min: 0, max: endTimeSinceStart },
      y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    };
  }, [config.xAxisMaxValue, config.xAxisMinValue, endTimeSinceStart]);

  // Compute the data bounds. The bounds are either a fixed amount of lookback from the current time
  // or they are fixed bounds with a specific range.
  const databounds: undefined | Bounds = useMemo(() => {
    if (config.xAxisRange != undefined && currentTimeSinceStart != undefined) {
      return {
        x: { min: currentTimeSinceStart - config.xAxisRange, max: currentTimeSinceStart },
        y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
      };
    }

    return fixedBounds;
  }, [config.xAxisRange, currentTimeSinceStart, fixedBounds]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector<HTMLDivElement>({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

  // Disable the wheel event for the chart wrapper div (which is where we use sizeRef)
  //
  // The chart component uses wheel events for zoom and pan. After adding more series, the logic
  // expands the chart element beyond the visible area of the panel. When this happens, scrolling on
  // the chart also scrolls the chart wrapper div and results in zooming that chart AND scrolling
  // the panel. This behavior is undesirable.
  //
  // This effect registers a wheel event handler for the wrapper div to prevent scrolling. To scroll
  // the panel the user will use the scrollbar.
  useEffect(() => {
    const el = sizeRef.current;
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
    };

    el?.addEventListener("wheel", handler);
    return () => {
      el?.removeEventListener("wheel", handler);
    };
  }, [sizeRef]);

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

  useStateTransitionsPanelSettings(config, saveConfig, pathState, focusedPath);

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
            plugins={plugins}
            interactionMode="lastX"
            onClick={onClick}
            currentTime={currentTimeSinceStart}
          />

          <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
            {(paths.length === 0 ? [DEFAULT_PATH] : paths).map((path, index) => (
              <div className={classes.row} key={index} style={{ height: heightPerTopic }}>
                <Button
                  size="small"
                  color="inherit"
                  data-testid="edit-topic-button"
                  className={classes.button}
                  endIcon={paths.length === 0 ? <Add16Filled /> : <Edit16Filled />}
                  onClick={() => {
                    setSelectedPanelIds([panelId]);
                    openPanelSettings();
                    setFocusedPath(["paths", String(index)]);
                  }}
                >
                  <Typography variant="inherit" noWrap>
                    {paths.length === 0
                      ? "Click to add a series"
                      : stateTransitionPathDisplayName(path, index)}
                  </Typography>
                </Button>
              </div>
            ))}
          </Stack>
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

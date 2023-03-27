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

import { Edit16Filled } from "@fluentui/react-icons";
import { Button, Typography } from "@mui/material";
import { ChartOptions, ScaleOptions } from "chart.js";
import { uniq } from "lodash";
import { useCallback, useMemo, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { useShallowMemo } from "@foxglove/hooks";
import { add as addTimes, fromSec, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { useBlocksByTopic } from "@foxglove/studio-base/PanelAPI";
import { getTopicsFromPaths } from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { useDecodeMessagePathsForMessagesByTopic } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
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
import TimeBasedChart, {
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/WorkspaceContext";
import {
  ChartData,
  OnClickArg as OnChartClickArgs,
} from "@foxglove/studio-base/src/components/Chart";
import { OpenSiblingPanel, PanelConfig, SaveConfig } from "@foxglove/studio-base/types/panels";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import messagesToDatasets from "./messagesToDatasets";
import { useStateTransitionsPanelSettings } from "./settings";
import { stateTransitionPathDisplayName } from "./shared";
import { StateTransitionConfig } from "./types";

export const transitionableRosTypes = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "string",
  "json",
];

const fontFamily = fonts.MONOSPACE;
const fontSize = 10;
const fontWeight = "bold";

const useStyles = makeStyles<void, "button">()((theme) => ({
  chartWrapper: {
    position: "relative",
    marginTop: theme.spacing(0.5),
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
      family: fontFamily,
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

export function openSiblingStateTransitionsPanel(
  openSiblingPanel: OpenSiblingPanel,
  topicName: string,
): void {
  openSiblingPanel({
    panelType: "StateTransitions",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => {
      return {
        ...config,
        paths: uniq(
          (config as StateTransitionConfig).paths.concat([
            { value: topicName, timestampMethod: "receiveTime" },
          ]),
        ),
      };
    },
  });
}

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
}

type Props = {
  config: StateTransitionConfig;
  saveConfig: SaveConfig<StateTransitionConfig>;
};

const StateTransitions = React.memo(function StateTransitions(props: Props) {
  const { config, saveConfig } = props;
  const { paths } = config;
  const { classes } = useStyles();

  const pathStrings = useMemo(() => paths.map(({ value }) => value), [paths]);
  const subscribeTopics = useMemo(() => getTopicsFromPaths(pathStrings), [pathStrings]);

  const { openPanelSettings } = useWorkspaceActions();
  const { id: panelId } = usePanelContext();
  const { setSelectedPanelIds } = useSelectedPanels();
  const [focusedPath, setFocusedPath] = useState<undefined | string[]>(undefined);

  const { startTime } = PanelAPI.useDataSourceInfo();
  const currentTime = useMessagePipeline(selectCurrentTime);
  const currentTimeSinceStart = useMemo(
    () => (!currentTime || !startTime ? undefined : toSec(subtractTimes(currentTime, startTime))),
    [currentTime, startTime],
  );
  const itemsByPath = useMessagesByPath(pathStrings);

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);

  const blocks = useBlocksByTopic(subscribeTopics);
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

  const { datasets, tooltips, minY } = useMemo(() => {
    let outMinY: number | undefined;

    let outTooltips: TimeBasedChartTooltipData[] = [];
    let outDatasets: ChartData["datasets"] = [];

    // ignore all data when we don't have a start time
    if (!startTime) {
      return {
        datasets: outDatasets,
        tooltips: outTooltips,
        minY: outMinY,
      };
    }

    paths.forEach((path, pathIndex) => {
      // y axis values are set based on the path we are rendering
      // negative makes each path render below the previous
      const y = (pathIndex + 1) * 6 * -1;
      outMinY = Math.min(outMinY ?? y, y - 3);

      const blocksForPath = decodedBlocks.map((decodedBlock) => decodedBlock[path.value]);

      {
        const { datasets: newDataSets, tooltips: newTooltips } = messagesToDatasets({
          path,
          startTime,
          y,
          pathIndex,
          blocks: blocksForPath,
        });

        outDatasets = outDatasets.concat(newDataSets);
        outTooltips = outTooltips.concat(newTooltips);
      }

      // If we have have messages in blocks for this path, we ignore streamed messages and only
      // display the messages from blocks.
      const haveBlocksForPath = blocksForPath.some((item) => item != undefined);
      if (haveBlocksForPath) {
        return;
      }

      const items = itemsByPath[path.value];
      if (items) {
        const { datasets: newDataSets, tooltips: newTooltips } = messagesToDatasets({
          path,
          startTime,
          y,
          pathIndex,
          blocks: [items],
        });
        outDatasets = outDatasets.concat(newDataSets);
        outTooltips = outTooltips.concat(newTooltips);
      }
    });

    return {
      datasets: outDatasets,
      tooltips: outTooltips,
      minY: outMinY,
    };
  }, [itemsByPath, decodedBlocks, paths, startTime]);

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

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

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

  const data: ChartData = useShallowMemo({ datasets });

  useStateTransitionsPanelSettings(config, saveConfig, focusedPath);

  const pointToDatumTooltipMap = useMemo(() => {
    const lookup = new Map<string, TimeBasedChartTooltipData>();
    for (const tip of tooltips) {
      lookup.set(`${tip.x}:${tip.y}:${tip.datasetIndex}`, tip);
    }
    return lookup;
  }, [tooltips]);

  return (
    <Stack flexGrow={1} overflow="hidden" style={{ zIndex: 0 }}>
      <PanelToolbar />
      <Stack fullWidth flex="auto" overflowX="hidden" overflowY="auto">
        <div className={classes.chartWrapper} style={{ height }} ref={sizeRef}>
          <TimeBasedChart
            zoom
            isSynced={config.isSynced}
            showXAxisLabels
            width={width ?? 0}
            height={height}
            data={data}
            type="scatter"
            xAxes={xScale}
            xAxisIsPlaybackTime
            yAxes={yScale}
            plugins={plugins}
            tooltips={pointToDatumTooltipMap}
            onClick={onClick}
            currentTime={currentTimeSinceStart}
          />

          <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
            {paths.map((path, index) => (
              <div className={classes.row} key={index} style={{ height: heightPerTopic }}>
                <Button
                  size="small"
                  color="inherit"
                  className={classes.button}
                  endIcon={<Edit16Filled />}
                  onClick={() => {
                    setSelectedPanelIds([panelId]);
                    openPanelSettings();
                    setFocusedPath(["paths", String(index)]);
                  }}
                >
                  <Typography variant="inherit" noWrap>
                    {stateTransitionPathDisplayName(path, index)}
                  </Typography>
                </Button>
              </div>
            ))}
          </Stack>
        </div>
      </Stack>
    </Stack>
  );
});

const defaultConfig: StateTransitionConfig = {
  paths: [{ value: "", timestampMethod: "receiveTime" }],
  isSynced: true,
};
export default Panel(
  Object.assign(StateTransitions, {
    panelType: "StateTransitions",
    defaultConfig,
  }),
);

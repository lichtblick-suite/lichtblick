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

import { Stack } from "@mui/material";
import { last, sumBy } from "lodash";
import { ReactElement } from "react";

import { subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { Sparkline, SparklinePoint } from "@foxglove/studio-base/components/Sparkline";
import { PlayerStateActiveData } from "@foxglove/studio-base/players/types";

import helpContent from "./index.help.md";

const TIME_RANGE = 5000;

type PlaybackPerformanceItemProps = {
  points: SparklinePoint[];
  maximum: number;
  decimalPlaces: number;
  children: React.ReactNode;
};

function PlaybackPerformanceItem(props: PlaybackPerformanceItemProps): ReactElement {
  return (
    <div style={{ margin: 8 }}>
      <Sparkline
        points={props.points}
        maximum={props.maximum}
        width={100}
        height={30}
        timeRange={TIME_RANGE}
      />
      <div style={{ display: "inline-block", marginLeft: 12, verticalAlign: "middle" }}>
        {(last(props.points) ?? { value: 0 }).value.toFixed(props.decimalPlaces)}
        {props.children}
        <div style={{ color: "#aaa" }}>
          {(sumBy(props.points, "value") / props.points.length).toFixed(props.decimalPlaces)} avg
        </div>
      </div>
    </div>
  );
}

export type UnconnectedPlaybackPerformanceProps = {
  readonly timestamp: number;
  readonly activeData?: PlayerStateActiveData;
};

// Exported for stories
export function UnconnectedPlaybackPerformance({
  timestamp,
  activeData,
}: UnconnectedPlaybackPerformanceProps): JSX.Element {
  const playbackInfo = React.useRef<
    { timestamp: number; activeData: PlayerStateActiveData } | undefined
  >();
  const lastPlaybackInfo = playbackInfo.current;
  if (activeData && (!playbackInfo.current || playbackInfo.current.activeData !== activeData)) {
    playbackInfo.current = { timestamp, activeData };
  }

  const perfPoints = React.useRef<{
    speed: SparklinePoint[];
    framerate: SparklinePoint[];
    bagTimeMs: SparklinePoint[];
    megabitsPerSecond: SparklinePoint[];
  }>({
    speed: [],
    framerate: [],
    bagTimeMs: [],
    megabitsPerSecond: [],
  });

  if (
    activeData &&
    playbackInfo.current &&
    lastPlaybackInfo &&
    lastPlaybackInfo.activeData !== activeData
  ) {
    const renderTimeMs = timestamp - lastPlaybackInfo.timestamp;
    if (
      lastPlaybackInfo.activeData.isPlaying &&
      activeData.isPlaying &&
      lastPlaybackInfo.activeData.lastSeekTime === activeData.lastSeekTime &&
      lastPlaybackInfo.activeData.currentTime !== activeData.currentTime
    ) {
      const bagTimeMs =
        toSec(subtractTimes(activeData.currentTime, lastPlaybackInfo.activeData.currentTime)) *
        1000;
      perfPoints.current.speed.push({ value: bagTimeMs / renderTimeMs, timestamp });
      perfPoints.current.framerate.push({ value: 1000 / renderTimeMs, timestamp });
      perfPoints.current.bagTimeMs.push({ value: bagTimeMs, timestamp });
    }
    const newBytesReceived =
      activeData.totalBytesReceived - lastPlaybackInfo.activeData.totalBytesReceived;
    const newMegabitsReceived = (8 * newBytesReceived) / 1e6;
    const megabitsPerSecond = newMegabitsReceived / (renderTimeMs / 1000);
    perfPoints.current.megabitsPerSecond.push({ value: megabitsPerSecond, timestamp });
    for (const points of Object.values(perfPoints.current)) {
      while (points[0] && points[0].timestamp < timestamp - TIME_RANGE) {
        points.shift();
      }
    }
  }

  return (
    <Stack flex="auto">
      <PanelToolbar helpContent={helpContent} />
      <Stack
        flex="auto"
        flexWrap="wrap"
        alignItems="flex-start"
        justifyContent="center"
        lineHeight={1}
        whiteSpace="nowrap"
      >
        <PlaybackPerformanceItem points={perfPoints.current.speed} maximum={1.6} decimalPlaces={2}>
          &times; realtime
        </PlaybackPerformanceItem>
        <PlaybackPerformanceItem
          points={perfPoints.current.framerate}
          maximum={30}
          decimalPlaces={1}
        >
          fps
        </PlaybackPerformanceItem>
        <PlaybackPerformanceItem
          points={perfPoints.current.bagTimeMs}
          maximum={300}
          decimalPlaces={0}
        >
          ms bag frame
        </PlaybackPerformanceItem>
        <PlaybackPerformanceItem
          points={perfPoints.current.megabitsPerSecond}
          maximum={100}
          decimalPlaces={1}
        >
          Mbps
        </PlaybackPerformanceItem>
      </Stack>
    </Stack>
  );
}

function PlaybackPerformance() {
  const timestamp = Date.now();
  const activeData = useMessagePipeline(
    React.useCallback(({ playerState }) => playerState.activeData, []),
  );
  return <UnconnectedPlaybackPerformance timestamp={timestamp} activeData={activeData} />;
}

PlaybackPerformance.panelType = "PlaybackPerformance";
PlaybackPerformance.defaultConfig = {};

export default Panel(PlaybackPerformance);

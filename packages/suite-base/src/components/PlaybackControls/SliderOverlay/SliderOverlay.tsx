// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import { useCallback } from "react";

import { toSec, subtract as subtractTimes, add as addTimes, fromSec } from "@lichtblick/rostime";
import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { usePlayerMarksStore } from "@lichtblick/suite-base/util/usePlayerMarksStore";

import { useStyles } from "./SliderOverlay.style";

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

export default function SliderOverlay(): React.JSX.Element {
  const { classes } = useStyles();
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const { startMark, endMark, setStartMark, setEndMark } = usePlayerMarksStore();

  // Convert marks to fractions (0-100)
  const value = [
    startMark && startTime && endTime
      ? (toSec(subtractTimes(startMark, startTime)) / toSec(subtractTimes(endTime, startTime))) *
        100
      : 0,
    endMark && startTime && endTime
      ? (toSec(subtractTimes(endMark, startTime)) / toSec(subtractTimes(endTime, startTime))) * 100
      : 100,
  ];

  const handleChange = useCallback(
    (_event: Event, newValue: number | number[]) => {
      if (!startTime || !endTime || !Array.isArray(newValue)) {
        return;
      }

      const duration = toSec(subtractTimes(endTime, startTime));
      const [start = 0, end = 100] = newValue;

      const startMarkTime = addTimes(startTime, fromSec((start / 100) * duration));
      const endMarkTime = addTimes(startTime, fromSec((end / 100) * duration));

      setStartMark(startMarkTime);
      setEndMark(endMarkTime);
    },
    [startTime, endTime, setStartMark, setEndMark],
  );

  return (
    <Box className={classes.container}>
      <Slider
        value={value}
        min={0}
        max={100}
        step={0.01}
        onChange={handleChange}
        valueLabelDisplay="off"
        disableSwap
        className={classes.slider}
      />
    </Box>
  );
}

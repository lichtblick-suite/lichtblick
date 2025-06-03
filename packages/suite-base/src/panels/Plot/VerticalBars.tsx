// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLatest } from "react-use";

import { toSec } from "@lichtblick/rostime";
import { useMessagePipelineSubscribe } from "@lichtblick/suite-base/components/MessagePipeline";
import { useHoverValue } from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { getPixelForXValue } from "@lichtblick/suite-base/panels/Plot/utils/getPixelForXValue";
import { useStyles } from "@lichtblick/suite-base/panels/Plot/verticalbars.style";

import type { VerticalBarsProps, Scale } from "./types";

/**
 * Display vertical bars at the currentTime & the hovered time.
 *
 * This is a separate component in order to limit the scope of what needs to re-render when time and scale change.
 */
export const VerticalBars = React.memo(function VerticalBars({
  coordinator,
  hoverComponentId,
  xAxisIsPlaybackTime,
}: VerticalBarsProps): React.JSX.Element {
  const { classes, cx, theme } = useStyles();

  const messagePipelineSubscribe = useMessagePipelineSubscribe();

  const hoverValue = useHoverValue({
    componentId: hoverComponentId,
    isPlaybackSeconds: xAxisIsPlaybackTime,
  });
  const latestHoverValue = useLatest(hoverValue);
  const latestCurrentTimeSinceStart = useRef<number | undefined>();
  const latestXScale = useRef<Scale | undefined>();

  const currentTimeBarRef = useRef<HTMLDivElement>(ReactNull);
  const hoverBarRef = useRef<HTMLDivElement>(ReactNull);

  const updateBars = useCallback(() => {
    if (!currentTimeBarRef.current || !hoverBarRef.current) {
      return;
    }
    const currentTimePixel = getPixelForXValue(
      latestXScale.current,
      latestCurrentTimeSinceStart.current,
    );
    const hoverValuePixel = getPixelForXValue(
      latestXScale.current,
      latestHoverValue.current?.value,
    );

    if (currentTimePixel != undefined) {
      currentTimeBarRef.current.style.display = "block";
      currentTimeBarRef.current.style.transform = `translateX(${currentTimePixel}px)`;
    } else {
      currentTimeBarRef.current.style.display = "none";
    }

    if (hoverValuePixel != undefined) {
      hoverBarRef.current.style.display = "block";
      hoverBarRef.current.style.transform = `translateX(${hoverValuePixel}px)`;
    } else {
      hoverBarRef.current.style.display = "none";
    }
  }, [latestHoverValue]);

  useLayoutEffect(() => {
    updateBars();
  }, [hoverValue, updateBars]);

  useEffect(() => {
    latestXScale.current = undefined;
    if (!coordinator) {
      return;
    }
    const handler = (scale: Scale | undefined) => {
      latestXScale.current = scale;
      updateBars();
    };
    coordinator.on("xScaleChanged", handler);
    return () => {
      coordinator.off("xScaleChanged", handler);
    };
  }, [coordinator, updateBars]);

  useEffect(() => {
    latestCurrentTimeSinceStart.current = undefined;

    // Only subscribe to currentTime for timeseries plots
    if (!xAxisIsPlaybackTime) {
      return;
    }
    const unsubscribe = messagePipelineSubscribe(({ playerState: { activeData } }) => {
      if (!activeData) {
        latestCurrentTimeSinceStart.current = undefined;
        return;
      }
      latestCurrentTimeSinceStart.current =
        toSec(activeData.currentTime) - toSec(activeData.startTime);
      updateBars();
    });
    return unsubscribe;
  }, [xAxisIsPlaybackTime, messagePipelineSubscribe, updateBars]);

  if (!coordinator) {
    return <></>;
  }

  return (
    <>
      <div
        data-testid="vertical-bar"
        ref={currentTimeBarRef}
        className={cx(classes.verticalBar, classes.playbackBar)}
      />
      <div
        data-testid="hover-bar"
        ref={hoverBarRef}
        className={cx(classes.verticalBar)}
        style={{
          backgroundColor: xAxisIsPlaybackTime
            ? theme.palette.warning.main
            : theme.palette.info.main,
        }}
      />
    </>
  );
});

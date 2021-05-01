// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { sumBy } from "lodash";
import styled from "styled-components";
import textWidth, { Options } from "text-width";

import AutoSizingCanvas from "@foxglove-studio/app/components/AutoSizingCanvas";
import Slider from "@foxglove-studio/app/components/Slider";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";

// The minimum ratio between the width of the panel and the total width taken by the labels.
// If the ratio drops below this value, (due to the width of the panel changing)
// we will remove every other label until the ratio is back above this value.
const MINIMUM_LABEL_FREESPACE_RATIO = 2;

const TICK_FONT: Options = { family: mixins.monospaceFont ?? "monospace", size: 10 };

const SSliderContainer = styled.div`
  height: 30px;
  position: relative;
  margin-bottom: 4px;
`;

type MeasuredLabel = {
  text: string;
  tickWidth: number;
  value: number;
};

export type SliderProps = {
  min: number;
  max: number;
  step: number;
};

export function SliderWithTicks(props: {
  value: number;
  sliderProps: SliderProps;
  onChange: (arg0: number) => void;
}): JSX.Element {
  const { value, sliderProps, onChange } = props;
  return (
    <SSliderContainer>
      <AutoSizingCanvas draw={drawTicks(value, sliderProps)} />
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
        <Slider {...sliderProps} value={value} draggable onChange={onChange} />
      </div>
    </SSliderContainer>
  );
}

// exported for tests
export function getNonOverlappingLabels(
  measuredLabels: MeasuredLabel[],
  width: number,
): MeasuredLabel[] {
  let stepLabels: MeasuredLabel[] = measuredLabels;
  do {
    const totalWidth = sumBy(stepLabels, ({ tickWidth }) => tickWidth);
    const freeSpaceRatio = width / totalWidth;
    if (freeSpaceRatio >= MINIMUM_LABEL_FREESPACE_RATIO) {
      break;
    }
    stepLabels = stepLabels.filter((_, i) => i % 2 === 0);
  } while (stepLabels.length > 3);
  return stepLabels;
}

function drawTicks(futureTime: number | undefined, sliderConfig: SliderProps) {
  const { min, max, step } = sliderConfig;

  // First, measure all the step labels' text widths.
  // we do this outside the canvas context function so it can be cached.
  const measuredLabels: any = [];

  // Represents the number of gaps, not the number of ticks
  const steps = Math.ceil((max - min) / step);
  for (let i = 0; i <= steps; i++) {
    const value = Math.min(min + (i / steps) * (max - min), max);
    const text = value.toFixed(1);

    const tickWidth = textWidth(text, TICK_FONT);
    measuredLabels.push({
      text,
      value,
      tickWidth,
    });
  }

  return (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // We don't want labels to overlap, so keep removing every other one until the
    // ratio of textWidth to the totalWidth of the panel is above the threshold.
    const stepLabels = getNonOverlappingLabels(measuredLabels, width);

    // Clear the previous labels and draw the new ones
    ctx.clearRect(0, 0, width, height);
    stepLabels.forEach(({ text, tickWidth, value }, i) => {
      const x = (i / (stepLabels.length - 1)) * width - tickWidth / 2;
      const y = height / 2 + 2;

      if (futureTime === value) {
        ctx.font = `bold ${TICK_FONT.size}px ${TICK_FONT.family}`;
        ctx.fillStyle = "white";
      } else {
        ctx.font = `${TICK_FONT.size}px ${TICK_FONT.family}`;
        ctx.fillStyle = "#666";
      }
      ctx.fillText(text, x, y);
    });
  };
}

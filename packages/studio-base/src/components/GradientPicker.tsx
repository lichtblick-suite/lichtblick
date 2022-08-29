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

import { styled as muiStyled } from "@mui/material";
import { useCallback } from "react";

import { Color } from "@foxglove/regl-worldview";
import AutoSizingCanvas from "@foxglove/studio-base/components/AutoSizingCanvas";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import { defaultedRGBStringFromColorObj } from "@foxglove/studio-base/util/colorUtils";

const GRADIENT_LINE_HEIGHT = 6;
const GRADIENT_LINE_WIDTH = 1;
const GRADIENT_COLOR_PICKER_SIZE = 25;
const GRADIENT_BAR_INSET = (GRADIENT_COLOR_PICKER_SIZE - GRADIENT_LINE_WIDTH) / 2;
const GRADIENT_BAR_HEIGHT = 10;

const SPickerWrapper = muiStyled("div")`
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;
const SBarWrapper = muiStyled("div")`
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  margin-left: ${GRADIENT_BAR_INSET}px;
  margin-right: ${GRADIENT_BAR_INSET}px;
`;
const SLine = muiStyled("div")`
  flex: 0 0 auto;
  width: ${GRADIENT_LINE_WIDTH}px;
  height: ${GRADIENT_BAR_HEIGHT + GRADIENT_LINE_HEIGHT}px;
  background-color: ${({ theme }) => theme.palette.text.primary};
`;
const SBar = muiStyled("div")`
  flex: 1 1 auto;
  height: ${GRADIENT_BAR_HEIGHT}px;
`;

export default function GradientPicker({
  minColor,
  maxColor,
  onChange,
}: {
  minColor: Color;
  maxColor: Color;
  onChange: (arg0: { minColor: Color; maxColor: Color }) => void;
}): JSX.Element {
  const rgbMinColor = defaultedRGBStringFromColorObj(minColor);
  const rgbMaxColor = defaultedRGBStringFromColorObj(maxColor);

  const drawGradient = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgbMinColor);
      gradient.addColorStop(1, rgbMaxColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [rgbMaxColor, rgbMinColor],
  );

  return (
    <>
      <SPickerWrapper>
        <ColorPicker
          buttonShape="circle"
          circleSize={GRADIENT_COLOR_PICKER_SIZE}
          color={minColor}
          onChange={(newColor) => onChange({ minColor: newColor, maxColor })}
        />
        <ColorPicker
          buttonShape="circle"
          circleSize={GRADIENT_COLOR_PICKER_SIZE}
          color={maxColor}
          onChange={(newColor) => onChange({ minColor, maxColor: newColor })}
        />
      </SPickerWrapper>
      <SBarWrapper>
        <SLine />
        <SBar>
          <AutoSizingCanvas draw={drawGradient} />
        </SBar>
        <SLine />
      </SBarWrapper>
    </>
  );
}

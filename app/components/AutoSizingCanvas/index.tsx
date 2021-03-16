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

import { useRef, useLayoutEffect } from "react";

import Dimensions from "@foxglove-studio/app/components/Dimensions";

type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

type CanvasProps = {
  draw: Draw;
  width: number;
  height: number;
  overrideDevicePixelRatioForTest?: number;
};

type AutoSizingCanvasProps = {
  draw: Draw;
  overrideDevicePixelRatioForTest?: number;
};

// Nested within `AutoSizingCanvas` so that componentDidUpdate fires on width/height changes.
function Canvas({
  draw,
  width,
  height,
  overrideDevicePixelRatioForTest: ratio = window.devicePixelRatio || 1,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, width, height);
  });

  return (
    <canvas
      ref={canvasRef}
      width={width * ratio}
      height={height * ratio}
      style={{ width, height }}
    />
  );
}

const AutoSizingCanvas = ({ draw, overrideDevicePixelRatioForTest }: AutoSizingCanvasProps) => (
  <Dimensions>
    {({ width, height }) => (
      <Canvas
        width={width}
        height={height}
        draw={draw}
        overrideDevicePixelRatioForTest={overrideDevicePixelRatioForTest}
      />
    )}
  </Dimensions>
);

export default AutoSizingCanvas;

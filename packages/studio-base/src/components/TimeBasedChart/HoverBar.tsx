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

import { CSSProperties, useMemo } from "react";
import { withStyles } from "tss-react/mui";

import { RpcScales } from "@foxglove/studio-base/components/Chart/types";
import { useHoverValue } from "@foxglove/studio-base/context/TimelineInteractionStateContext";

const Wrapper = withStyles("div", () => ({
  root: {
    top: 0,
    bottom: 0,
    position: "absolute",
    pointerEvents: "none",
    willChange: "transform",
    visibility: "hidden",
  },
}));

type Props = {
  children?: React.ReactNode;
  componentId: string;
  scales?: RpcScales;
  isTimestampScale: boolean;
};

export default React.memo<Props>(function HoverBar({
  children,
  componentId,
  isTimestampScale,
  scales,
}: Props) {
  const hoverValue = useHoverValue({ componentId, isTimestampScale });

  const positionX = useMemo(() => {
    const xScale = scales?.x;
    if (!xScale || !hoverValue) {
      return;
    }

    const pixels = xScale.pixelMax - xScale.pixelMin;
    const range = xScale.max - xScale.min;

    if (pixels === 0 || range === 0) {
      return;
    }

    const pos = (hoverValue.value - xScale.min) / (range / pixels) + xScale.pixelMin;
    // don't show hoverbar if it falls outsize our boundary
    if (pos < xScale.pixelMin || pos > xScale.pixelMax) {
      return;
    }
    return pos;
  }, [scales?.x, hoverValue]);

  const { visibility, transform } = useMemo((): CSSProperties => {
    if (positionX == undefined || isNaN(positionX)) {
      return { visibility: "hidden", transform: undefined };
    }
    return { visibility: "visible", transform: `translateX(${positionX}px)` };
  }, [positionX]);

  return <Wrapper style={{ visibility, transform }}>{children}</Wrapper>;
});

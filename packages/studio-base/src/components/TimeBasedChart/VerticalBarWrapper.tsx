// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { RpcScales } from "@foxglove/studio-base/components/Chart/types";

export const useStyles = makeStyles()(() => ({
  root: {
    top: 0,
    bottom: 0,
    position: "absolute",
    pointerEvents: "none",
    willChange: "transform",
    visibility: "hidden",
  },
}));

type VerticalBarWrapperProps = {
  scales?: RpcScales;
  xValue?: number;
};

export function VerticalBarWrapper({
  children,
  scales,
  xValue,
}: React.PropsWithChildren<VerticalBarWrapperProps>): JSX.Element {
  const { classes } = useStyles();
  const positionX = useMemo(() => {
    const xScale = scales?.x;
    if (!xScale || xValue == undefined) {
      return;
    }

    const pixels = xScale.pixelMax - xScale.pixelMin;
    const range = xScale.max - xScale.min;

    if (pixels === 0 || range === 0) {
      return;
    }

    const pos = (xValue - xScale.min) / (range / pixels) + xScale.pixelMin;
    // don't show hoverbar if it falls outsize our boundary
    if (pos < xScale.pixelMin || pos > xScale.pixelMax) {
      return;
    }
    return pos;
  }, [scales?.x, xValue]);

  const style = useMemo((): CSSProperties => {
    if (positionX == undefined || isNaN(positionX)) {
      return { visibility: "hidden", transform: undefined };
    }
    return { visibility: "visible", transform: `translateX(${positionX}px)` };
  }, [positionX]);

  return (
    <div className={classes.root} style={style}>
      {children}
    </div>
  );
}

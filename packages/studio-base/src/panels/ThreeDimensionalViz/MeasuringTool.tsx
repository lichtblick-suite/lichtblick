// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect } from "react";

import { ReglClickInfo } from "@foxglove/regl-worldview";
import { InteractionStateProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/InteractionState";
import { MouseEventHandlerProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import {
  distanceBetweenPoints,
  Point,
  reglClickToPoint,
} from "@foxglove/studio-base/util/geometry";

type Props = InteractionStateProps<"measure"> & MouseEventHandlerProps;

export type MeasuringState =
  | { state: "start"; start?: Point }
  | { state: "finish"; start: Point; end: Point; distance: number };

export function MeasuringTool(props: Props): JSX.Element {
  const {
    addMouseEventHandler,
    removeMouseEventHandler,
    measure,
    interactionStateDispatch: dispatch,
  } = props;

  const upHandler = useCallback(
    (_ev: React.MouseEvent, click: ReglClickInfo) => {
      const point = reglClickToPoint(click);
      if (!point || !measure) {
        return;
      }

      if (measure.state === "start") {
        dispatch({
          action: "measure-update",
          state: { state: "finish", start: point, end: point, distance: 0 },
        });
      } else {
        dispatch({ action: "select-tool", tool: "idle" });
      }
    },
    [dispatch, measure],
  );

  const moveHandler = useCallback(
    (_ev: React.MouseEvent, click: ReglClickInfo) => {
      const point = reglClickToPoint(click);
      if (!point || !measure) {
        return;
      }

      if (measure.state === "start") {
        dispatch({ action: "measure-update", state: { state: "start", start: point } });
      } else {
        const distance = distanceBetweenPoints(measure.start, point);
        dispatch({ action: "measure-update", state: { ...measure, end: point, distance } });
      }
    },
    [dispatch, measure],
  );

  useEffect(() => {
    addMouseEventHandler("onMouseUp", upHandler);
    addMouseEventHandler("onMouseMove", moveHandler);

    return () => {
      removeMouseEventHandler("onMouseUp", upHandler);
      removeMouseEventHandler("onMouseMove", moveHandler);
    };
  }, [addMouseEventHandler, moveHandler, removeMouseEventHandler, upHandler]);

  return <div style={{ display: "none" }} />;
}

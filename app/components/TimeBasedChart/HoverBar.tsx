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

import { useSelector } from "react-redux";
import styled from "styled-components";

import {
  getChartPx,
  ScaleBounds,
} from "@foxglove-studio/app/components/ReactChartjs/zoomAndPanHelpers";

const SWrapper = styled.div`
  top: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  will-change: transform;
  // "visibility" and "transform" are set by JS, but outside of React.
  visibility: hidden;
`;

type Props = {
  children?: React.ReactNode;
  componentId: string;
  // We don't need to (and shouldn't) rerender when the scale-bounds changes under the cursor -- the
  // bar should stay under the mouse. Only rerender when the mouse moves (using useSelector).
  scaleBounds: { current?: readonly ScaleBounds[] };
  isTimestampScale: boolean;
};

function hideBar(wrapper: any) {
  if (wrapper.style.visibility !== "hidden") {
    wrapper.style.visibility = "hidden";
  }
}

function showBar(wrapper: any, position: any) {
  wrapper.style.visibility = "visible";
  wrapper.style.transform = `translateX(${position}px)`;
}

function shouldShowBar(hoverValue: any, componentId: any, isTimestampScale: boolean) {
  if (hoverValue == undefined) {
    return false;
  }
  if (hoverValue.type === "PLAYBACK_SECONDS" && isTimestampScale) {
    // Always show playback-time hover values for timestamp-based charts.
    return true;
  }
  // Otherwise just show a hover bar when hovering over the panel itself.
  return hoverValue.componentId === componentId;
}

export default React.memo<Props>(function HoverBar({
  children,
  componentId,
  isTimestampScale,
  scaleBounds,
}: Props) {
  const wrapper = React.useRef<HTMLDivElement>(ReactNull);
  const hoverValue = useSelector((state: any) => state.hoverValue);

  const xBounds = scaleBounds.current && scaleBounds.current.find(({ axes }) => axes === "xAxes");

  // We avoid putting the visibility and transforms into react state to try to keep updates snappy.
  // Mouse interactions are frequent, and adding/removing the bar from the DOM would slow things
  // down a lot more than mutating the style props does.
  if (wrapper.current != undefined) {
    const { current } = wrapper;
    if (xBounds == undefined || hoverValue == undefined) {
      hideBar(current);
    }
    if (shouldShowBar(hoverValue, componentId, isTimestampScale)) {
      const position = getChartPx(xBounds, hoverValue.value);
      if (position == undefined) {
        hideBar(current);
      } else {
        showBar(current, position);
      }
    }
  }

  return <SWrapper ref={wrapper}>{children}</SWrapper>;
});

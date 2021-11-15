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

import { TimeBasedChartTooltipData } from "@foxglove/studio-base/components/TimeBasedChart";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

import TimeBasedChartTooltipContent from "./TimeBasedChartTooltipContent";

export default {
  title: "components/TimeBasedChart/TimeBasedChartTooltipContent",
  component: TimeBasedChartTooltipContent,
};

export function SingleItem(): React.ReactElement {
  const data: TimeBasedChartTooltipData = {
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  const { tooltip } = useTooltip({
    shown: true,
    targetPosition: { x: 200, y: 100 },
    contents: <TimeBasedChartTooltipContent content={[data]} />,
  });
  return <div style={{ width: "100%", height: "100%" }}>{tooltip}</div>;
}
SingleItem.parameters = { colorScheme: "dark" };

export const SingleItemLight = Object.assign(SingleItem.bind(undefined), {
  parameters: { colorScheme: "light" },
});

export function MultipleItems(): React.ReactElement {
  const data: TimeBasedChartTooltipData = {
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  const { tooltip } = useTooltip({
    shown: true,
    targetPosition: { x: 200, y: 100 },
    contents: <TimeBasedChartTooltipContent content={[data, data]} />,
  });
  return <div style={{ width: "100%", height: "100%" }}>{tooltip}</div>;
}
MultipleItems.parameters = { colorScheme: "dark" };

export const MultipleItemsLight = Object.assign(MultipleItems.bind(undefined), {
  parameters: { colorScheme: "light" },
});

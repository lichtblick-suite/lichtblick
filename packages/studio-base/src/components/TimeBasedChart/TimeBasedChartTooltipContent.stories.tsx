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

import { Tooltip } from "@mui/material";

import { TimeBasedChartTooltipData } from "@foxglove/studio-base/components/TimeBasedChart";

import TimeBasedChartTooltipContent from "./TimeBasedChartTooltipContent";

export default {
  title: "components/TimeBasedChart/TimeBasedChartTooltipContent",
  component: TimeBasedChartTooltipContent,
};

export function SingleItemSingleDataset(): JSX.Element {
  const data: TimeBasedChartTooltipData = {
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  return (
    <Tooltip
      open
      title={<TimeBasedChartTooltipContent multiDataset={false} content={[data]} />}
      placement="top"
      arrow
      PopperProps={{
        anchorEl: {
          getBoundingClientRect: () => {
            return new DOMRect(200, 100, 0, 0);
          },
        },
      }}
    >
      <div style={{ width: "100%", height: "100%" }} />
    </Tooltip>
  );
}
SingleItemSingleDataset.parameters = { colorScheme: "dark" };

export const SingleItemSingleDatasetLight = Object.assign(SingleItemSingleDataset.bind(undefined), {
  parameters: { colorScheme: "light" },
});

export function SingleItemMultiDataset(): JSX.Element {
  const data: TimeBasedChartTooltipData = {
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  return (
    <Tooltip
      open
      title={<TimeBasedChartTooltipContent multiDataset={true} content={[data]} />}
      placement="top"
      arrow
      PopperProps={{
        anchorEl: {
          getBoundingClientRect: () => {
            return new DOMRect(200, 100, 0, 0);
          },
        },
      }}
    >
      <div style={{ width: "100%", height: "100%" }} />
    </Tooltip>
  );
}
SingleItemMultiDataset.parameters = { colorScheme: "dark" };

export const SingleItemMultiDatasetLight = Object.assign(SingleItemMultiDataset.bind(undefined), {
  parameters: { colorScheme: "light" },
});

export function MultipleItemsSingleDataset(): JSX.Element {
  const data: TimeBasedChartTooltipData = {
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  return (
    <Tooltip
      open
      title={<TimeBasedChartTooltipContent multiDataset={false} content={[data, data]} />}
      placement="top"
      arrow
      PopperProps={{
        anchorEl: {
          getBoundingClientRect: () => {
            return new DOMRect(200, 100, 0, 0);
          },
        },
      }}
    >
      <div style={{ width: "100%", height: "100%" }} />
    </Tooltip>
  );
}
MultipleItemsSingleDataset.parameters = { colorScheme: "dark" };

export const MultipleItemsSingleDatasetLight = Object.assign(
  MultipleItemsSingleDataset.bind(undefined),
  { parameters: { colorScheme: "light" } },
);

export function MultipleItemsMultipleDataset(): JSX.Element {
  const data: TimeBasedChartTooltipData = {
    datasetIndex: 0,
    x: 0,
    y: 0,
    path: "/some/topic.path",
    value: 3,
    constantName: "ACTIVE",
  };
  return (
    <Tooltip
      open
      title={
        <TimeBasedChartTooltipContent
          multiDataset={true}
          content={[data, data]}
          colorsByDatasetIndex={{ "0": "chartreuse" }}
        />
      }
      placement="top"
      arrow
      PopperProps={{
        anchorEl: {
          getBoundingClientRect: () => {
            return new DOMRect(200, 100, 0, 0);
          },
        },
      }}
    >
      <div style={{ width: "100%", height: "100%" }} />
    </Tooltip>
  );
}
MultipleItemsMultipleDataset.parameters = { colorScheme: "dark" };

export const MultipleItemsMultiDatasetLight = Object.assign(
  MultipleItemsMultipleDataset.bind(undefined),
  { parameters: { colorScheme: "light" } },
);

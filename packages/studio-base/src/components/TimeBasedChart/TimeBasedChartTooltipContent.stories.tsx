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
import { StoryObj } from "@storybook/react";

import { TimeBasedChartTooltipData } from "@foxglove/studio-base/components/TimeBasedChart";

import TimeBasedChartTooltipContent from "./TimeBasedChartTooltipContent";

export default {
  title: "components/TimeBasedChart/TimeBasedChartTooltipContent",
  component: TimeBasedChartTooltipContent,
};

export const SingleItemSingleDataset: StoryObj = {
  render: function Story() {
    const data: TimeBasedChartTooltipData = {
      x: 0,
      y: 0,
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
  },

  parameters: { colorScheme: "dark" },
};

export const SingleItemSingleDatasetLight: StoryObj = {
  ...SingleItemSingleDataset,
  parameters: { colorScheme: "light" },
};

export const SingleItemMultiDataset: StoryObj = {
  render: function Story() {
    const data: TimeBasedChartTooltipData = {
      datasetIndex: 0,
      x: 0,
      y: 0,
      value: 3,
      constantName: "ACTIVE",
    };
    return (
      <Tooltip
        open
        title={
          <TimeBasedChartTooltipContent
            multiDataset={true}
            content={[data]}
            labelsByDatasetIndex={{ "0": "/some/topic.path", "1": "Series B" }}
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
  },

  parameters: { colorScheme: "dark" },
};

export const SingleItemMultiDatasetLight: StoryObj = {
  ...SingleItemMultiDataset,
  parameters: { colorScheme: "light" },
};

export const MultipleItemsSingleDataset: StoryObj = {
  render: function Story() {
    const data: TimeBasedChartTooltipData = {
      x: 0,
      y: 0,
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
  },

  parameters: { colorScheme: "dark" },
};

export const MultipleItemsSingleDatasetLight: StoryObj = {
  ...MultipleItemsSingleDataset,
  parameters: { colorScheme: "light" },
};

export const MultipleItemsMultipleDataset: StoryObj = {
  render: function Story() {
    const data: TimeBasedChartTooltipData[] = [
      {
        datasetIndex: 0,
        x: 0,
        y: 0,
        value: 3,
        constantName: "ACTIVE",
      },
      {
        datasetIndex: 1,
        x: 0,
        y: 0,
        value: 4,
        constantName: "ACTIVE",
      },
    ];
    return (
      <Tooltip
        open
        title={
          <TimeBasedChartTooltipContent
            multiDataset={true}
            content={data}
            colorsByDatasetIndex={{ "0": "chartreuse", "1": "yellow" }}
            labelsByDatasetIndex={{ "0": "Series A", "1": "Series B" }}
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
  },

  parameters: { colorScheme: "dark" },
};

export const MultipleItemsMultiDatasetLight: StoryObj = {
  ...MultipleItemsMultipleDataset,
  parameters: { colorScheme: "light" },
};

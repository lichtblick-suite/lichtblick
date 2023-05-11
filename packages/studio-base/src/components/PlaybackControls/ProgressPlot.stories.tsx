// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { StoryFn, StoryObj } from "@storybook/react";

import { ProgressPlot } from "./ProgressPlot";

export default {
  title: "components/PlaybackControls/ProgressPlot",
  component: ProgressPlot,
  decorators: [
    (Story: StoryFn): JSX.Element => {
      const theme = useTheme();

      return (
        <div
          style={{
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(2),
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ backgroundColor: theme.palette.action.focus, height: 40 }}>
            <Story />
          </div>
        </div>
      );
    },
  ],
};

export const DisjointRanges: StoryObj = {
  render: () => (
    <ProgressPlot
      loading={false}
      availableRanges={[
        { start: 0, end: 0.2 },
        { start: 0.8, end: 1 },
      ]}
    />
  ),
  parameters: { colorScheme: "both-column" },
};

export const Loading: StoryObj = {
  render: () => (
    <ProgressPlot
      loading={true}
      availableRanges={[
        { start: 0, end: 0.2 },
        { start: 0.8, end: 1 },
      ]}
    />
  ),
  parameters: { colorScheme: "both-column" },
};

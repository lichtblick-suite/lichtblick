// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { StoryObj } from "@storybook/react";

import { ProgressPlot } from "./ProgressPlot";

export default {
  title: "components/PlaybackControls/ProgressPlot",
  component: ProgressPlot,
};

export const DisjointRanges: StoryObj = {
  render: () => {
    return (
      <Box bgcolor="background.paper" width="100%" height="100%" padding={2}>
        <Box bgcolor="action.focus" height={40}>
          <ProgressPlot
            loading={false}
            availableRanges={[
              { start: 0, end: 0.2 },
              { start: 0.8, end: 1 },
            ]}
          />
        </Box>
      </Box>
    );
  },

  parameters: { colorScheme: "both-column" },
};

export const Loading: StoryObj = {
  render: () => {
    return (
      <Box bgcolor="background.paper" width="100%" height="100%" padding={2}>
        <Box bgcolor="action.focus" height={40}>
          <ProgressPlot
            loading={true}
            availableRanges={[
              { start: 0, end: 0.2 },
              { start: 0.8, end: 1 },
            ]}
          />
        </Box>
      </Box>
    );
  },

  parameters: { colorScheme: "both-column" },
};

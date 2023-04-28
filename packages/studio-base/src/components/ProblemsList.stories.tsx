// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { StoryFn, StoryObj } from "@storybook/react";

import { fromDate } from "@foxglove/rostime";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { ProblemsList } from "@foxglove/studio-base/components/ProblemsList";
import { PlayerPresence, Topic } from "@foxglove/studio-base/players/types";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

export default {
  title: "components/ProblemsList",
  component: ProblemsList,
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <WorkspaceContextProvider>
        <Story />
      </WorkspaceContextProvider>
    ),
  ],
};

const START_TIME = fromDate(new Date(2022, 1, 22, 1, 11, 11));
const END_TIME = fromDate(new Date(2022, 1, 22, 22, 22, 22));
const TOPICS: Topic[] = [];

export const Default: StoryObj = {
  render: function Story() {
    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        presence={PlayerPresence.INITIALIZING}
      >
        <Box height="100%" bgcolor="background.paper">
          <ProblemsList />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const DefaultChinese: StoryObj = {
  ...Default,
  parameters: { forceLanguage: "zh" },
};

export const WithErrors: StoryObj = {
  render: function Story() {
    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        topics={TOPICS}
        presence={PlayerPresence.RECONNECTING}
        problems={[
          {
            severity: "error",
            message: "Connection lost",
            tip: "A tip that we might want to show the user",
            error: new Error("Original Error"),
          },
          {
            severity: "warn",
            message: "Connection lost",
            tip: "A tip that we might want to show the user",
          },
          {
            severity: "info",
            message: "Connection lost",
            tip: "A tip that we might want to show the user",
          },
        ]}
      >
        <Box height="100%" bgcolor="background.paper">
          <ProblemsList />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const WithErrorsChinese: StoryObj = {
  ...WithErrors,
  parameters: { forceLanguage: "zh" },
};

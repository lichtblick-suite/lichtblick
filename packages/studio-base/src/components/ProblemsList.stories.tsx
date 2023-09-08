// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
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
    (Story: StoryFn): JSX.Element => {
      const theme = useTheme();
      return (
        <WorkspaceContextProvider>
          <div style={{ height: "100%", background: theme.palette.background.paper }}>
            <Story />
          </div>
        </WorkspaceContextProvider>
      );
    },
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
        <ProblemsList />
      </MockMessagePipelineProvider>
    );
  },
};
export const DefaultChinese: StoryObj = {
  ...Default,
  parameters: { forceLanguage: "zh" },
};
export const DefaultJapanese: StoryObj = {
  ...Default,
  parameters: { forceLanguage: "ja" },
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
            error: Object.assign(new Error("Fake Error"), {
              stack: `Error: Original Error
    at Story (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/studio-base-src-components-ProblemsList-stories.039002bb.iframe.bundle.js:58:28)
    at undecoratedStoryFn (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:34:2794)
    at hookified (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:7:17032)
    at https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:34:1915
    at jsxDecorator (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/1983.4cb8db42.iframe.bundle.js:13838:1100)
    at hookified (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:7:17032)
    at https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:34:1454
    at https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/sb-preview/runtime.mjs:34:1915
    at Ch (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/1983.4cb8db42.iframe.bundle.js:47712:137)
    at ck (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/1983.4cb8db42.iframe.bundle.js:47822:460)`,
            }),
          },
          {
            severity: "warn",
            message: "Connection lost",
          },
          {
            severity: "info",
            message: "Connection lost",
            tip: "A tip that we might want to show the user",
          },
        ]}
      >
        <ProblemsList />
      </MockMessagePipelineProvider>
    );
  },
};
export const WithErrorsChinese: StoryObj = {
  ...WithErrors,
  parameters: { forceLanguage: "zh" },
};
export const WithErrorsJapanese: StoryObj = {
  ...WithErrors,
  parameters: { forceLanguage: "ja" },
};

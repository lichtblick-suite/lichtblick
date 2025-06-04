// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { StoryFn, StoryObj } from "@storybook/react";
import { useEffect } from "react";

import { fromDate } from "@lichtblick/rostime";
import { AlertsList } from "@lichtblick/suite-base/components/AlertsList";
import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import { useAlertsActions } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerPresence, PlayerAlert, Topic } from "@lichtblick/suite-base/players/types";
import AlertsContextProvider from "@lichtblick/suite-base/providers/AlertsContextProvider";
import WorkspaceContextProvider from "@lichtblick/suite-base/providers/WorkspaceContextProvider";

function makeAlerts(): PlayerAlert[] {
  return [
    {
      severity: "error",
      message: "Connection lost",
      tip: "A tip that we might want to show the user",
      error: Object.assign(new Error("Fake Error"), {
        stack: `Error: Original Error
at Story (https://603ec8bf7908b500231841e2-nozcuvybhv.capture.chromatic.com/suite-base-src-components-ProblemsList-stories.039002bb.iframe.bundle.js:58:28)
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
  ];
}

export default {
  title: "components/AlertsList",
  component: AlertsList,
  decorators: [
    (Story: StoryFn): React.JSX.Element => {
      const theme = useTheme();
      return (
        <WorkspaceContextProvider>
          <div style={{ height: "100%", background: theme.palette.background.paper }}>
            <AlertsContextProvider>
              <Story />
            </AlertsContextProvider>
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
        <AlertsList />
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
        alerts={makeAlerts()}
      >
        <AlertsList />
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

export const WithSessionAlerts: StoryObj = {
  render: function Story() {
    const alertsActions = useAlertsActions();
    useEffect(() => {
      alertsActions.setAlert("tag-1", {
        message: "Session alert error",
        severity: "error",
        tip: "Something really bad happened",
      });
      alertsActions.setAlert("tag-2", {
        message: "Session alert warn",
        severity: "warn",
        tip: "Something kinda bad happened",
      });
    }, [alertsActions]);

    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        topics={TOPICS}
        presence={PlayerPresence.RECONNECTING}
        alerts={makeAlerts()}
      >
        <WorkspaceContextProvider>
          <AlertsList />
        </WorkspaceContextProvider>
      </MockMessagePipelineProvider>
    );
  },
};

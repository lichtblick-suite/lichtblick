// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { StoryObj, StoryFn } from "@storybook/react";
import { useEffect } from "react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { PlaybackControlsTooltipContent } from "@foxglove/studio-base/components/PlaybackControls/PlaybackControlsTooltipContent";
import { useTimelineInteractionState } from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import TimelineInteractionStateProvider from "@foxglove/studio-base/providers/TimelineInteractionStateProvider";

function Wrapper(Wrapped: StoryFn): JSX.Element {
  const theme = useTheme();
  return (
    <TimelineInteractionStateProvider>
      <MockMessagePipelineProvider>
        <div
          style={{
            maxWidth: "16rem",
            marginInline: "auto",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Wrapped />
        </div>
      </MockMessagePipelineProvider>
    </TimelineInteractionStateProvider>
  );
}

export default {
  component: PlaybackControlsTooltipContent,
  title: "components/PlaybackControls/TooltipContent",
  decorators: [Wrapper],
};

export const Default: StoryObj = {
  render: () => {
    return <PlaybackControlsTooltipContent stamp={{ sec: 1, nsec: 1 }} />;
  },
};

export const WithEvents: StoryObj = {
  render: function Story() {
    const setEvents = useTimelineInteractionState((store) => store.setEventsAtHoverValue);

    useEffect(() => {
      setEvents([
        {
          event: {
            createdAt: "1",
            id: "1",
            deviceId: "dev1",
            durationNanos: "1",
            endTime: { sec: 1, nsec: 1 },
            endTimeInSeconds: 1,
            metadata: {
              "meta 1": "value 1",
              "meta 2": "value 2",
              "long event metadata key that might overflow":
                "long event metadata value that might also overflow",
            },
            startTime: { sec: 0, nsec: 0 },
            startTimeInSeconds: 1,
            timestampNanos: "1",
            updatedAt: "1",
          },
          startPosition: 0,
          endPosition: 0.1,
          secondsSinceStart: 0,
        },
      ]);
    }, [setEvents]);

    return <PlaybackControlsTooltipContent stamp={{ sec: 1, nsec: 1 }} />;
  },
};

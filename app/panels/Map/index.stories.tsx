// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import MapPanel from "./index";

export default {
  title: "panels/Map/index",
  component: MapPanel,
  decorators: [
    (StoryComponent: Story, { parameters }: StoryContext): JSX.Element => {
      return (
        <PanelSetup fixture={parameters.panelSetup?.fixture}>
          <StoryComponent />
        </PanelSetup>
      );
    },
  ],
};

export const EmptyState = (): JSX.Element => {
  return <MapPanel />;
};

export const SinglePoint = (): JSX.Element => {
  return <MapPanel />;
};

SinglePoint.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [{ name: "/gps", datatype: "sensor_msgs/NavSatFix" }],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            message: {
              latitude: 0,
              longitude: 0,
            },
          },
        ],
      },
    },
  },
};

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import useDelayedFixture from "./useDelayedFixture";
import ThreeDeePanel from "../index";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
};

export const CustomBackgroundColor: StoryObj = {
  render: function Story() {
    const fixture = useDelayedFixture({
      topics: [],
      frame: {},
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
      },
    });

    return (
      <PanelSetup fixture={fixture}>
        <ThreeDeePanel
          overrideConfig={{
            ...ThreeDeePanel.defaultConfig,
            scene: { backgroundColor: "#2d7566" },
          }}
        />
      </PanelSetup>
    );
  },
};

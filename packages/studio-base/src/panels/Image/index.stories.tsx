// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { useRef, useEffect } from "react";
import TestUtils from "react-dom/test-utils";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ImageView from "./index";

export default {
  title: "panels/ImageView",
  component: ImageView,
};

function useHoverOnPanel(andThen?: () => void) {
  const timeOutID = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      if (timeOutID.current != undefined) {
        clearTimeout(timeOutID.current);
      }
    };
  }, []);

  const callback = useRef(andThen); // should not change
  return () => {
    const container = document.querySelector("[data-testid~='panel-mouseenter-container']");
    if (!container) {
      throw new Error("missing mouseenter container");
    }
    TestUtils.Simulate.mouseEnter(container);

    // wait for hover to complete
    timeOutID.current = setTimeout(() => callback.current?.(), 10);
  };
}

export const NoTopic: StoryObj = {
  render: (): React.ReactElement => {
    return (
      <PanelSetup>
        <ImageView />
      </PanelSetup>
    );
  },
};

export const WithSettings: StoryObj = {
  render: function Story() {
    return (
      <PanelSetup includeSettings>
        <ImageView />
      </PanelSetup>
    );
  },

  parameters: {
    colorScheme: "light",
  },
};

export const TopicButNoDataSource: StoryObj = {
  render: (): React.ReactElement => {
    return (
      <PanelSetup>
        <ImageView overrideConfig={{ ...ImageView.defaultConfig, cameraTopic: "a_topic" }} />
      </PanelSetup>
    );
  },
};

export const TopicButNoDataSourceHovered: StoryObj = {
  render: function Story() {
    const onMount = useHoverOnPanel();
    return (
      <PanelSetup onMount={onMount}>
        <ImageView overrideConfig={{ ...ImageView.defaultConfig, cameraTopic: "a_topic" }} />
      </PanelSetup>
    );
  },

  parameters: { colorScheme: "dark" },
};

export const TopicButNoDataSourceHoveredLight: StoryObj = {
  ...TopicButNoDataSourceHovered,
  parameters: { colorScheme: "light" },
};

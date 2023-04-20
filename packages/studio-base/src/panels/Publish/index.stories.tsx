// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { action } from "@storybook/addon-actions";
import { StoryObj } from "@storybook/react";

import Publish from "@foxglove/studio-base/panels/Publish";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

const getFixture = ({ allowPublish }: { allowPublish: boolean }) => {
  return {
    topics: [],
    datatypes: new Map(
      Object.entries({
        "std_msgs/String": { definitions: [{ name: "data", type: "string" }] },
      }),
    ),
    frame: {},
    capabilities: allowPublish ? [PlayerCapabilities.advertise] : [],
    publish: action("publish"),
    setPublishers: action("setPublishers"),
  };
};

const advancedJSON = `{\n  "data": ""\n}`;
const publishConfig = (config: Partial<(typeof Publish)["defaultConfig"]>) => ({
  topicName: "/sample_topic",
  datatype: "std_msgs/String",
  buttonText: "Publish",
  buttonTooltip: "",
  buttonColor: "",
  advancedView: true,
  value: "",
  ...config,
});

export default {
  title: "panels/Publish",
};

export const ExampleCanPublishAdvanced: StoryObj = {
  render: () => {
    const allowPublish = true;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  },

  name: "example can publish, advanced",
};

export const CustomButtonColor: StoryObj = {
  render: () => {
    const allowPublish = true;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish
          overrideConfig={publishConfig({
            advancedView: true,
            value: advancedJSON,
            buttonColor: "#ffbf49",
          })}
        />
      </PanelSetup>
    );
  },

  name: "custom button color",
};

export const ExampleCantPublishAdvanced: StoryObj = {
  render: () => {
    const allowPublish = false;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  },

  name: "example can't publish, advanced",
};

export const ExampleCantPublishNotAdvanced: StoryObj = {
  render: () => {
    const allowPublish = false;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: false, value: advancedJSON })} />
      </PanelSetup>
    );
  },

  name: "example can't publish, not advanced",
};

export const ExampleWithDatatypeThatNoLongerExists: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={{ topics: [], datatypes: new Map(), frame: {}, capabilities: [] }}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  },

  name: "Example with datatype that no longer exists",
};

export const ExampleWithValidPresetJson: StoryObj = {
  render: () => {
    const fixture = {
      topics: [],
      datatypes: new Map(
        Object.entries({
          "std_msgs/String": { definitions: [{ name: "data", type: "string" }] },
        }),
      ),
      frame: {},
      capabilities: [PlayerCapabilities.advertise],
      setPublishers: action("setPublishers"),
      publish: action("publish"),
    };

    const validJSON = `{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}`;

    return (
      <PanelSetup fixture={fixture}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: validJSON })} />
      </PanelSetup>
    );
  },

  name: "example with valid preset JSON",
};

export const ExampleWithInvalidPresetJson: StoryObj = {
  render: () => {
    const fixture = {
      topics: [],
      datatypes: new Map(
        Object.entries({
          "std_msgs/String": { definitions: [{ name: "data", type: "string" }] },
        }),
      ),
      frame: {},
      capabilities: [PlayerCapabilities.advertise],
      setPublishers: action("setPublishers"),
      publish: action("publish"),
    };

    const invalid = `{\n  "a": 1,\n  'b: 2,\n  "c": 3\n}`;

    return (
      <PanelSetup fixture={fixture}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: invalid })} />
      </PanelSetup>
    );
  },

  name: "example with invalid preset JSON",
};

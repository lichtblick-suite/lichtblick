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
import { storiesOf } from "@storybook/react";

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
const publishConfig = (config: Partial<typeof Publish["defaultConfig"]>) => ({
  topicName: "/sample_topic",
  datatype: "std_msgs/String",
  buttonText: "Publish",
  buttonTooltip: "",
  buttonColor: "",
  advancedView: true,
  value: "",
  ...config,
});

storiesOf("panels/Publish", module)
  .add("example can publish, advanced", () => {
    const allowPublish = true;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  })
  .add("custom button color", () => {
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
  })
  .add("example can't publish, advanced", () => {
    const allowPublish = false;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  })
  .add("example can't publish, not advanced", () => {
    const allowPublish = false;
    return (
      <PanelSetup fixture={getFixture({ allowPublish })}>
        <Publish overrideConfig={publishConfig({ advancedView: false, value: advancedJSON })} />
      </PanelSetup>
    );
  })
  .add("Example with datatype that no longer exists", () => {
    return (
      <PanelSetup fixture={{ topics: [], datatypes: new Map(), frame: {}, capabilities: [] }}>
        <Publish overrideConfig={publishConfig({ advancedView: true, value: advancedJSON })} />
      </PanelSetup>
    );
  })
  .add("example with valid preset JSON", () => {
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
  })
  .add("example with invalid preset JSON", () => {
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
  });

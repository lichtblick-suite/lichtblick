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
import { mount } from "enzyme";

import Publish from "@foxglove-studio/app/panels/Publish";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

describe("Publish panel", () => {
  it("does not update its state on first render", async () => {
    const originalWarn = console.warn;
    const spy = jest.spyOn(console, "warn").mockImplementation((msg: string, ...args) => {
      // Ignore console warning for now which come from React Autocomplete -- these would normally fail the test
      if (
        msg.includes("componentWillMount has been renamed") ||
        msg.includes("componentWillReceiveProps has been renamed")
      ) {
        return;
      }
      originalWarn(msg, ...args);
    });
    const saveConfig = jest.fn();
    mount(
      <PanelSetup
        fixture={{
          topics: [],
          datatypes: { "std_msgs/String": { fields: [{ name: "data", type: "string" }] } },
          frame: {},
          capabilities: [],
        }}
      >
        <Publish
          config={{
            topicName: "/sample_topic",
            datatype: "std_msgs/String",
            buttonText: "Publish",
            buttonTooltip: "",
            buttonColor: "",
            advancedView: true,
            value: `{ "data": "hello" }`,
          }}
          saveConfig={saveConfig}
        />
      </PanelSetup>,
    );
    // Gets called with unnecessary payload if we don't check whether state.cachedProps.config has
    // already been initialized
    expect(saveConfig).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

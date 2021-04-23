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

import { storiesOf } from "@storybook/react";
import TestUtils from "react-dom/test-utils";

import GlobalVariableSliderPanel from "@foxglove-studio/app/panels/GlobalVariableSlider/index";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

const fixture = {
  topics: [],
  datatypes: {
    Foo: { fields: [] },
  },
  frame: {},
  capabilities: [],
  globalVariables: { globalVariable: 3.5 },
};

storiesOf("panels/GlobalVariableSlider/index", module)
  .add("example", () => {
    return (
      <PanelSetup fixture={fixture}>
        <GlobalVariableSliderPanel />
      </PanelSetup>
    );
  })
  .add("labels do not overlap when panel narrow", () => {
    return (
      <PanelSetup fixture={fixture}>
        <div style={{ width: 400 }}>
          <GlobalVariableSliderPanel />
        </div>
      </PanelSetup>
    );
  })
  .add("menu", () => {
    return (
      <PanelSetup fixture={fixture}>
        <GlobalVariableSliderPanel
          // @ts-expect-error add ref to slider panel?
          ref={() => {
            setTimeout(() => {
              const mouseEnterContainer = document.querySelectorAll(
                "[data-test~=panel-mouseenter-container",
              )[0];
              TestUtils.Simulate.mouseEnter(mouseEnterContainer!);
              (document.querySelectorAll("[data-test=panel-settings]")[0] as any).click();
            }, 50);
          }}
        />
      </PanelSetup>
    );
  });

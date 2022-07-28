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

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import UnlinkGlobalVariables from "./UnlinkGlobalVariables";

const linkedGlobalVariables = [
  {
    topic: "/foo/bar",
    markerKeyPath: ["id"],
    name: "some_id",
  },
  {
    topic: "/abc/xyz",
    markerKeyPath: ["id", "some_path"],
    name: "some_id",
  },
  {
    topic: "/foo/bar",
    markerKeyPath: ["x", "scale", "some_very_very_long_path"],
    name: "some_id",
  },
  {
    topic: "/foo/bar",
    markerKeyPath: ["x", "scale", "some_very_very_long_path"],
    name: "someOtherName",
  },
];

storiesOf(
  "panels/ThreeDimensionalViz/Interactions/GlobalVariableLink/UnlinkGlobalVariables",
  module,
).add("default", () => {
  return (
    <PanelSetup
      fixture={{
        topics: [],
        datatypes: new Map(),
        frame: {},
        linkedGlobalVariables,
        globalVariables: {
          scaleY: 2.4,
          fooScaleX: 3,
        },
      }}
    >
      <div
        ref={(el) => {
          if (el) {
            const btn = el.querySelector<HTMLElement>("[data-testid='unlink-some_id']");
            if (btn) {
              btn.click();
            }
          }
        }}
      >
        <UnlinkGlobalVariables name="some_id" />
      </div>
    </PanelSetup>
  );
});

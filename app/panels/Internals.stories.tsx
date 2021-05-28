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

import Internals from "@foxglove/studio-base/panels/Internals";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

storiesOf("panels/Internals", module)
  .add("default", () => {
    return (
      <PanelSetup
        fixture={{
          topics: [
            { name: "/my/topic", datatype: "my_datatype" },
            { name: "/another/topic", datatype: "my_datatype" },
          ],
          frame: {},
        }}
      >
        <Internals />
      </PanelSetup>
    );
  })
  .add("click record", () => {
    return (
      <PanelSetup
        fixture={{
          topics: [],
          frame: {},
        }}
        onMount={(el: any) => {
          el.querySelector("button").click();
        }}
      >
        <Internals />
      </PanelSetup>
    );
  });

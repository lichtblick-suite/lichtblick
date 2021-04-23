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

import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

import SubscribeToList from "./SubscribeToList";

storiesOf("panels/SubscribeToList", module).add("shows a topic list", () => {
  return (
    <PanelSetup
      fixture={{
        topics: [{ name: "/my/topic", datatype: "my_datatype" }],
        frame: {
          "/my/topic": [
            {
              receiveTime: { sec: 1, nsec: 0 },
              topic: "/my/topic",
              message: {},
            },
          ],
        },
      }}
    >
      <SubscribeToList config={{ topics: "/my/topic" }} />
    </PanelSetup>
  );
});

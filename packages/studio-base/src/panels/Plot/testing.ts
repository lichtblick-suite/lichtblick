// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";

import { FAKE_TOPIC } from "./processor/testing";

export const createBlock = (value: unknown): MessageBlock => ({
  [FAKE_TOPIC]: [
    {
      topic: FAKE_TOPIC,
      schemaName: "",
      sizeInBytes: 0,
      message: value,
      receiveTime: fromSec(0),
    },
  ],
});
